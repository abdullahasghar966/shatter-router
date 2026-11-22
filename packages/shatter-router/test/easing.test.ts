import { describe, expect, it } from 'vitest';
import { effectName } from '../src/core/compose';
import { easeTime, type Easing, mirrorEasing } from '../src/core/easing';
import { composeEffect } from '../src/engine/compose';
import { reverseEffect } from '../src/engine/effects/reverse';
import { shatterEffect } from '../src/engine/effects/shatter';

/** Easing of the motion's time (ADR-059). */

const EASINGS: readonly Easing[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];

describe('easeTime', () => {
  it.each(EASINGS)(
    '%s keeps both ends, rises monotonically and leaves time outside the phase',
    (easing) => {
      const D = 1.2;
      expect(easeTime(easing, 0, D)).toBe(0);
      expect(easeTime(easing, D, D)).toBe(D);
      expect(easeTime(easing, -1, D)).toBe(-1);
      expect(easeTime(easing, 3, D)).toBe(3);
      let previous = 0;
      for (let i = 1; i < 100; i++) {
        const value = easeTime(easing, (i / 100) * D, D);
        expect(value).toBeGreaterThan(previous);
        expect(value).toBeLessThan(D);
        previous = value;
      }
    },
  );

  it('paces as named: ease-in starts slow, ease-out starts fast', () => {
    expect(easeTime('ease-in', 0.25, 1)).toBeCloseTo(0.0625, 10);
    expect(easeTime('ease-out', 0.25, 1)).toBeCloseTo(0.4375, 10);
    expect(easeTime('ease-in-out', 0.5, 1)).toBeCloseTo(0.5, 10);
    expect(easeTime(undefined, 0.3, 1)).toBe(0.3);
  });

  it.each(EASINGS)('the mirrored %s retraces it exactly: D − f′(t) = f(D − t)', (easing) => {
    const D = 0.9;
    const mirrored = mirrorEasing(easing);
    for (let i = 0; i <= 50; i++) {
      const t = (i / 50) * D;
      expect(D - easeTime(mirrored, t, D)).toBeCloseTo(easeTime(easing, D - t, D), 10);
    }
  });
});

describe('easing in compositions and reverses', () => {
  it('a composition carries its easing and is named after it', () => {
    const spec = { motion: 'shatter', timing: { easing: 'ease-in' } } as const;
    expect(composeEffect(spec, shatterEffect).easing).toBe('ease-in');
    expect(effectName(spec)).toBe('shatter easing=ease-in');
  });

  it('the reverse plays the mirrored easing', () => {
    const eased = composeEffect(
      { motion: 'shatter', timing: { easing: 'ease-in' } },
      shatterEffect,
    );
    expect(reverseEffect(eased).easing).toBe('ease-out');
    expect(reverseEffect(shatterEffect).easing).toBeUndefined();
  });
});
