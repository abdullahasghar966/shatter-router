import type { Page, TestInfo } from '@playwright/test';
import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import {
  clearLifecycleEvents,
  FULL_EFFECT,
  hookState,
  type HookWindow,
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

/**
 * Every motion (ADR-055), and the five effects of v1: it plays and lands; its
 * motion frozen at t = 0 is the page itself (not only the fractured still);
 * Back plays it in reverse and the last frame is the page returned to.
 */

const BASE = APPS.vanilla;
const MOTIONS = [
  'shatter',
  'explode',
  'implode',
  'crumble',
  'rain',
  'vortex',
  'wind',
  'blinds',
  'domino',
  'slide',
  'fold',
  'melt',
  'ripple',
  'glitch',
] as const;

/** Effects whose last frame is already the new page (they have their own reverses). */
const ENDS_ON_PAGE: readonly string[] = ['flip', 'assemble'];

function query(motion: string): string {
  return `?debug&budget=5000&seed=7&duration=400&motion=${motion}`;
}

function lastEffect(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      (window as HookWindow & { __SHATTER_TEST__?: { lastEffect: string | null } }).__SHATTER_TEST__
        ?.lastEffect ?? null,
  );
}

async function check(
  page: Page,
  testInfo: TestInfo,
  name: string,
  live: Buffer,
  overlay: Buffer,
): Promise<void> {
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const result = await compareScreenshots(
    testInfo,
    name,
    live,
    overlay,
    Math.max(0, Math.round(Math.min(dpr, 2)) - 1),
  );
  console.log(
    `[seam] ${testInfo.project.name} ${name}: ${result.percent.toFixed(4)} % differ (raw ${result.rawPercent.toFixed(4)} %, worst block ${result.worstBlockPercent.toFixed(1)} %)`,
  );
  expect(result.percent).toBeLessThanOrEqual(seamLimit(testInfo.project.name, dpr));
  expect(result.worstBlockPercent).toBeLessThanOrEqual(SEAM_MAX_BLOCK_PERCENT);
}

for (const motion of [...MOTIONS, ...ENDS_ON_PAGE]) {
  test(`${motion}: the motion at t = 0 is the page itself`, async ({ page }, testInfo) => {
    await page.goto(`${BASE}/${query(motion)}`);
    await waitForShatterReady(page);
    const link = page.getByRole('link', { name: 'Work', exact: true });
    await link.hover();
    const live = await page.screenshot();
    await pauseAt(page, 'animating');
    await link.click();
    await waitForPause(page, 'animating');
    // The crack is drawn on purpose before the motion; take it away and
    // freeze the motion at its very start: every piece must be at rest.
    await page.evaluate(() => {
      const hook = (window as HookWindow).__SHATTER_TEST__ as unknown as {
        setCrack(radius: number): void;
        setMotionTime(ms: number): void;
      };
      hook.setCrack(0);
      hook.setMotionTime(0);
    });
    const overlay = await page.screenshot();
    await check(page, testInfo, `motion-zero-${motion}`, live, overlay);
    await resumeAndFinish(page);
  });
}

for (const motion of MOTIONS) {
  test(`${motion}: plays and lands; Back reverses it onto the page`, async ({ page }, testInfo) => {
    await page.goto(`${BASE}/${query(motion)}`);
    await waitForShatterReady(page);
    await clearLifecycleEvents(page);
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await expect.poll(() => lifecycleEvents(page)).toEqual(FULL_EFFECT);
    await waitForIdle(page);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    expect((await hookState(page)).fallback).toBeNull();
    expect(await lastEffect(page)).toBe(motion);

    // Back: the reverse ends exactly on the page returned to.
    await page.mouse.move(4, 400);
    await pauseAt(page, 'settled');
    await page.goBack();
    await waitForPause(page, 'settled');
    const overlay = await page.screenshot();
    await page.evaluate(() => {
      (window as HookWindow).__SHATTER_TEST__?.resume();
    });
    await waitForIdle(page);
    await expect(page.locator('h1')).toHaveText('Break the page.');
    expect(await lastEffect(page)).toBe(`${motion}:reverse`);
    expect((await hookState(page)).fallback).toBeNull();
    // The runtime focuses the new page's heading; WebKit draws a focus ring
    // for it after a Back without a pointer, which the overlay never had.
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    const live = await page.screenshot();
    await check(page, testInfo, `last-${motion}-reverse`, live, overlay);
  });
}
