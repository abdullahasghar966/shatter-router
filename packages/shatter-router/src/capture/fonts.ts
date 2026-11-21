/**
 * Keeps only the web-font files a capture can use (ADR-051).
 *
 * modern-screenshot inlines every `@font-face` of every font family the page
 * uses into each capture, whatever its `unicode-range`. Fonts served in
 * subsets (Google Fonts and `next/font` split each family into Latin,
 * Latin-ext, Cyrillic, Vietnamese… files) then cost every capture the bytes
 * of files the page never draws: serialising, URL-encoding and decoding a
 * much larger SVG. The library records which characters each family renders;
 * a face whose `unicode-range` contains none of them is dropped.
 *
 * A face the live page has not finished loading is dropped too: the page
 * still shows the fallback font there (`font-display: swap`), and the copy
 * must show what the user sees.
 */

/** Live loading state of the page's font faces, by family and range. */
export type FaceStatus = (family: string, unicodeRange: string) => 'loaded' | 'pending' | null;

function rangeKey(range: string): string {
  return range.replace(/\s+/g, '').toUpperCase();
}

const ALL_CHARACTERS = 'U+0-10FFFF';

/** Reads `document.fonts`: a face counts as loaded if any face with its family and range is. */
export function liveFaceStatus(doc: Document): FaceStatus {
  const states = new Map<string, 'loaded' | 'pending'>();
  doc.fonts.forEach((face) => {
    const key = `${families(face.family)[0] ?? ''}|${rangeKey(face.unicodeRange || ALL_CHARACTERS)}`;
    if (face.status === 'loaded') states.set(key, 'loaded');
    else if (face.status !== 'error' && !states.has(key)) states.set(key, 'pending');
  });
  return (family, unicodeRange) =>
    states.get(`${families(family)[0] ?? ''}|${rangeKey(unicodeRange)}`) ?? null;
}

/** `U+0-FF, U+131, U+4??` → inclusive code point ranges. Null when it cannot be read. */
export function parseUnicodeRange(value: string): [number, number][] | null {
  const ranges: [number, number][] = [];
  for (const part of value.split(',')) {
    const token = part.trim().toUpperCase();
    if (token === '') continue;
    const match = /^U\+([0-9A-F?]{1,6})(?:-([0-9A-F]{1,6}))?$/.exec(token);
    if (!match) return null;
    const [, start = '', end] = match;
    if (start.includes('?')) {
      if (end !== undefined) return null;
      ranges.push([
        Number.parseInt(start.replaceAll('?', '0'), 16),
        Number.parseInt(start.replaceAll('?', 'F'), 16),
      ]);
    } else {
      const low = Number.parseInt(start, 16);
      ranges.push([low, end === undefined ? low : Number.parseInt(end, 16)]);
    }
  }
  return ranges.length > 0 ? ranges : null;
}

/** As modern-screenshot normalises family names: lower case, no quotes. */
function families(value: string): string[] {
  return value
    .split(',')
    .map((family) => family.trim().replace(/["']/g, '').toLowerCase())
    .filter(Boolean);
}

/**
 * Whether an inlined `@font-face` rule may draw any of the characters the
 * capture uses in its family. Keeps the rule whenever in doubt (no
 * `unicode-range`, an unreadable one, or no record of the family's text).
 */
export function fontFaceUsed(
  cssText: string,
  used: ReadonlyMap<string, ReadonlySet<string>>,
): boolean {
  const family = /font-family\s*:\s*([^;}]+)/i.exec(cssText)?.[1];
  const range = /unicode-range\s*:\s*([^;}]+)/i.exec(cssText)?.[1];
  if (family === undefined || range === undefined) return true;
  const ranges = parseUnicodeRange(range);
  if (!ranges) return true;
  let known = false;
  for (const name of families(family)) {
    const characters = used.get(name);
    if (!characters) continue;
    known = true;
    for (const character of characters) {
      const point = character.codePointAt(0);
      if (point === undefined) continue;
      for (const [low, high] of ranges) {
        if (point >= low && point <= high) return true;
      }
    }
  }
  return !known;
}

/** Whether the live page is still loading this face (so it shows the fallback). */
export function fontFacePending(cssText: string, status: FaceStatus): boolean {
  const family = /font-family\s*:\s*([^;}]+)/i.exec(cssText)?.[1];
  if (family === undefined) return false;
  const range = /unicode-range\s*:\s*([^;}]+)/i.exec(cssText)?.[1] ?? ALL_CHARACTERS;
  return status(family, range) === 'pending';
}

/**
 * Removes the `@font-face` text nodes of a capture's style element that
 * cannot draw any character it uses, or that the live page has not loaded
 * yet. Returns how many it removed.
 */
export function pruneFontFaces(
  style: Element,
  used: ReadonlyMap<string, ReadonlySet<string>>,
  status: FaceStatus = () => null,
): number {
  let removed = 0;
  for (const node of Array.from(style.childNodes)) {
    if (node.nodeType !== 3) continue;
    const text = node.textContent ?? '';
    if (!text.trimStart().startsWith('@font-face')) continue;
    if (!fontFaceUsed(text, used) || fontFacePending(text, status)) {
      node.remove();
      removed++;
    }
  }
  return removed;
}
