import { describe, expect, it } from 'vitest';
import {
  fontFacePending,
  fontFaceUsed,
  liveFaceStatus,
  parseUnicodeRange,
  pruneFontFaces,
} from '../src/capture/fonts';

const LATIN =
  'U+0-FF, U+131, U+152-153, U+2BB-2BC, U+2C6, U+2DA, U+2DC, U+304, U+308, U+329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const VIETNAMESE = 'U+102-103, U+110-111, U+128-129, U+168-169, U+1A0-1A1, U+1AF-1B0, U+1EA0-1EF9';
const CYRILLIC = 'U+301, U+400-45F, U+490-491, U+4B0-4B1, U+2116';

function face(family: string, range: string | null): string {
  return `@font-face { font-family: ${family}; src: url("data:font/woff2;base64,d09GMgABAAAA") format("woff2"); font-weight: 200 800;${range === null ? '' : ` unicode-range: ${range};`} }\n`;
}

const USED = new Map([
  ['__bricolage_grotesque_abc', new Set(['B', 'r', 'e', 'a', 'k', ' ', '.', '→'])],
  ['__martian_mono_def', new Set(['E', 'F', 'C', 'T', 'S', '0', '1'])],
]);

describe('parseUnicodeRange (ADR-051)', () => {
  it('reads single points, ranges and wildcards', () => {
    expect(parseUnicodeRange('U+0-FF, U+131, U+4??')).toEqual([
      [0, 0xff],
      [0x131, 0x131],
      [0x400, 0x4ff],
    ]);
  });

  it('refuses what it cannot read', () => {
    expect(parseUnicodeRange('latin')).toBeNull();
    expect(parseUnicodeRange('')).toBeNull();
    expect(parseUnicodeRange('U+4??-5FF')).toBeNull();
  });
});

describe('fontFaceUsed (ADR-051)', () => {
  it('keeps a subset that draws a used character of its family', () => {
    expect(fontFaceUsed(face("'__Bricolage_Grotesque_abc'", LATIN), USED)).toBe(true);
    expect(fontFaceUsed(face('__Martian_Mono_def', LATIN), USED)).toBe(true);
  });

  it('drops subsets of a used family that draw none of its characters', () => {
    expect(fontFaceUsed(face("'__Bricolage_Grotesque_abc'", VIETNAMESE), USED)).toBe(false);
    expect(fontFaceUsed(face('__Martian_Mono_def', CYRILLIC), USED)).toBe(false);
  });

  it('keeps a face when in doubt', () => {
    // No unicode-range: one file for every character.
    expect(fontFaceUsed(face('__Martian_Mono_def', null), USED)).toBe(true);
    // A family the capture has no record of.
    expect(fontFaceUsed(face('Other', CYRILLIC), USED)).toBe(true);
    // An unreadable range.
    expect(fontFaceUsed(face('__Martian_Mono_def', 'cyrillic'), USED)).toBe(true);
  });

  it('matches a character outside the first range of a list', () => {
    const arrows = 'U+2190-2199';
    expect(fontFaceUsed(face("'__Bricolage_Grotesque_abc'", `U+400-45F, ${arrows}`), USED)).toBe(
      true,
    );
  });
});

describe('pruneFontFaces (ADR-051)', () => {
  it('removes only the unused @font-face text nodes', () => {
    const style = document.createElement('style');
    style.append(
      document.createTextNode('.a { color: red }\n'),
      document.createTextNode(face("'__Bricolage_Grotesque_abc'", LATIN)),
      document.createTextNode(face("'__Bricolage_Grotesque_abc'", VIETNAMESE)),
      document.createTextNode(face('__Martian_Mono_def', CYRILLIC)),
      document.createTextNode(face('__Martian_Mono_def', LATIN)),
    );
    expect(pruneFontFaces(style, USED)).toBe(2);
    const left = style.textContent;
    expect(left).toContain('.a { color: red }');
    expect(left).not.toContain('U+1EA0-1EF9');
    expect(left).not.toContain('U+400-45F');
    expect(left.match(/@font-face/g)).toHaveLength(2);
  });
});

describe('faces the live page has not loaded (ADR-051)', () => {
  function fakeDocument(faces: { family: string; unicodeRange: string; status: string }[]) {
    return {
      fonts: {
        forEach: (fn: (face: unknown) => void) => {
          faces.forEach(fn);
        },
      },
    } as unknown as Document;
  }

  it('drops a face still loading, so the copy shows the fallback the page shows', () => {
    const status = liveFaceStatus(
      fakeDocument([
        { family: '"__Martian_Mono_def"', unicodeRange: LATIN, status: 'loading' },
        { family: "'__Bricolage_Grotesque_abc'", unicodeRange: LATIN, status: 'loaded' },
      ]),
    );
    expect(fontFacePending(face('__Martian_Mono_def', LATIN), status)).toBe(true);
    expect(fontFacePending(face("'__Bricolage_Grotesque_abc'", LATIN), status)).toBe(false);
    const style = document.createElement('style');
    style.append(
      document.createTextNode(face('__Martian_Mono_def', LATIN)),
      document.createTextNode(face("'__Bricolage_Grotesque_abc'", LATIN)),
    );
    expect(pruneFontFaces(style, USED, status)).toBe(1);
    expect(style.textContent).toContain('__Bricolage_Grotesque_abc');
  });

  it('keeps faces it cannot match, and faces loaded under any weight', () => {
    const status = liveFaceStatus(
      fakeDocument([
        { family: 'Other', unicodeRange: 'U+0-10FFFF', status: 'unloaded' },
        { family: '__Martian_Mono_def', unicodeRange: LATIN, status: 'unloaded' },
        { family: '__Martian_Mono_def', unicodeRange: LATIN, status: 'loaded' },
      ]),
    );
    expect(fontFacePending(face('__Martian_Mono_def', LATIN), status)).toBe(false);
    expect(fontFacePending(face('Unknown', LATIN), status)).toBe(false);
    // No unicode-range on either side: the whole range.
    expect(fontFacePending(face('Other', null), status)).toBe(true);
  });
});
