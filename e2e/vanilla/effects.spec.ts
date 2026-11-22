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

const BASE = APPS.vanilla;
const QUERY = '?debug&budget=5000&seed=7&duration=400';
const EFFECTS = ['shatter', 'explode', 'implode', 'flip', 'assemble'] as const;

interface EffectHook {
  lastEffect: string | null;
  lastIncomingCaptureMs: number | null;
}

async function effectHook(page: Page): Promise<EffectHook> {
  return page.evaluate(() => {
    const hook = (window as HookWindow & { __SHATTER_TEST__?: EffectHook }).__SHATTER_TEST__;
    return {
      lastEffect: hook?.lastEffect ?? null,
      lastIncomingCaptureMs: hook?.lastIncomingCaptureMs ?? null,
    };
  });
}

function shiftRadius(dpr: number): number {
  return Math.max(0, Math.round(Math.min(dpr, 2)) - 1);
}

async function check(
  page: Page,
  testInfo: TestInfo,
  name: string,
  live: Buffer,
  overlay: Buffer,
): Promise<void> {
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const result = await compareScreenshots(testInfo, name, live, overlay, shiftRadius(dpr));
  console.log(
    `[seam] ${testInfo.project.name} ${name}: ${result.percent.toFixed(4)} % differ (raw ${result.rawPercent.toFixed(4)} %, worst block ${result.worstBlockPercent.toFixed(1)} %)`,
  );
  expect(result.percent).toBeLessThanOrEqual(seamLimit(testInfo.project.name, dpr));
  expect(result.worstBlockPercent).toBeLessThanOrEqual(SEAM_MAX_BLOCK_PERCENT);
}

test.describe('vanilla example: every effect', () => {
  for (const effect of EFFECTS) {
    test(`${effect} plays and lands on the new route`, async ({ page }) => {
      await page.goto(`${BASE}/effects${QUERY}`);
      await waitForShatterReady(page);
      await clearLifecycleEvents(page);
      await page.getByRole('link', { name: effect, exact: true }).click();
      await expect.poll(() => lifecycleEvents(page)).toEqual(FULL_EFFECT);
      await waitForIdle(page);
      await expect(page).toHaveURL(`${BASE}/work`);
      await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
      const state = await hookState(page);
      expect(state.fallback).toBeNull();
      expect(state.textures).toBe(0);
      expect(state.animation?.frames).toBeGreaterThan(0);
      const { lastEffect, lastIncomingCaptureMs } = await effectHook(page);
      expect(lastEffect).toBe(effect);
      if (effect === 'flip' || effect === 'assemble') {
        expect(lastIncomingCaptureMs).not.toBeNull();
      }
      console.log(
        `[effect] ${test.info().project.name} ${effect}: ${state.animation?.frames ?? 0} frames in ${state.animation?.durationMs.toFixed(0) ?? '?'} ms, incoming capture ${lastIncomingCaptureMs?.toFixed(0) ?? '-'} ms`,
      );
    });

    test(`${effect}: the fractured page at rest matches the live page`, async ({
      page,
    }, testInfo) => {
      await page.goto(`${BASE}/effects${QUERY}`);
      await waitForShatterReady(page);
      const link = page.getByRole('link', { name: effect, exact: true });
      await link.hover();
      const live = await page.screenshot();
      await pauseAt(page, 'fractured');
      await link.click();
      await waitForPause(page, 'fractured');
      const overlay = await page.screenshot();
      await check(page, testInfo, `first-${effect}`, live, overlay);
      await resumeAndFinish(page);
    });
  }

  for (const effect of ['flip', 'assemble'] as const) {
    test(`${effect}: the last frame matches the live new page`, async ({ page }, testInfo) => {
      await page.goto(`${BASE}/effects${QUERY}`);
      await waitForShatterReady(page);
      await pauseAt(page, 'settled');
      await page.getByRole('link', { name: effect, exact: true }).click();
      // Park the pointer on empty margin so no hover style differs.
      await page.mouse.move(4, 400);
      await waitForPause(page, 'settled');
      const overlay = await page.screenshot();
      await page.evaluate(() => {
        (window as HookWindow).__SHATTER_TEST__?.resume();
      });
      await waitForIdle(page);
      await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
      const live = await page.screenshot();
      await check(page, testInfo, `last-${effect}`, live, overlay);
    });
  }

  test("back/forward with backForward 'reverse': shatter back becomes assemble", async ({
    page,
  }) => {
    await page.goto(`${BASE}/${QUERY}&backForward=reverse`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await waitForIdle(page);
    expect((await effectHook(page)).lastEffect).toBe('shatter');
    await clearLifecycleEvents(page);
    await page.goBack();
    await expect.poll(() => lifecycleEvents(page)).toEqual(FULL_EFFECT);
    await waitForIdle(page);
    await expect(page.locator('h1')).toHaveText('Break the page.');
    expect((await effectHook(page)).lastEffect).toBe('assemble');
    expect((await hookState(page)).fallback).toBeNull();
  });

  // backForward: 'mirror' (the default, ADR-047).
  for (const effect of ['shatter', 'explode', 'implode'] as const) {
    test(`Back plays ${effect} in reverse; Forward replays it`, async ({ page }) => {
      await page.goto(`${BASE}/effects${QUERY}`);
      await waitForShatterReady(page);
      await page.getByRole('link', { name: effect, exact: true }).click();
      await waitForIdle(page);
      expect((await effectHook(page)).lastEffect).toBe(effect);

      await clearLifecycleEvents(page);
      await page.goBack();
      await expect.poll(() => lifecycleEvents(page)).toEqual(FULL_EFFECT);
      await waitForIdle(page);
      await expect(page.locator('h1')).toHaveText('Sixteen ways to break.');
      expect((await effectHook(page)).lastEffect).toBe(`${effect}:reverse`);
      expect((await hookState(page)).fallback).toBeNull();

      await clearLifecycleEvents(page);
      await page.goForward();
      await expect.poll(() => lifecycleEvents(page)).toEqual(FULL_EFFECT);
      await waitForIdle(page);
      await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
      expect((await effectHook(page)).lastEffect).toBe(effect);
    });
  }

  for (const effect of ['shatter', 'explode'] as const) {
    test(`${effect}:reverse: the first frame is the page being left`, async ({
      page,
    }, testInfo) => {
      await page.goto(`${BASE}/effects${QUERY}`);
      await waitForShatterReady(page);
      await page.getByRole('link', { name: effect, exact: true }).click();
      await waitForIdle(page);
      await page.mouse.move(4, 400);
      const live = await page.screenshot();
      await pauseAt(page, 'fractured');
      await page.goBack();
      await waitForPause(page, 'fractured');
      const overlay = await page.screenshot();
      await check(page, testInfo, `first-${effect}-reverse`, live, overlay);
      await resumeAndFinish(page);
      await expect(page.locator('h1')).toHaveText('Sixteen ways to break.');
    });

    test(`${effect}:reverse: the last frame matches the page returned to`, async ({
      page,
    }, testInfo) => {
      await page.goto(`${BASE}/effects${QUERY}`);
      await waitForShatterReady(page);
      await page.getByRole('link', { name: effect, exact: true }).click();
      await waitForIdle(page);
      await page.mouse.move(4, 400);
      await pauseAt(page, 'settled');
      await page.goBack();
      await waitForPause(page, 'settled');
      const overlay = await page.screenshot();
      await page.evaluate(() => {
        (window as HookWindow).__SHATTER_TEST__?.resume();
      });
      await waitForIdle(page);
      await expect(page.locator('h1')).toHaveText('Sixteen ways to break.');
      expect((await effectHook(page)).lastEffect).toBe(`${effect}:reverse`);
      const live = await page.screenshot();
      await check(page, testInfo, `last-${effect}-reverse`, live, overlay);
    });
  }

  // Compositions of parts (ADR-048): the example registers 'sweep', shatter's
  // motion with a left-to-right stagger.
  test('a registered composition plays, lands, and Back reverses it', async ({ page }) => {
    await page.goto(`${BASE}/effects${QUERY}`);
    await waitForShatterReady(page);
    await clearLifecycleEvents(page);
    await page.getByRole('link', { name: 'sweep', exact: true }).click();
    await expect.poll(() => lifecycleEvents(page)).toEqual(FULL_EFFECT);
    await waitForIdle(page);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    expect((await effectHook(page)).lastEffect).toBe('sweep');
    expect((await hookState(page)).fallback).toBeNull();

    await clearLifecycleEvents(page);
    await page.goBack();
    await expect.poll(() => lifecycleEvents(page)).toEqual(FULL_EFFECT);
    await waitForIdle(page);
    await expect(page.locator('h1')).toHaveText('Sixteen ways to break.');
    expect((await effectHook(page)).lastEffect).toBe('sweep:reverse');
  });

  test('sweep: the fractured page at rest matches the live page', async ({ page }, testInfo) => {
    // Tall enough that the sixth link is on screen: hover() must not scroll,
    // like the other first-frame tests (a scrolled page measured 0.81–1.17 %
    // on Firefox in CI, see LEARNINGS).
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE}/effects${QUERY}`);
    await waitForShatterReady(page);
    const link = page.getByRole('link', { name: 'sweep', exact: true });
    await link.hover();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const live = await page.screenshot();
    await pauseAt(page, 'fractured');
    await link.click();
    await waitForPause(page, 'fractured');
    const overlay = await page.screenshot();
    await check(page, testInfo, 'first-sweep', live, overlay);
    await resumeAndFinish(page);
  });
});
