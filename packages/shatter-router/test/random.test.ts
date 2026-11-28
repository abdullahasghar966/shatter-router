import { describe, expect, it } from 'vitest';
import { createRandom, mulberry32 } from '../src/core/random';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('stays in [0, 1) and is roughly uniform', () => {
    const rand = mulberry32(42);
    const buckets = new Array<number>(10).fill(0);
    const n = 100_000;
    for (let i = 0; i < n; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const index = Math.floor(v * 10);
      buckets[index] = (buckets[index] ?? 0) + 1;
    }
    for (const count of buckets) {
      expect(Math.abs(count - n / 10)).toBeLessThan(n / 100);
    }
  }, 30_000);

  it('treats seeds as unsigned 32-bit integers', () => {
    expect(mulberry32(-1)()).toBe(mulberry32(0xffffffff)());
  });
});

describe('createRandom', () => {
  it('is deterministic with a seed', () => {
    expect(createRandom(7)()).toBe(mulberry32(7)());
  });

  it('works without a seed', () => {
    const v = createRandom()();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});
