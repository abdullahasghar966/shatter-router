import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import { type HookWindow, waitForIdle } from '../hook';
import { waitForShatterReady } from '../seam';

const BASE = APPS.vanilla;
/** Short motion and few shards: the test is about leaks, not looks. */
const QUERY = '?debug&budget=5000&seed=7&duration=60&shards=40';
const ROUNDS = 100;

test.describe('vanilla example: memory', () => {
  test(`${ROUNDS} consecutive transitions leak neither JS heap nor GPU textures`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'heap measurement uses the Chrome DevTools Protocol');
    test.setTimeout(240_000);
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    const cdp = await page.context().newCDPSession(page);
    const heap = async (): Promise<number> => {
      await cdp.send('HeapProfiler.collectGarbage');
      await cdp.send('HeapProfiler.collectGarbage');
      const { usedSize } = await cdp.send('Runtime.getHeapUsage');
      return usedSize;
    };

    const run = async (count: number): Promise<number[]> =>
      page.evaluate(async (n) => {
        const hook = (window as HookWindow).__SHATTER_TEST__;
        if (!hook) throw new Error('debug hook missing');
        const textures: number[] = [];
        const links = ['/work', '/about', '/'];
        for (let i = 0; i < n; i++) {
          const target = links[i % links.length] ?? '/';
          document.querySelector<HTMLAnchorElement>(`nav a[href="${target}"]`)?.click();
          // Wait for this transition to end before starting the next one.
          await new Promise<void>((resolve) => {
            const check = (): void => {
              if (hook.state() === 'idle' && location.pathname === target) resolve();
              else setTimeout(check, 5);
            };
            setTimeout(check, 5);
          });
          if (hook.lastFallback) throw new Error(`fell back: ${hook.lastFallback}`);
          textures.push(hook.textureCount());
        }
        return textures;
      }, count);

    // Warm up: JIT, caches, the capture library's per-tag style cache.
    await run(10);
    await waitForIdle(page);
    const before = await heap();
    const textures = await run(ROUNDS);
    await waitForIdle(page);
    const after = await heap();

    const growth = after - before;
    console.log(
      `[memory] ${ROUNDS} transitions: heap ${(before / 1e6).toFixed(2)} MB → ${(after / 1e6).toFixed(2)} MB (${growth >= 0 ? '+' : ''}${(growth / 1e3).toFixed(0)} kB), live textures after each: max ${Math.max(...textures)}`,
    );
    expect(textures.every((count) => count === 0)).toBe(true);
    // "No growth beyond noise": allow 1 MB for allocator and JIT noise.
    expect(growth).toBeLessThan(1_000_000);
  });
});
