import { describe, expect, it, vi } from 'vitest';
import { isBrowser, prefersReducedMotion } from '../src/core/env';

describe('env', () => {
  it('detects a DOM environment', () => {
    expect(isBrowser()).toBe(true);
  });

  it('reads prefers-reduced-motion', () => {
    const spy = vi
      .spyOn(window, 'matchMedia')
      .mockImplementation(
        (query: string) => ({ matches: query.includes('reduce') }) as MediaQueryList,
      );
    expect(prefersReducedMotion()).toBe(true);
    spy.mockRestore();
  });
});
