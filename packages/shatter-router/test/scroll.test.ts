import { afterEach, describe, expect, it } from 'vitest';
import { createScrollBreaks, type ScrollBreakHost } from '../src/runtime/scroll';

/**
 * Scroll-driven breaking (ADR-064): the markup rules are checked here; the
 * scrubbing itself needs layout and a GPU, so it is tested end to end.
 */

const host: ScrollBreakHost = {
  load: () => Promise.resolve(null),
  idle: () => true,
  settings: {} as ScrollBreakHost['settings'],
  registry: () => new Map(),
  material: () => undefined,
  pause: () => Promise.resolve(),
};

function markup(
  pinStyle: string,
  sectionStyle: string,
): {
  target: HTMLElement;
  pin: HTMLElement;
  section: HTMLElement;
} {
  const section = document.createElement('section');
  section.setAttribute('style', sectionStyle);
  const pin = document.createElement('div');
  pin.setAttribute('style', pinStyle);
  const target = document.createElement('div');
  pin.append(target);
  section.append(pin);
  document.body.append(section);
  return { target, pin, section };
}

describe('scrollBreak markup rules (ADR-064)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('needs a sticky box around the target', () => {
    const { target, section } = markup('', 'height: 300vh;');
    const breaks = createScrollBreaks(host);
    expect(() => breaks.add(target, { section })).toThrow(RangeError);
    breaks.destroy();
  });

  it('needs the section to contain the sticky box', () => {
    const { target } = markup('position: sticky; top: 0; height: 100vh;', 'height: 300vh;');
    const elsewhere = document.createElement('section');
    document.body.append(elsewhere);
    const breaks = createScrollBreaks(host);
    expect(() => breaks.add(target, { section: elsewhere })).toThrow(/section must contain/);
    breaks.destroy();
  });

  it('needs a section taller than its sticky box', () => {
    // Layout is not run here: every box is empty, so the range is not positive.
    const { target, section } = markup('position: sticky; top: 0; height: 100vh;', '');
    const breaks = createScrollBreaks(host);
    expect(() => breaks.add(target, { section })).toThrow(/taller than its sticky box/);
    breaks.destroy();
  });

  it('rejects a target that is not an HTML element', () => {
    const breaks = createScrollBreaks(host);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    expect(() => breaks.add(svg, {})).toThrow(RangeError);
    breaks.destroy();
  });
});
