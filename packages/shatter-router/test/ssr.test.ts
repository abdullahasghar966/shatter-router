// @vitest-environment node
import { describe, expect, it } from 'vitest';

describe('SSR safety', () => {
  it('imports the core entry without a DOM', async () => {
    const mod = await import('../src/index');
    expect(mod.isBrowser()).toBe(false);
    expect(mod.prefersReducedMotion()).toBe(false);
  });
});
