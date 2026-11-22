// Builds the docs site's search index (ADR-061) from the pages' TSX source:
// every app/**/page.tsx (headings, prose, inline code, the identifiers in
// code blocks) and the effect pages from lib/effects.ts. Writes
// apps/docs/lib/search-index.json. `--check` fails when the committed index
// differs from what the pages say (run in CI with lint), so it cannot go stale.
//
// Usage: node scripts/search-index.mjs [--check]
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'apps', 'docs', 'app');
const out = join(root, 'apps', 'docs', 'lib', 'search-index.json');
const HEADINGS = new Set(['h1', 'h2', 'h3']);
/** Longest text kept per section: enough to match and to show a snippet. */
const MAX_TEXT = 1200;

function pages(dir) {
  const found = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      // Dynamic routes are indexed from their data (the effects below).
      if (!name.startsWith('[')) found.push(...pages(path));
    } else if (name === 'page.tsx') {
      found.push(path);
    }
  }
  return found;
}

function routeOf(file) {
  const parts = relative(app, dirname(file)).split(sep).filter(Boolean);
  return `/${parts.join('/')}`;
}

/** Elements whose whole text is one piece of prose (or code). */
const TEXT_BLOCKS = new Set([
  'p',
  'li',
  'td',
  'th',
  'dt',
  'dd',
  'figcaption',
  'blockquote',
  'Code',
]);

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rarr: '→',
  larr: '←',
};

/** JSX text keeps HTML entities as written: decode the ones the pages use. */
function decode(text) {
  return text.replace(/&(#\d+|[a-z]+);/g, (whole, name) => {
    if (name.startsWith('#')) return String.fromCodePoint(Number(name.slice(1)));
    return ENTITIES[name] ?? whole;
  });
}

const squash = (text) => decode(text).replace(/\s+/g, ' ').trim();

function tagName(node) {
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  return opening.tagName.getText();
}

function attribute(node, name) {
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  for (const prop of opening.attributes.properties) {
    if (ts.isJsxAttribute(prop) && prop.name.getText() === name && prop.initializer) {
      if (ts.isStringLiteral(prop.initializer)) return prop.initializer.text;
    }
  }
  return undefined;
}

/** The identifiers of a code block: searchable names, not the whole listing. */
function codeWords(text) {
  const words = new Set(text.match(/[A-Za-z_$][\w$-]{2,}/g) ?? []);
  return [...words].join(' ');
}

/** The text a JSX subtree shows, in source order. */
function textOf(node, sourceFile) {
  const parts = [];
  const visit = (current) => {
    if (ts.isJsxText(current)) {
      parts.push(current.text);
      return;
    }
    if (ts.isJsxExpression(current) && current.expression) {
      const expression = current.expression;
      if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
        parts.push(expression.text);
        return;
      }
    }
    if (
      (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) &&
      tagName(current) === 'Code'
    ) {
      const literal = ts.isJsxElement(current)
        ? current.children.find(ts.isJsxExpression)
        : undefined;
      const value = literal?.expression;
      if (value && (ts.isNoSubstitutionTemplateLiteral(value) || ts.isStringLiteral(value))) {
        parts.push(` ${codeWords(value.text)} `);
      }
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return squash(parts.join(''));
}

function metadataTitle(sourceFile) {
  let title;
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(sourceFile) === 'metadata' &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const prop of node.initializer.properties) {
        if (!ts.isPropertyAssignment(prop) || prop.name.getText(sourceFile) !== 'title') continue;
        if (ts.isStringLiteral(prop.initializer)) title = prop.initializer.text;
        else if (ts.isObjectLiteralExpression(prop.initializer)) {
          for (const inner of prop.initializer.properties) {
            if (ts.isPropertyAssignment(inner) && ts.isStringLiteral(inner.initializer)) {
              title = inner.initializer.text;
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return title;
}

/**
 * Splits a page into sections at its h2/h3 headings (in source order, so the
 * panels of framework tabs count too). Text before the first heading belongs
 * to the page itself.
 */
function indexPage(file) {
  const source = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const sections = [{ anchor: '', heading: '', text: [] }];
  let h1;
  const add = (text) => {
    if (text) sections.at(-1)?.text.push(text);
  };
  // Headings open sections; text blocks are read whole; everything else is
  // walked, attributes included (the panels of framework tabs are props).
  const visit = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = tagName(node);
      if (HEADINGS.has(tag)) {
        const heading = textOf(node, sourceFile);
        if (tag === 'h1') h1 ??= heading;
        else sections.push({ anchor: attribute(node, 'id') ?? '', heading, text: [] });
        return;
      }
      if (attribute(node, 'className') === 'kicker') return;
      if (TEXT_BLOCKS.has(tag)) {
        add(textOf(node, sourceFile));
        return;
      }
    }
    if (ts.isJsxText(node)) {
      add(squash(node.text));
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  const href = routeOf(file);
  return {
    href,
    title: metadataTitle(sourceFile) ?? h1 ?? href,
    sections: sections
      .map((section) => ({
        anchor: section.anchor,
        heading: section.heading,
        text: squash(section.text.join(' ')).slice(0, MAX_TEXT),
      }))
      .filter((section) => section.heading || section.text),
  };
}

const { EFFECTS } = await import(
  pathToFileURL(join(root, 'apps', 'docs', 'lib', 'effects.ts')).href
);
const index = {
  pages: [
    ...pages(app).map(indexPage),
    ...EFFECTS.map((effect) => ({
      href: `/effects/${effect.name}`,
      title: `${effect.title} effect`,
      sections: [
        {
          anchor: '',
          heading: '',
          text: squash(
            `${effect.name} ${effect.family} ${effect.summary} ${effect.motion} ${effect.ends}`,
          ),
        },
      ],
    })),
  ].sort((a, b) => a.href.localeCompare(b.href)),
};
const json = `${JSON.stringify(index, null, 1)}\n`;
if (process.argv.includes('--check')) {
  const current = (() => {
    try {
      return readFileSync(out, 'utf8');
    } catch {
      return '';
    }
  })();
  if (current !== json) {
    console.error(
      'apps/docs/lib/search-index.json is out of date: run node scripts/search-index.mjs',
    );
    process.exit(1);
  }
  console.log('search index is current');
} else {
  writeFileSync(out, json);
  const sections = index.pages.reduce((sum, page) => sum + page.sections.length, 0);
  console.log(
    `search index: ${index.pages.length} pages, ${sections} sections, ${json.length} bytes`,
  );
}
