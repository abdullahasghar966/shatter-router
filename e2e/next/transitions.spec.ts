import type { Page, TestInfo } from '@playwright/test';
import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import { hookState, waitForIdle } from '../hook';
import {
  compareScreenshots,
  pauseAt,
  readHook,
  resumeAndFinish,
  SEAM_MAX_BLOCK_PERCENT,
  seamLimit,
  waitForPause,
  waitForShatterReady,
} from '../seam';

const BASE = APPS.next;
const QUERY = '?debug&budget=5000&seed=7&duration=300';
const FULL_EFFECT = ['start', 'covered', 'committed', 'animating', 'end'];

/** Forgets the lifecycle events recorded so far (the example keeps one array). */
async function clearEvents(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as { __shatterEvents?: string[] }).__shatterEvents?.splice(0);
  });
}

async function events(page: Page): Promise<string[]> {
  return page.evaluate(() => [
    ...((window as { __shatterEvents?: string[] }).__shatterEvents ?? []),
  ]);
}

test.describe('Next.js example: transitions', () => {
  test("loading.tsx with waitFor 'settled': the overlay stays up until the real page", async ({
    page,
  }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await pauseAt(page, 'animating');
    await page.getByRole('link', { name: 'Slow', exact: true }).click();
    await waitForPause(page, 'animating');
    await expect(page.locator('h1')).toHaveText('Worth the wait.');
    await expect(page.getByTestId('loading')).toHaveCount(0);
    const { timings } = await hookState(page);
    console.log(
      `[next] ${test.info().project.name}: committing ${timings.committing?.toFixed(0) ?? '?'} ms (server 400 ms)`,
    );
    expect(timings.committing).toBeGreaterThanOrEqual(350);
    await resumeAndFinish(page);
    await expect(page).toHaveURL(`${BASE}/slow`);
    expect((await hookState(page)).fallback).toBeNull();
  });

  test("loading.tsx with waitFor 'commit': the effect starts on the loading UI", async ({
    page,
  }) => {
    await page.goto(`${BASE}/${QUERY}&waitfor=commit`);
    await waitForShatterReady(page);
    await pauseAt(page, 'animating');
    await page.getByRole('link', { name: 'Slow', exact: true }).click();
    await waitForPause(page, 'animating');
    const { timings } = await hookState(page);
    expect(timings.committing).toBeLessThan(350);
    await resumeAndFinish(page);
    await expect(page.locator('h1')).toHaveText('Worth the wait.');
  });

  test('back and forward shatter, land on the right route and restore scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto(`${BASE}/work${QUERY}`);
    await waitForShatterReady(page);
    await page.evaluate(() => {
      window.scrollTo(0, 300);
    });
    await page.getByRole('link', { name: 'About', exact: true }).click();
    await waitForIdle(page);
    await expect(page.locator('h1')).toHaveText('Links that behave.');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await clearEvents(page);
    await page.goBack();
    await expect.poll(() => events(page)).toEqual(FULL_EFFECT);
    await waitForIdle(page);
    await expect(page).toHaveURL(`${BASE}/work${QUERY}`);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    expect(await page.evaluate(() => window.scrollY)).toBe(300);
    expect((await hookState(page)).fallback).toBeNull();

    await clearEvents(page);
    await page.goForward();
    await expect.poll(() => events(page)).toEqual(FULL_EFFECT);
    await waitForIdle(page);
    await expect(page).toHaveURL(`${BASE}/about`);
    await expect(page.locator('h1')).toHaveText('Links that behave.');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect((await hookState(page)).fallback).toBeNull();
  });

  test('back: the overlay shows the outgoing page, not the incoming one', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'About', exact: true }).click();
    await waitForIdle(page);
    const outgoing = await page.screenshot();
    await pauseAt(page, 'covered');
    await page.goBack();
    await waitForPause(page, 'covered');
    // The App Router has not rendered Home yet: its popstate is held until covered.
    await expect(page.locator('h1')).toHaveText('Links that behave.');
    const covered = await page.screenshot();
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    const result = await compareScreenshots(
      test.info(),
      'back-covered',
      outgoing,
      covered,
      Math.max(0, Math.round(Math.min(dpr, 2)) - 1),
    );
    console.log(
      `[seam] ${test.info().project.name} next back: ${result.percent.toFixed(4)} % (raw ${result.rawPercent.toFixed(4)} %)`,
    );
    expect(result.percent).toBeLessThanOrEqual(seamLimit(test.info().project.name, dpr));
    await resumeAndFinish(page);
    await expect(page.locator('h1')).toHaveText('Break the page.');
  });

  test('a rapid double click on two links ends on the second route', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.evaluate(() => {
      document.querySelector<HTMLAnchorElement>('nav a[href="/work"]')?.click();
      document.querySelector<HTMLAnchorElement>('nav a[href="/about"]')?.click();
    });
    await waitForIdle(page);
    await expect(page).toHaveURL(`${BASE}/about`);
    await expect(page.locator('h1')).toHaveText('Links that behave.');
    expect((await hookState(page)).textures).toBe(0);
  });
});

async function firstFrameSeam(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const link = page.getByRole('link', { name: 'Work', exact: true });
  await link.hover();
  const live = await page.screenshot();
  await pauseAt(page, 'covered');
  await link.click();
  await waitForPause(page, 'covered');
  const overlay = await page.screenshot();
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const shiftRadius = Math.max(0, Math.round(Math.min(dpr, 2)) - 1);
  const result = await compareScreenshots(testInfo, name, live, overlay, shiftRadius);
  await resumeAndFinish(page);
  const hook = await readHook(page);
  expect(hook.lastFallback).toBeNull();
  console.log(
    `[seam] ${testInfo.project.name} next ${name}: ${result.percent.toFixed(4)} % differ (raw ${result.rawPercent.toFixed(4)} %, worst block ${result.worstBlockPercent.toFixed(1)} %), capture ${hook.lastCaptureMs?.toFixed(1) ?? '?'} ms`,
  );
  expect(result.percent).toBeLessThanOrEqual(seamLimit(testInfo.project.name, dpr));
  expect(result.worstBlockPercent).toBeLessThanOrEqual(SEAM_MAX_BLOCK_PERCENT);
}

test.describe('Next.js example: first-frame seam', () => {
  test('at the top of the home page', async ({ page }, testInfo) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await firstFrameSeam(page, testInfo, 'top');
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
  });
});
