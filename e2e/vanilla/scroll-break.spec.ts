import type { Page } from '@playwright/test';
import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import { type HookWindow, hookState, waitForIdle } from '../hook';
import {
  compareScreenshots,
  hideCursor,
  pauseAt,
  SEAM_MAX_BLOCK_PERCENT,
  seamLimit,
  waitForPause,
  waitForShatterReady,
} from '../seam';

/**
 * Scroll-driven breaking (ADR-064): the card breaks as its section scrolls. The
 * section's pinned range is [0, 1]: at 0 the page is whole, at 1 the card is
 * broken and hidden, and in between the break is scrubbed by the scroll.
 */

const BASE = APPS.vanilla;
const QUERY = '?debug&budget=5000&seed=7';

async function openScroll(page: Page): Promise<void> {
  await page.goto(`${BASE}/scroll${QUERY}`);
  await waitForShatterReady(page);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
}

/** Scrolls so the section is at `progress` (0..1) through its pinned range. */
async function scrollToProgress(page: Page, progress: number): Promise<void> {
  await page.evaluate((p) => {
    const section = document.querySelector<HTMLElement>('.scroll-break-section');
    const pin = document.querySelector<HTMLElement>('.scroll-break-pin');
    if (!section || !pin) throw new Error('no scroll section');
    const top = section.getBoundingClientRect().top + window.scrollY;
    const range = section.offsetHeight - pin.offsetHeight;
    window.scrollTo(0, Math.round(top) + Math.round(p * range));
  }, progress);
}

function clipOf(page: Page): Promise<string> {
  return page.evaluate(
    () => document.querySelector<HTMLElement>('.scroll-break-target')?.style.clipPath ?? '',
  );
}

/** True while the break's overlay is on screen (a popover in the top layer). */
function overlayShown(page: Page): Promise<boolean> {
  return page.evaluate(() => document.querySelector(':popover-open') !== null);
}

test.describe('scroll-driven breaking (ADR-064)', () => {
  test('the first frame of a scroll break matches the live page', async ({ page }, testInfo) => {
    await openScroll(page);
    await hideCursor(page);
    await pauseAt(page, 'scrubbed');
    // Scrolling into the pinned range prepares the break and stops at the pause:
    // the overlay is not shown yet, so the page is live.
    await scrollToProgress(page, 0);
    await waitForPause(page, 'scrubbed');
    const live = await page.screenshot();
    await page.evaluate(() => (window as HookWindow).__SHATTER_TEST__?.resume());
    await expect.poll(() => overlayShown(page)).toBe(true);
    const overlay = await page.screenshot();
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    const result = await compareScreenshots(
      testInfo,
      'scroll-first-frame',
      live,
      overlay,
      Math.max(0, Math.round(Math.min(dpr, 2)) - 1),
    );
    console.log(
      `[seam] ${testInfo.project.name} scroll first frame: ${result.percent.toFixed(4)} % differ (raw ${result.rawPercent.toFixed(4)} %, worst block ${result.worstBlockPercent.toFixed(1)} %)`,
    );
    expect(result.percent).toBeLessThanOrEqual(seamLimit(testInfo.project.name, dpr));
    expect(result.worstBlockPercent).toBeLessThanOrEqual(SEAM_MAX_BLOCK_PERCENT);
    expect(await clipOf(page)).toBe('');
  });

  test('at the end of the range the card is broken but still in the accessibility tree', async ({
    page,
  }) => {
    await openScroll(page);
    await scrollToProgress(page, 0);
    await expect.poll(() => overlayShown(page)).toBe(true);
    await scrollToProgress(page, 1);
    await expect.poll(() => clipOf(page)).toBe('inset(100%)');
    // Hidden by clip-path, not by display: the heading is still there for readers.
    await expect(page.getByRole('heading', { name: 'Scroll', exact: true })).toHaveCount(1);
  });

  test('scrolling back reassembles the card as it was', async ({ page }, testInfo) => {
    await openScroll(page);
    await hideCursor(page);
    await scrollToProgress(page, 0);
    await expect.poll(() => overlayShown(page)).toBe(true);
    const first = await page.screenshot();
    await scrollToProgress(page, 1);
    await expect.poll(() => clipOf(page)).toBe('inset(100%)');
    await scrollToProgress(page, 0);
    await expect.poll(() => clipOf(page)).toBe('');
    await expect.poll(() => overlayShown(page)).toBe(true);
    const again = await page.screenshot();
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    const result = await compareScreenshots(
      testInfo,
      'scroll-reassembled',
      first,
      again,
      Math.max(0, Math.round(Math.min(dpr, 2)) - 1),
    );
    expect(result.percent).toBeLessThanOrEqual(seamLimit(testInfo.project.name, dpr));
    expect((await hookState(page)).textures).toBeGreaterThan(0);
  });

  test('the scrubbed overlay does not block a link click', async ({ page }) => {
    await openScroll(page);
    await scrollToProgress(page, 0.5);
    await expect.poll(() => overlayShown(page)).toBe(true);
    // A click on the header link goes through the overlay and navigates.
    await page.locator('.site-header nav a[href="/"]').click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
    // The navigation is an ordinary timed transition: let it finish first.
    await waitForIdle(page, 15_000);
    expect((await hookState(page)).textures).toBe(0);
  });

  test('under reduced motion nothing breaks', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    try {
      await openScroll(page);
      await scrollToProgress(page, 0.5);
      // The break is not set up at all: the page stays whole. Nothing to wait for,
      // so a short settle time gives a set-up break the chance to show itself.
      await page.waitForTimeout(300);
      expect(await overlayShown(page)).toBe(false);
      expect(await clipOf(page)).toBe('');
    } finally {
      await context.close();
    }
  });

  test('navigating away stops the break and leaves no pieces behind', async ({ page }) => {
    await openScroll(page);
    await scrollToProgress(page, 0.5);
    await expect.poll(() => clipOf(page)).toBe('inset(100%)');
    await page.locator('.site-header nav a[href="/"]').click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
    await waitForIdle(page, 15_000);
    expect(await overlayShown(page)).toBe(false);
    expect((await hookState(page)).textures).toBe(0);
  });
});
