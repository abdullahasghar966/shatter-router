import type { Page } from '@playwright/test';
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

/** Interaction and sound (ADR-060): cursor, hold to charge, drag to tear, keyboard, reduced motion. */

const BASE = APPS.vanilla;
const QUERY = '?debug&budget=5000&seed=7&duration=400&interaction';

interface InteractionHook {
  lastIntensity: number | null;
  lastTear: boolean;
  lastSound: string | null;
}

function interactionHook(page: Page): Promise<InteractionHook> {
  return page.evaluate(() => {
    const hook = (window as HookWindow & { __SHATTER_TEST__?: InteractionHook }).__SHATTER_TEST__;
    return {
      lastIntensity: hook?.lastIntensity ?? null,
      lastTear: hook?.lastTear ?? false,
      lastSound: hook?.lastSound ?? null,
    };
  });
}

/** Waits until the lazy interaction chunk has put its cursor in the page. */
async function waitForCursor(page: Page): Promise<void> {
  await page.mouse.move(40, 40);
  await expect(page.locator('[data-shatter-cursor]')).toHaveCount(1, { timeout: 10_000 });
}

async function cursorOpacity(page: Page): Promise<string | null> {
  return page.evaluate(
    () => document.querySelector<HTMLElement>('[data-shatter-cursor]')?.style.opacity ?? null,
  );
}

test.describe('vanilla example: interaction', () => {
  test('the cursor follows the pointer, is decorative and steps aside during a transition', async ({
    page,
  }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await waitForCursor(page);
    const cursor = page.locator('[data-shatter-cursor]');
    await expect(cursor).toHaveAttribute('aria-hidden', 'true');
    await expect(cursor).toHaveAttribute('data-shatter-ignore', '');
    await page.mouse.move(300, 200);
    await expect.poll(() => cursorOpacity(page)).toBe('1');
    // The browser may normalise the transform (`300.0px` reads back as `300px`): compare numbers.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const transform =
            document.querySelector<HTMLElement>('[data-shatter-cursor]')?.style.transform ?? '';
          const match = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(transform);
          return match ? [Number(match[1]), Number(match[2])] : null;
        }),
      )
      .toEqual([300, 200]);
    await pauseAt(page, 'fractured');
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await waitForPause(page, 'fractured');
    expect(await cursorOpacity(page)).toBe('0');
    await resumeAndFinish(page);
    await page.mouse.move(320, 220);
    await expect.poll(() => cursorOpacity(page)).toBe('1');
  });

  test('the cursor is never part of the glass: the first frame is the page without it', async ({
    page,
  }, testInfo) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await waitForCursor(page);
    const link = page.getByRole('link', { name: 'Work', exact: true });
    await link.hover();
    // The page as the glass should show it: everything but the cursor.
    await page.evaluate(() => {
      const cursor = document.querySelector<HTMLElement>('[data-shatter-cursor]');
      if (cursor) cursor.style.visibility = 'hidden';
    });
    const live = await page.screenshot();
    await page.evaluate(() => {
      const cursor = document.querySelector<HTMLElement>('[data-shatter-cursor]');
      if (cursor) cursor.style.visibility = '';
    });
    await pauseAt(page, 'fractured');
    await link.click();
    await waitForPause(page, 'fractured');
    const overlay = await page.screenshot();
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    const result = await compareScreenshots(
      testInfo,
      'first-with-cursor',
      live,
      overlay,
      Math.max(0, Math.round(Math.min(dpr, 2)) - 1),
    );
    console.log(
      `[seam] ${testInfo.project.name} first-with-cursor: ${result.percent.toFixed(4)} % differ (raw ${result.rawPercent.toFixed(4)} %, worst block ${result.worstBlockPercent.toFixed(1)} %)`,
    );
    expect(result.percent).toBeLessThanOrEqual(seamLimit(testInfo.project.name, dpr));
    expect(result.worstBlockPercent).toBeLessThanOrEqual(SEAM_MAX_BLOCK_PERCENT);
    await resumeAndFinish(page);
  });

  test('a click hits at the default strength; holding the press hits harder', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await waitForCursor(page);
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await waitForIdle(page);
    expect((await interactionHook(page)).lastIntensity).toBe(0.5);

    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await waitForCursor(page);
    const box = await page.getByRole('link', { name: 'Work', exact: true }).boundingBox();
    if (!box) throw new Error('no link box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await clearLifecycleEvents(page);
    await page.mouse.down();
    await page.waitForTimeout(1100);
    await page.mouse.up();
    await expect.poll(() => lifecycleEvents(page)).toEqual(FULL_EFFECT);
    await waitForIdle(page);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    const hook = await interactionHook(page);
    expect(hook.lastIntensity).toBe(1);
    expect(hook.lastTear).toBe(false);
  });

  test('dragging across a link tears the page along the drag and navigates', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await waitForCursor(page);
    const box = await page.getByRole('link', { name: 'Work', exact: true }).boundingBox();
    if (!box) throw new Error('no link box');
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(start.x, start.y);
    await clearLifecycleEvents(page);
    await page.mouse.down();
    // Across the page, released away from the link.
    await page.mouse.move(start.x - 200, start.y + 160, { steps: 12 });
    await page.mouse.move(start.x - 420, start.y + 260, { steps: 12 });
    await page.mouse.up();
    await expect.poll(() => lifecycleEvents(page)).toEqual(FULL_EFFECT);
    await waitForIdle(page);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    expect((await interactionHook(page)).lastTear).toBe(true);
    expect((await hookState(page)).fallback).toBeNull();
  });

  test('a torn page at rest is still the page', async ({ page }, testInfo) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await waitForCursor(page);
    const link = page.getByRole('link', { name: 'Work', exact: true });
    const box = await link.boundingBox();
    if (!box) throw new Error('no link box');
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const end = { x: start.x - 300, y: start.y + 200 };
    // A tear is captured on release, with the pointer at its end (ADR-060):
    // the reference is the page with the pointer there, without the cursor.
    await page.mouse.move(end.x, end.y);
    await page.evaluate(() => {
      const cursor = document.querySelector<HTMLElement>('[data-shatter-cursor]');
      if (cursor) cursor.style.visibility = 'hidden';
    });
    const live = await page.screenshot();
    await page.mouse.move(start.x, start.y);
    await pauseAt(page, 'fractured');
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 15 });
    await page.mouse.up();
    await waitForPause(page, 'fractured');
    const overlay = await page.screenshot();
    expect((await interactionHook(page)).lastTear).toBe(true);
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    const result = await compareScreenshots(
      testInfo,
      'first-torn',
      live,
      overlay,
      Math.max(0, Math.round(Math.min(dpr, 2)) - 1),
    );
    console.log(
      `[seam] ${testInfo.project.name} first-torn: ${result.percent.toFixed(4)} % differ (raw ${result.rawPercent.toFixed(4)} %, worst block ${result.worstBlockPercent.toFixed(1)} %)`,
    );
    expect(result.percent).toBeLessThanOrEqual(seamLimit(testInfo.project.name, dpr));
    expect(result.worstBlockPercent).toBeLessThanOrEqual(SEAM_MAX_BLOCK_PERCENT);
    await resumeAndFinish(page);
  });

  test('the keyboard navigates at the default strength', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'Work', exact: true }).focus();
    await clearLifecycleEvents(page);
    await page.keyboard.press('Enter');
    await expect.poll(() => lifecycleEvents(page)).toEqual(FULL_EFFECT);
    await waitForIdle(page);
    const hook = await interactionHook(page);
    expect(hook.lastIntensity).toBe(0.5);
    expect(hook.lastTear).toBe(false);
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('no cursor kit is loaded', async ({ page }) => {
      await page.goto(`${BASE}/${QUERY}`);
      await waitForShatterReady(page);
      await page.mouse.move(100, 100);
      await page.waitForTimeout(800);
      await expect(page.locator('[data-shatter-cursor]')).toHaveCount(0);
    });
  });

  test('sound plays after the first gesture', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Web Audio may not start in headless WebKit/Firefox');
    await page.goto(`${BASE}/${QUERY}&sound`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await waitForIdle(page);
    await expect.poll(async () => (await interactionHook(page)).lastSound).toBe('shatter');
    // Back reverses: the cue names the base motion.
    await page.goBack();
    await waitForIdle(page);
    await expect.poll(async () => (await interactionHook(page)).lastSound).toBe('shatter');
  });
});
