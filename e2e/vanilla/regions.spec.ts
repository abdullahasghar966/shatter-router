import type { Page, TestInfo } from '@playwright/test';
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
  hideCursor,
  pauseAt,
  resumeAndFinish,
  SEAM_MAX_BLOCK_PERCENT,
  seamLimit,
  waitForPause,
  waitForShatterReady,
} from '../seam';

/**
 * Regions (ADR-063): `transition({ target })` breaks one element in place. The
 * example's /regions page has cards with long text above and below them.
 */

const BASE = APPS.vanilla;
const QUERY = '?debug&budget=5000&seed=7';

interface Hook {
  lastFallback: string | null;
  lastFracture: { shardCount: number } | null;
}

async function hook(page: Page): Promise<Hook> {
  return page.evaluate(() => (window as unknown as { __SHATTER_TEST__: Hook }).__SHATTER_TEST__);
}

async function openRegions(page: Page): Promise<void> {
  await page.goto(`${BASE}/regions${QUERY}`);
  await waitForShatterReady(page);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
}

/** Clicks a card by its centre, the way a visitor would. */
async function clickCard(page: Page, index: number): Promise<void> {
  const card = page.locator('.region-card').nth(index);
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  if (!box) throw new Error('card has no box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

test.describe('regions (ADR-063)', () => {
  test('the first frame of the region matches the live page', async ({
    page,
  }, testInfo: TestInfo) => {
    await openRegions(page);
    await hideCursor(page);
    const live = await page.screenshot();
    await pauseAt(page, 'fractured');
    await clickCard(page, 0);
    await waitForPause(page, 'fractured');
    const overlay = await page.screenshot();
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    const result = await compareScreenshots(
      testInfo,
      'region-first-shatter',
      live,
      overlay,
      Math.max(0, Math.round(Math.min(dpr, 2)) - 1),
    );
    console.log(
      `[seam] ${testInfo.project.name} region first frame: ${result.percent.toFixed(4)} % differ (raw ${result.rawPercent.toFixed(4)} %, worst block ${result.worstBlockPercent.toFixed(1)} %)`,
    );
    expect(result.percent).toBeLessThanOrEqual(seamLimit(testInfo.project.name, dpr));
    expect(result.worstBlockPercent).toBeLessThanOrEqual(SEAM_MAX_BLOCK_PERCENT);
    await resumeAndFinish(page);
  });

  test('the region breaks without scrolling the page', async ({ page }) => {
    await openRegions(page);
    // The wide card is near the bottom: the page is scrolled to it first.
    await page.locator('.region-card.wide').scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(0);
    await clearLifecycleEvents(page);
    await clickCard(page, 3);
    await expect.poll(() => lifecycleEvents(page), { timeout: 15_000 }).toEqual(FULL_EFFECT);
    await waitForIdle(page, 15_000);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    expect((await hook(page)).lastFallback).toBeNull();
  });

  test('the live page around the region does not move', async ({ page }) => {
    await openRegions(page);
    // Every element outside the card keeps its box while the card breaks.
    const boxes = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('main *')]
          .filter((el) => !el.closest('.region-card'))
          .map((el) => {
            const r = el.getBoundingClientRect();
            return [
              Math.round(r.left),
              Math.round(r.top),
              Math.round(r.width),
              Math.round(r.height),
            ].join(',');
          }),
      );
    const before = await boxes();
    await pauseAt(page, 'animating');
    await clickCard(page, 0);
    await waitForPause(page, 'animating');
    expect(await boxes()).toEqual(before);
    await resumeAndFinish(page);
  });

  test('after the break the card is back and the page is as it was', async ({ page }, testInfo) => {
    await openRegions(page);
    await hideCursor(page);
    const live = await page.screenshot();
    await clearLifecycleEvents(page);
    await clickCard(page, 1);
    await expect.poll(() => lifecycleEvents(page), { timeout: 15_000 }).toEqual(FULL_EFFECT);
    await waitForIdle(page, 15_000);
    await page.waitForTimeout(200);
    // Nothing navigated: the commit changed nothing, so the card is the page again.
    expect(new URL(page.url()).pathname).toBe('/regions');
    const after = await page.screenshot();
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    const result = await compareScreenshots(
      testInfo,
      'region-after',
      live,
      after,
      Math.max(0, Math.round(Math.min(dpr, 2)) - 1),
    );
    expect(result.percent).toBeLessThanOrEqual(seamLimit(testInfo.project.name, dpr));
    expect((await hookState(page)).textures).toBe(0);
  });

  test('an element with no visible box falls back and navigation completes', async ({ page }) => {
    await openRegions(page);
    await clearLifecycleEvents(page);
    // A click on a hidden card: its box is empty, so the region is too.
    await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>('.region-card');
      if (!card) throw new Error('no card');
      card.style.display = 'none';
      card.click();
    });
    await expect
      .poll(() => hook(page).then((h) => h.lastFallback), { timeout: 10_000 })
      .toBe('region-empty');
    expect((await hookState(page)).textures).toBe(0);
  });

  test('breaking several regions in a row leaves nothing behind', async ({ page }) => {
    await openRegions(page);
    for (const index of [0, 1, 2]) {
      await clearLifecycleEvents(page);
      await clickCard(page, index);
      await expect.poll(() => lifecycleEvents(page), { timeout: 15_000 }).toEqual(FULL_EFFECT);
      await waitForIdle(page, 15_000);
      expect((await hookState(page)).textures).toBe(0);
    }
    expect((await hook(page)).lastFallback).toBeNull();
  });
});
