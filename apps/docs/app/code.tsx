import type { ReactNode } from 'react';
import { createCssVariablesTheme, createHighlighter, type Highlighter } from 'shiki';
import { CopyButton } from './copy-button';

/** The languages the docs show; anything else is a type error. */
const LANGS = ['ts', 'tsx', 'sh', 'css', 'html', 'http'] as const;
export type CodeLang = (typeof LANGS)[number];

// Colours are CSS variables, so the code follows the theme and the material
// (ADR-061). Font styles are off: the mono face has no italic loaded.
const THEME = createCssVariablesTheme({ name: 'lab', variablePrefix: '--code-', fontStyle: false });

/**
 * Token kinds that get a colour (a class): keywords, strings and comments.
 * Everything else stays in the text colour: every coloured token is an
 * element, and each one in view cost a capture of the page about 1 ms
 * (headless Chromium, PROGRESS M20); functions and constants were 40 % of
 * the spans for the least meaning.
 */
const KINDS: Readonly<Record<string, string>> = {
  'token-keyword': 'tk-keyword',
  'token-string': 'tk-string',
  'token-string-expression': 'tk-string',
  'token-comment': 'tk-comment',
  'token-link': 'tk-string',
};

let highlighter: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  highlighter ??= createHighlighter({ themes: [THEME], langs: [...LANGS] });
  return highlighter;
}

function kindOf(color: string | undefined): string | undefined {
  const match = color === undefined ? null : /^var\(--code-([a-z-]+)/.exec(color);
  return match?.[1] === undefined ? undefined : KINDS[match[1]];
}

/**
 * A code block, highlighted at build time with Shiki (server component: the
 * browser gets plain spans and no highlighter), with a language label and a
 * copy button. Neighbouring tokens of one kind share a span.
 */
export async function Code({
  lang,
  children,
}: {
  lang: CodeLang;
  children: string;
}): Promise<ReactNode> {
  const text = children.trim();
  const lines = (await getHighlighter()).codeToTokensBase(text, { lang, theme: THEME });
  const parts: ReactNode[] = [];
  let run = '';
  let runKind: string | undefined;
  const flush = (): void => {
    if (run === '') return;
    parts.push(
      runKind ? (
        <span key={parts.length} className={runKind}>
          {run}
        </span>
      ) : (
        run
      ),
    );
    run = '';
  };
  lines.forEach((line, index) => {
    if (index > 0) {
      // A newline continues a run; it keeps the text joined.
      run += '\n';
    }
    for (const token of line) {
      const kind = token.content.trim() === '' ? runKind : kindOf(token.color);
      if (kind !== runKind) {
        flush();
        runKind = kind;
      }
      run += token.content;
    }
  });
  flush();
  return (
    <div className="code-block">
      <span className="code-label" aria-hidden="true">
        {lang}
      </span>
      <CopyButton text={text} />
      <pre tabIndex={0}>
        <code>{parts}</code>
      </pre>
    </div>
  );
}
