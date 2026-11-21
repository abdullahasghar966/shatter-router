import { describe, expect, it } from 'vitest';
import { settleScroll, snapScroll } from '../src/capture/clone-session';

describe('snapScroll (ADR-049): the scroll amount as the browser draws it', () => {
  it('rounds a fractional scroll down to whole CSS pixels at ratio 1 (as Firefox paints)', () => {
    expect(snapScroll(240.25, 1)).toBe(240);
    expect(snapScroll(240.5, 1)).toBe(240);
    expect(snapScroll(240.75, 1)).toBe(240);
  });

  it('rounds down to whole device pixels at higher ratios', () => {
    expect(snapScroll(240.25, 2)).toBe(240);
    expect(snapScroll(240.75, 2)).toBe(240.5);
    expect(snapScroll(10.4, 1.5)).toBeCloseTo(10, 6);
  });

  it('leaves whole-pixel offsets alone, despite float noise', () => {
    expect(snapScroll(240, 1)).toBe(240);
    expect(snapScroll(0, 2)).toBe(0);
    expect(snapScroll(0.1 + 0.2 + 2.7, 1)).toBe(3);
  });

  it('rounds toward zero for a negative scroll (right-to-left scrollers)', () => {
    expect(snapScroll(-12.75, 1)).toBe(-12);
  });

  it('treats a missing or invalid ratio as 1', () => {
    expect(snapScroll(3.7, 0)).toBe(3);
  });
});

describe('settleScroll (ADR-049)', () => {
  function fakeWindow(scrollX: number, scrollY: number, devicePixelRatio = 1) {
    const calls: ScrollToOptions[] = [];
    const win = {
      scrollX,
      scrollY,
      devicePixelRatio,
      scrollTo(options: ScrollToOptions) {
        calls.push(options);
      },
    } as unknown as Window;
    return { win, calls };
  }

  it('moves a fractional scroll to the whole device pixel below, instantly', () => {
    const { win, calls } = fakeWindow(0, 240.75);
    settleScroll(win);
    expect(calls).toEqual([{ left: 0, top: 240, behavior: 'instant' }]);
  });

  it('keeps half device pixels at ratio 2', () => {
    const { win, calls } = fakeWindow(3.3, 240.75, 2);
    settleScroll(win);
    expect(calls).toEqual([{ left: 3, top: 240.5, behavior: 'instant' }]);
  });

  it('does nothing at a whole-pixel scroll (Chromium, WebKit)', () => {
    const { win, calls } = fakeWindow(0, 240);
    settleScroll(win);
    expect(calls).toEqual([]);
  });
});
