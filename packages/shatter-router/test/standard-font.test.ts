import { describe, expect, it } from 'vitest';
import { withStandardFont } from '../src/capture/clone-session';

describe('withStandardFont (ADR-029)', () => {
  it('replaces the keyword alone or inside a list', () => {
    expect(withStandardFont('-webkit-standard', 'sans-serif')).toBe('sans-serif');
    expect(withStandardFont('Inter, -webkit-standard', 'sans-serif')).toBe('Inter, sans-serif');
    expect(withStandardFont('-webkit-standard, serif', 'sans-serif')).toBe('sans-serif, serif');
    expect(withStandardFont('A,-webkit-standard,B', 'serif')).toBe('A, serif,B');
  });

  it('leaves other families alone', () => {
    expect(withStandardFont('Georgia, serif', 'sans-serif')).toBe('Georgia, serif');
    expect(withStandardFont('"my-webkit-standard-font"', 'serif')).toBe(
      '"my-webkit-standard-font"',
    );
  });
});
