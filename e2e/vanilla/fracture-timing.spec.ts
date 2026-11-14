import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import { waitForShatterReady } from '../seam';

const BASE = APPS.vanilla;

interface Timing {
  medianMs: number;
  p95Ms: number;
  runs: number;
}

type HookWindow = Window & {
  __SHATTER_TEST__?: { measureFracture(shards: number, runs: number): Timing | null };
};

// Measures fracture CPU time in each engine at the spec's reference size
// (master prompt 5.1: Worker only if > 4 ms at 160 shards on a mid-range laptop).
// The numbers are printed for context/PROGRESS.md; the assertion is a loose
// ceiling so slow shared CI machines do not fail the build.
test.use({ viewport: { width: 1440, height: 900 } });

test('fracture timing at 1440x900', async ({ page }, testInfo) => {
  await page.goto(`${BASE}/?debug`);
  await waitForShatterReady(page);
  const results = await page.evaluate(() => {
    const hook = (window as HookWindow).__SHATTER_TEST__;
    if (!hook) throw new Error('debug hook missing');
    return {
      40: hook.measureFracture(40, 200),
      90: hook.measureFracture(90, 200),
      160: hook.measureFracture(160, 200),
      400: hook.measureFracture(400, 100),
    };
  });
  for (const [shards, timing] of Object.entries(results)) {
    expect(timing).not.toBeNull();
    console.log(
      `[fracture] ${testInfo.project.name} ${shards} shards @1440x900: median ${timing?.medianMs.toFixed(2) ?? '?'} ms, p95 ${timing?.p95Ms.toFixed(2) ?? '?'} ms`,
    );
  }
  expect(results[160]?.medianMs ?? Infinity).toBeLessThan(40);
});
