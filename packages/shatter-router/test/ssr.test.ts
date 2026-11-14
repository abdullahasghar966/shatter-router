// @vitest-environment node
import { describe, expect, it } from 'vitest';

describe('SSR safety', () => {
  it('imports the core entry without a DOM', async () => {
    const mod = await import('../src/index');
    expect(mod.isBrowser()).toBe(false);
    expect(mod.prefersReducedMotion()).toBe(false);
  });

  it('creates an instance and still commits without a DOM', async () => {
    const { createShatter } = await import('../src/index');
    const shatter = createShatter({ debug: true });
    let committed = false;
    await shatter.transition({
      commit: () => {
        committed = true;
      },
    });
    expect(committed).toBe(true);
    shatter.destroy();
  });
});
