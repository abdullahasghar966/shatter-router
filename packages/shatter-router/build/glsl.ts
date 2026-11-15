/**
 * Build-time GLSL minifier (ADR-039). The shader sources live in template
 * literals tagged with a `/* glsl *\/` comment; their comments and indentation
 * cost about a kilobyte of the engine chunk's gzip budget. This rewrites the
 * static parts of every tagged template in a source file:
 *
 * - `//` and `/* *\/` comments are removed,
 * - lines are trimmed and empty lines dropped (newlines stay, so preprocessor
 *   directives keep their own line),
 * - runs of blanks become one space, and blanks next to punctuation that can
 *   never join two tokens (`{}()[];,=*\/<>!&|?:`) are dropped, except on
 *   preprocessor lines. Blanks next to `+` and `-` are kept: `a - -b` must
 *   not become `a--b`.
 *
 * `${...}` interpolations are left exactly as written (nested templates
 * included), and a chunk boundary is never trimmed, so `float ${name}` keeps
 * its space. The removed newlines are appended after the closing backtick, so
 * every line after a template keeps its number and the source map stays right.
 */

const TAG = /\/\*\s*glsl\s*\*\//g;
const JOIN_SAFE = /[ \t]*([{}()[\];,=*/<>!&|?:])[ \t]*/g;

/** Minifies one static chunk of GLSL text (no interpolations inside). */
export function minifyGlslChunk(text: string): string {
  if (text.includes('\\')) throw new Error('glsl minify: backslash escapes are not supported');
  let out = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
  if (out.includes('/*')) throw new Error('glsl minify: block comment crosses an interpolation');
  out = out.replace(/\/\/[^\n]*/g, (comment, offset: number) => {
    if (!out.slice(offset).includes('\n')) {
      throw new Error(`glsl minify: line comment before an interpolation: ${comment}`);
    }
    return '';
  });
  const lines = out.split('\n');
  const last = lines.length - 1;
  const kept: string[] = [];
  lines.forEach((line, i) => {
    // The first and last segments touch an interpolation (or the backtick):
    // only their inner side may be trimmed.
    let next = line.replace(/[ \t]+/g, ' ');
    if (i > 0) next = next.replace(/^ /, '');
    if (i < last) next = next.replace(/ $/, '');
    // `#define F (x)` and `#define F(x)` differ: leave directives' spacing alone.
    if (!next.trimStart().startsWith('#')) next = next.replace(JOIN_SAFE, '$1');
    if (next.length > 0 || i === 0 || i === last) kept.push(next);
  });
  return kept.join('\n');
}

/** Index just past the template literal whose opening backtick is at `start`. */
function skipTemplate(source: string, start: number): number {
  let i = start + 1;
  while (i < source.length) {
    const c = source[i];
    if (c === '\\') i += 2;
    else if (c === '`') return i + 1;
    else if (c === '$' && source[i + 1] === '{') i = skipExpression(source, i + 2);
    else i++;
  }
  throw new Error('glsl minify: unterminated template literal');
}

/** Index just past the `}` that closes the interpolation starting at `start`. */
function skipExpression(source: string, start: number): number {
  let depth = 1;
  let i = start;
  while (i < source.length) {
    const c = source[i];
    if (c === "'" || c === '"') {
      i++;
      while (i < source.length && source[i] !== c) i += source[i] === '\\' ? 2 : 1;
      i++;
    } else if (c === '`') {
      i = skipTemplate(source, i);
    } else if (c === '/' && source[i + 1] === '/') {
      i = source.indexOf('\n', i);
      if (i < 0) break;
    } else if (c === '/' && source[i + 1] === '*') {
      i = source.indexOf('*/', i + 2) + 2;
      if (i < 2) break;
    } else {
      if (c === '{') depth++;
      else if (c === '}' && --depth === 0) return i + 1;
      i++;
    }
  }
  throw new Error('glsl minify: unterminated interpolation');
}

function countLines(text: string): number {
  let n = 0;
  for (const c of text) if (c === '\n') n++;
  return n;
}

/** Rewrites every `/* glsl *\/`-tagged template literal in a source file. */
export function minifyGlslTemplates(source: string): string {
  let out = '';
  let copied = 0;
  for (const match of source.matchAll(TAG)) {
    let i = match.index + match[0].length;
    while (/\s/.test(source[i] ?? '')) i++;
    if (source[i] !== '`' || i < copied) continue;
    out += source.slice(copied, i + 1);
    i++;
    let removed = 0;
    let chunkStart = i;
    const flush = (end: number): void => {
      const chunk = source.slice(chunkStart, end);
      const minified = minifyGlslChunk(chunk);
      removed += countLines(chunk) - countLines(minified);
      out += minified;
    };
    for (;;) {
      const c = source[i];
      if (c === undefined) throw new Error('glsl minify: unterminated template literal');
      if (c === '`') {
        flush(i);
        out += '`' + '\n'.repeat(removed);
        i++;
        break;
      }
      if (c === '$' && source[i + 1] === '{') {
        flush(i);
        const end = skipExpression(source, i + 2);
        out += source.slice(i, end);
        i = end;
        chunkStart = i;
        continue;
      }
      i++;
    }
    copied = i;
  }
  return out + source.slice(copied);
}
