import type { Page, TestInfo } from '@playwright/test';
import { expect } from './fixtures';
import {
  clearLifecycleEvents,
  FULL_EFFECT,
  hookState,
  type HookWindow,
  lifecycleEvents,
  waitForIdle,
} from './hook';
import {
  compareScreenshots,
  pauseAt,
  SEAM_MAX_BLOCK_PERCENT,
  seamLimit,
  waitForPause,
  waitForShatterReady,
} from './seam';

/** The effect the last transition played (debug mode). */
export async function lastEffect(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      (window as { __SHATTER_TEST__?: { lastEffect: string | null } }).__SHATTER_TEST__
        ?.lastEffect ?? null,
  );
}

interface MirrorRoute {
  /** URL of the first page, with the debug query. */
  readonly start: string;
  readonly startTitle: string;
  /** Accessible name of the link to the second page. */
  readonly link: string;
  readonly nextTitle: string;
  /** The effect the link plays. */
  readonly effect: string;
}

/**
 * backForward 'mirror' (ADR-047) in an app: Back plays the time reverse of
 * the effect that brought the user to the page, its last frame matches the
 * page returned to, and Forward replays the effect.
 */
export async function expectMirror(
  page: Page,
  testInfo: TestInfo,
  route: MirrorRoute,
): Promise<void> {
  await page.goto(route.start);
  await waitForShatterReady(page);
  await page.getByRole('link', { name: route.link, exact: true }).click();
  await waitForIdle(page);
  await expect(page.locator('h1')).toHaveText(route.nextTitle);
  expect(await lastEffect(page)).toBe(route.effect);

  // Park the pointer on empty margin so no hover style differs.
  await page.mouse.move(4, 400);
  await clearLifecycleEvents(page);
  await pauseAt(page, 'settled');
  await page.goBack();
  await waitForPause(page, 'settled');
  const overlay = await page.screenshot();
  await page.evaluate(() => {
    (window as HookWindow).__SHATTER_TEST__?.resume();
  });
  await expect.poll(() => lifecycleEvents(page)).toEqual(FULL_EFFECT);
  await waitForIdle(page);
  await expect(page.locator('h1')).toHaveText(route.startTitle);
  expect(await lastEffect(page)).toBe(`${route.effect}:reverse`);
  expect((await hookState(page)).fallback).toBeNull();
  // The runtime focuses the new page's heading once the overlay is gone, and
  // WebKit draws a focus ring for it after a Back without a pointer: the
  // overlay never had that ring, so compare the page without it.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  const live = await page.screenshot();
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const result = await compareScreenshots(
    testInfo,
    'last-reverse',
    live,
    overlay,
    Math.max(0, Math.round(Math.min(dpr, 2)) - 1),
  );
  console.log(
    `[seam] ${testInfo.project.name} last ${route.effect}:reverse: ${result.percent.toFixed(4)} % (raw ${result.rawPercent.toFixed(4)} %, worst block ${result.worstBlockPercent.toFixed(1)} %)`,
  );
  expect(result.percent).toBeLessThanOrEqual(seamLimit(testInfo.project.name, dpr));
  expect(result.worstBlockPercent).toBeLessThanOrEqual(SEAM_MAX_BLOCK_PERCENT);

  await clearLifecycleEvents(page);
  await page.goForward();
  await expect.poll(() => lifecycleEvents(page)).toEqual(FULL_EFFECT);
  await waitForIdle(page);
  await expect(page.locator('h1')).toHaveText(route.nextTitle);
  expect(await lastEffect(page)).toBe(route.effect);
}
