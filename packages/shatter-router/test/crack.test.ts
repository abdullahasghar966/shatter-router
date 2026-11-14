import { describe, expect, it } from 'vitest';
import { CRACK_DURATION_MS, CRACK_HOLD_MS, crackAt } from '../src/engine/crack';

describe('crack timeline', () => {
  const maxRadius = 1200;

  it('starts invisible: no crack and no flash at t = 0', () => {
    expect(crackAt(0, maxRadius)).toEqual({ radius: 0, flash: 0, done: false });
    expect(crackAt(-5, maxRadius)).toEqual({ radius: 0, flash: 0, done: false });
  });

  it('uses the spec timing: 140 ms to grow, 40 ms hold', () => {
    expect(CRACK_DURATION_MS).toBe(140);
    expect(CRACK_HOLD_MS).toBe(40);
  });

  it('grows monotonically and reaches past the farthest corner at the end', () => {
    let previous = 0;
    for (let t = 1; t <= CRACK_DURATION_MS; t++) {
      const { radius } = crackAt(t, maxRadius);
      expect(radius).toBeGreaterThanOrEqual(previous);
      previous = radius;
    }
    expect(crackAt(CRACK_DURATION_MS, maxRadius).radius).toBeGreaterThan(maxRadius);
  });

  it('races out fast, then slows (ease-out)', () => {
    const quarter = crackAt(CRACK_DURATION_MS / 4, maxRadius).radius;
    expect(quarter).toBeGreaterThan(maxRadius * 0.5);
  });

  it('is done only after the hold', () => {
    expect(crackAt(CRACK_DURATION_MS + CRACK_HOLD_MS - 1, maxRadius).done).toBe(false);
    expect(crackAt(CRACK_DURATION_MS + CRACK_HOLD_MS, maxRadius).done).toBe(true);
  });

  it('flashes briefly at the impact: rises, peaks early, fades to zero', () => {
    const early = crackAt(5, maxRadius).flash;
    const peak = crackAt(18, maxRadius).flash;
    const late = crackAt(60, maxRadius).flash;
    expect(early).toBeGreaterThan(0);
    expect(peak).toBeGreaterThan(early);
    expect(late).toBeLessThan(peak / 4);
    expect(crackAt(CRACK_DURATION_MS, maxRadius).flash).toBe(0);
  });

  it('accepts custom durations', () => {
    expect(crackAt(50, maxRadius, 100, 0).done).toBe(false);
    expect(crackAt(100, maxRadius, 100, 0).done).toBe(true);
    expect(crackAt(1, maxRadius, 0, 0).radius).toBeGreaterThan(maxRadius);
  });
});
