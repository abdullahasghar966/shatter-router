import type { Page, TestInfo } from '@playwright/test';
import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import {
  compareScreenshots,
  pauseAt,
  type PausePoint,
  readHook,
  resumeAndFinish,
  SEAM_MAX_BLOCK_PERCENT,
  seamLimit,
  setWireframe,
  waitForPause,
  waitForShatterReady,
} from '../seam';

const BASE = APPS.vanilla;
/** Debug hook, a generous capture budget for slow CI machines, a fixed fracture layout. */
const QUERY = '?debug&budget=5000&seed=7';

interface Frame {
  readonly live: Buffer;
  readonly overlay: Buffer;
  readonly shiftRadius: number;
  readonly dpr: number;
}

/**
 * Screenshots the page with the pointer already resting on the link, clicks
 * it, stops the transition at `point` and screenshots the overlay.
 */
async function captureFrame(page: Page, linkName: string, point: PausePoint): Promise<Frame> {
  const link = page.getByRole('link', { name: linkName, exact: true });
  await link.hover();
  const live = await page.screenshot();
  await pauseAt(page, point);
  await link.click();
  await waitForPause(page, point);
  const overlay = await page.screenshot();
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  return { live, overlay, dpr, shiftRadius: Math.max(0, Math.round(Math.min(dpr, 2)) - 1) };
}

/** Logs and records the measurement, then finishes the transition. */
async function report(
  page: Page,
  testInfo: TestInfo,
  name: string,
  percent: number,
  rawPercent: number,
  shiftRadius: number,
  worstBlock: number,
): Promise<void> {
  await resumeAndFinish(page);
  const hook = await readHook(page);
  expect(hook.lastFallback).toBeNull();
  testInfo.annotations.push({
    type: 'capture',
    description: `${name}: ${hook.lastCaptureMs?.toFixed(1) ?? '?'} ms, layout grid: ${hook.layoutGrid ?? '?'}`,
  });
  console.log(
    `[seam] ${testInfo.project.name} ${name}: ${percent.toFixed(4)} % differ (raw ${rawPercent.toFixed(4)} %, worst block ${worstBlock.toFixed(1)} %, shift radius ${shiftRadius}), capture ${hook.lastCaptureMs?.toFixed(1) ?? '?'} ms, grid ${hook.layoutGrid ?? '?'}`,
  );
}

/**
 * Seam check at a pause point: the overlay must look like the live DOM it
 * covers, within the limit for this engine (ADR-016).
 */
async function seam(
  page: Page,
  testInfo: TestInfo,
  name: string,
  linkName: string,
  point: PausePoint,
): Promise<void> {
  const frame = await captureFrame(page, linkName, point);
  const result = await compareScreenshots(
    testInfo,
    name,
    frame.live,
    frame.overlay,
    frame.shiftRadius,
  );
  await report(
    page,
    testInfo,
    name,
    result.percent,
    result.rawPercent,
    frame.shiftRadius,
    result.worstBlockPercent,
  );
  expect(result.percent).toBeLessThanOrEqual(seamLimit(testInfo.project.name, frame.dpr));
  expect(result.worstBlockPercent, 'no local defect (worst 24 CSS px block)').toBeLessThanOrEqual(
    SEAM_MAX_BLOCK_PERCENT,
  );
}

test.describe('vanilla example: first-frame seam', () => {
  test('at the top of the page', async ({ page }, testInfo) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await seam(page, testInfo, 'top', 'Work', 'covered');
    await expect(page).toHaveURL(`${BASE}/work`);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
  });

  test('scrolled, with sticky and fixed elements', async ({ page }, testInfo) => {
    await page.goto(`${BASE}/work${QUERY}`);
    await waitForShatterReady(page);
    await page.evaluate(() => {
      window.scrollTo(0, 240);
    });
    expect(await page.evaluate(() => window.scrollY)).toBe(240);
    await seam(page, testInfo, 'scrolled', 'About', 'covered');
    await expect(page.locator('h1')).toHaveText('Links that behave.');
  });

  test.describe('at device pixel ratio 2', () => {
    test.use({ deviceScaleFactor: 2 });

    test('texels map 1:1 to device pixels', async ({ page }, testInfo) => {
      await page.goto(`${BASE}/${QUERY}`);
      await waitForShatterReady(page);
      await seam(page, testInfo, 'dpr2', 'About', 'covered');
    });

    test('the fractured mesh at rest matches the page', async ({ page }, testInfo) => {
      await page.goto(`${BASE}/${QUERY}`);
      await waitForShatterReady(page);
      await seam(page, testInfo, 'fractured-dpr2', 'About', 'fractured');
    });
  });

  test('the fractured mesh at rest matches the page', async ({ page }, testInfo) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await seam(page, testInfo, 'fractured', 'Work', 'fractured');
    const hook = await readHook(page);
    expect(hook.lastFracture?.shardCount).toBeGreaterThanOrEqual(12);
  });

  test('frees the texture and hides the overlay after the transition', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    await resumeAndFinish(page);
    const hook = await readHook(page);
    expect(hook.lastFallback).toBeNull();
    expect(hook.lastCaptureMs).not.toBeNull();
  });
});

test.describe('vanilla example: crack propagation', () => {
  test('draws thin crack lines over an otherwise unchanged page', async ({ page }, testInfo) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    const frame = await captureFrame(page, 'Work', 'cracked');
    const result = await compareScreenshots(testInfo, 'cracked', frame.live, frame.overlay, 0);
    await report(
      page,
      testInfo,
      'cracked',
      result.percent,
      result.rawPercent,
      0,
      result.worstBlockPercent,
    );
    // Lines are visible...
    expect(result.rawPercent).toBeGreaterThan(1);
    // ...but only lines: the page itself is still there underneath.
    expect(result.rawPercent).toBeLessThan(25);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
  });

  test('the debug wireframe shows every cell edge before the crack runs', async ({
    page,
  }, testInfo) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    const frame = await captureFrame(page, 'Work', 'fractured');
    await setWireframe(page, true);
    const wire = await page.screenshot();
    await setWireframe(page, false);
    const plain = await compareScreenshots(testInfo, 'wire-off', frame.live, frame.overlay, 0);
    const wired = await compareScreenshots(testInfo, 'wire-on', frame.live, wire, 0);
    await report(
      page,
      testInfo,
      'wireframe',
      wired.percent,
      wired.rawPercent,
      0,
      wired.worstBlockPercent,
    );
    expect(wired.rawPercent).toBeGreaterThan(plain.rawPercent + 1);
  });
});
