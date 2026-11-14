import type { Page, TestInfo } from '@playwright/test';
import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import {
  compareScreenshots,
  pauseAtCovered,
  readHook,
  resumeAndFinish,
  SEAM_MAX_PERCENT,
  waitForCovered,
  waitForShatterReady,
} from '../seam';

const BASE = APPS.vanilla;

/**
 * First-frame seam: the overlay's first frame must look like the live DOM it
 * covers. Screenshots the page with the pointer already resting on the link,
 * clicks, pauses the transition once the overlay is up, and screenshots again.
 */
async function firstFrameSeam(
  page: Page,
  testInfo: TestInfo,
  name: string,
  linkName: string,
): Promise<number> {
  const link = page.getByRole('link', { name: linkName, exact: true });
  await link.hover();
  const live = await page.screenshot();

  await pauseAtCovered(page);
  await link.click();
  await waitForCovered(page);
  const overlay = await page.screenshot();

  const result = await compareScreenshots(testInfo, name, live, overlay);
  await resumeAndFinish(page);
  const hook = await readHook(page);
  expect(hook.lastFallback).toBeNull();
  testInfo.annotations.push({
    type: 'capture',
    description: `${name}: ${hook.lastCaptureMs?.toFixed(1) ?? '?'} ms, layout grid: ${hook.layoutGrid ?? '?'}`,
  });
  console.log(
    `[seam] ${testInfo.project.name} ${name}: ${result.percent.toFixed(4)} % differ, capture ${hook.lastCaptureMs?.toFixed(1) ?? '?'} ms, grid ${hook.layoutGrid ?? '?'}`,
  );
  return result.percent;
}

test.describe('vanilla example: first-frame seam', () => {
  test('at the top of the page', async ({ page }, testInfo) => {
    await page.goto(`${BASE}/?debug&budget=5000`);
    await waitForShatterReady(page);
    const percent = await firstFrameSeam(page, testInfo, 'top', 'Work');
    expect(percent).toBeLessThanOrEqual(SEAM_MAX_PERCENT);
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
    const percent = await firstFrameSeam(page, testInfo, 'scrolled', 'About');
    expect(percent).toBeLessThanOrEqual(SEAM_MAX_PERCENT);
    await expect(page.locator('h1')).toHaveText('Links that behave.');
  });

  for (const variant of ['css', 'device', 'css-geo', 'device-geo'] as const) {
    const grid = variant.startsWith('device') ? 'device' : 'css';
    const geo = variant.endsWith('geo');
    test.describe(`SPIKE ${variant} at dpr 2`, () => {
      test.use({ deviceScaleFactor: 2 });
      test('measure', async ({ page }, testInfo) => {
        await page.addInitScript(
          ([g, x]) => {
            const w = window as unknown as { __SPIKE_GRID__: string; __SPIKE_GEO__: boolean };
            w.__SPIKE_GRID__ = g;
            w.__SPIKE_GEO__ = x;
          },
          [grid, geo] as const,
        );
        await page.goto(`${BASE}/?debug&budget=5000`);
        await waitForShatterReady(page);
        await firstFrameSeam(page, testInfo, `spike-${grid}`, 'About');
      });
      test('measure dpr1', async ({ page }, testInfo) => {
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.addInitScript(
          ([g, x]) => {
            const w = window as unknown as { __SPIKE_GRID__: string; __SPIKE_GEO__: boolean };
            w.__SPIKE_GRID__ = g;
            w.__SPIKE_GEO__ = x;
          },
          [grid, geo] as const,
        );
        await page.goto(`${BASE}/work?debug&budget=5000`);
        await waitForShatterReady(page);
        await firstFrameSeam(page, testInfo, `spike1x-${grid}`, 'About');
      });
    });
  }

  test.describe('at device pixel ratio 2', () => {
    test.use({ deviceScaleFactor: 2 });

    test('texels map 1:1 to device pixels', async ({ page }, testInfo) => {
      await page.goto(`${BASE}/?debug&budget=5000`);
      await waitForShatterReady(page);
      const percent = await firstFrameSeam(page, testInfo, 'dpr2', 'About');
      expect(percent).toBeLessThanOrEqual(SEAM_MAX_PERCENT);
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
