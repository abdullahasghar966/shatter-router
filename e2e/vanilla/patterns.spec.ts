import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import {
  clearLifecycleEvents,
  FULL_EFFECT,
  hookState,
  lifecycleEvents,
  waitForIdle,
} from '../hook';
import {
  compareScreenshots,
  pauseAt,
  resumeAndFinish,
  SEAM_MAX_BLOCK_PERCENT,
  seamLimit,
  waitForPause,
  waitForShatterReady,
} from '../seam';

/** Every fracture pattern (ADR-053): plays, lands, and its cells at rest are the page. */

const BASE = APPS.vanilla;
const PATTERNS = ['impact', 'radial', 'rings', 'triangles', 'hex', 'bricks', 'tiles', 'strips'];

for (const pattern of PATTERNS) {
  const query = `?debug&budget=5000&seed=7&duration=300&pattern=${pattern}`;

  test(`pattern ${pattern}: plays and lands`, async ({ page }) => {
    await page.goto(`${BASE}/${query}`);
    await waitForShatterReady(page);
    await clearLifecycleEvents(page);
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await expect.poll(() => lifecycleEvents(page)).toEqual(FULL_EFFECT);
    await waitForIdle(page);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    const state = await hookState(page);
    expect(state.fallback).toBeNull();
    expect(state.fracture?.shardCount).toBeGreaterThanOrEqual(6);
  });

  test(`pattern ${pattern}: the fractured page at rest matches the live page`, async ({
    page,
  }, testInfo) => {
    await page.goto(`${BASE}/${query}`);
    await waitForShatterReady(page);
    const link = page.getByRole('link', { name: 'Work', exact: true });
    await link.hover();
    const live = await page.screenshot();
    await pauseAt(page, 'fractured');
    await link.click();
    await waitForPause(page, 'fractured');
    const overlay = await page.screenshot();
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    const result = await compareScreenshots(
      testInfo,
      `first-${pattern}`,
      live,
      overlay,
      Math.max(0, Math.round(Math.min(dpr, 2)) - 1),
    );
    console.log(
      `[seam] ${testInfo.project.name} pattern ${pattern}: ${result.percent.toFixed(4)} % differ (raw ${result.rawPercent.toFixed(4)} %, worst block ${result.worstBlockPercent.toFixed(1)} %)`,
    );
    expect(result.percent).toBeLessThanOrEqual(seamLimit(testInfo.project.name, dpr));
    expect(result.worstBlockPercent).toBeLessThanOrEqual(SEAM_MAX_BLOCK_PERCENT);
    await resumeAndFinish(page);
  });
}
