import type { Page, TestInfo } from '@playwright/test';
import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import {
  compareScreenshots,
  pauseAtCovered,
  readHook,
  resumeAndFinish,
  seamLimit,
  waitForCovered,
  waitForShatterReady,
} from '../seam';

const BASE = APPS.vanilla;

/**
 * First-frame seam: the overlay's first frame must look like the live DOM it
 * covers. Screenshots the page with the pointer already resting on the link,
 * clicks, pauses the transition once the overlay is up, and screenshots again,
 * then asserts the difference is within the limit for this engine (ADR-016).
 */
async function firstFrameSeam(
  page: Page,
  testInfo: TestInfo,
  name: string,
  linkName: string,
): Promise<void> {
  const link = page.getByRole('link', { name: linkName, exact: true });
  await link.hover();
  const live = await page.screenshot();

  await pauseAtCovered(page);
  await link.click();
  await waitForCovered(page);
  const overlay = await page.screenshot();

  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const shiftRadius = Math.max(0, Math.round(Math.min(dpr, 2)) - 1);
  const result = await compareScreenshots(testInfo, name, live, overlay, shiftRadius);
  await resumeAndFinish(page);
  const hook = await readHook(page);
  expect(hook.lastFallback).toBeNull();
  testInfo.annotations.push({
    type: 'capture',
    description: `${name}: ${hook.lastCaptureMs?.toFixed(1) ?? '?'} ms, layout grid: ${hook.layoutGrid ?? '?'}`,
  });
  console.log(
    `[seam] ${testInfo.project.name} ${name}: ${result.percent.toFixed(4)} % differ (raw ${result.rawPercent.toFixed(4)} %, shift radius ${shiftRadius}), capture ${hook.lastCaptureMs?.toFixed(1) ?? '?'} ms, grid ${hook.layoutGrid ?? '?'}`,
  );
  expect(result.percent).toBeLessThanOrEqual(seamLimit(testInfo.project.name, dpr));
}

test.describe('vanilla example: first-frame seam', () => {
  test('at the top of the page', async ({ page }, testInfo) => {
    await page.goto(`${BASE}/?debug&budget=5000`);
    await waitForShatterReady(page);
    await firstFrameSeam(page, testInfo, 'top', 'Work');
    await expect(page).toHaveURL(`${BASE}/work`);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
  });

  test('scrolled, with sticky and fixed elements', async ({ page }, testInfo) => {
    await page.goto(`${BASE}/work?debug&budget=5000`);
    await waitForShatterReady(page);
    await page.evaluate(() => {
      window.scrollTo(0, 240);
    });
    expect(await page.evaluate(() => window.scrollY)).toBe(240);
    await firstFrameSeam(page, testInfo, 'scrolled', 'About');
    await expect(page.locator('h1')).toHaveText('Links that behave.');
  });

  test.describe('at device pixel ratio 2', () => {
    test.use({ deviceScaleFactor: 2 });

    test('texels map 1:1 to device pixels', async ({ page }, testInfo) => {
      await page.goto(`${BASE}/?debug&budget=5000`);
      await waitForShatterReady(page);
      await firstFrameSeam(page, testInfo, 'dpr2', 'About');
    });
  });

  test('frees the texture and hides the overlay after the transition', async ({ page }) => {
    await page.goto(`${BASE}/?debug&budget=5000`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    await resumeAndFinish(page);
    const hook = await readHook(page);
    expect(hook.lastFallback).toBeNull();
    expect(hook.lastCaptureMs).not.toBeNull();
  });
});
