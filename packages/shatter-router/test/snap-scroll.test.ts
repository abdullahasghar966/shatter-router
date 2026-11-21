import { describe, expect, it } from 'vitest';
import { snapScroll } from '../src/capture/clone-session';

describe('snapScroll (ADR-049)', () => {
  it('rounds a fractional scroll offset to whole CSS pixels at ratio 1', () => {
    expect(snapScroll(240.25, 1)).toBe(240);
    expect(snapScroll(240.75, 1)).toBe(241);
    expect(snapScroll(-124.4, 1)).toBe(-124);
    expect(snapScroll(-124.6, 1)).toBe(-125);
  });

  it('rounds to whole device pixels at higher ratios', () => {
    expect(snapScroll(240.25, 2)).toBe(240.5);
    expect(snapScroll(240.2, 2)).toBe(240);
    expect(snapScroll(10.4, 1.5)).toBeCloseTo(10.666667, 5);
  });

  it('leaves whole-pixel offsets alone', () => {
    expect(snapScroll(240, 1)).toBe(240);
    expect(snapScroll(0, 2)).toBe(0);
  });

  it('treats a missing or invalid ratio as 1', () => {
    expect(snapScroll(3.7, 0)).toBe(4);
  });
});
