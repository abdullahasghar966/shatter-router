import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import { type HookWindow, hookState, waitForIdle, waitForState } from '../hook';
import { waitForShatterReady } from '../seam';

const BASE = APPS.vanilla;
const QUERY = '?debug&budget=5000&seed=7';

test.describe('vanilla example: the shatter effect', () => {
  test('a click breaks the page, the shards fall, and the new route is live', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'See the work' }).click();
    await waitForIdle(page);

    await expect(page).toHaveURL(`${BASE}/work`);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    const state = await hookState(page);
    expect(state.fallback).toBeNull();
    expect(state.textures).toBe(0);
    expect(state.fracture?.shardCount).toBeGreaterThanOrEqual(12);
    // The motion ran for real, for about the 1000 ms default. Frame rate is not
    // checked here: parallel software-GL runs are slow (measured in Milestone 10).
    expect(state.animation?.frames).toBeGreaterThanOrEqual(3);
    expect(state.animation?.durationMs).toBeGreaterThan(400);
    expect(state.animation?.durationMs).toBeLessThan(2500);
    for (const phase of ['capturing', 'covering', 'committing', 'waiting', 'animating']) {
      expect(state.timings).toHaveProperty(phase);
    }
    console.log(
      `[effect] ${test.info().project.name}: capture ${state.captureMs?.toFixed(0) ?? '?'} ms, motion ${state.animation?.frames ?? 0} frames in ${state.animation?.durationMs.toFixed(0) ?? '?'} ms (${state.animation?.fps.toFixed(1) ?? '?'} fps, worst frame ${state.animation?.worstFrameMs.toFixed(1) ?? '?'} ms)`,
    );
  });

  test('mid-motion, shards have moved away and the new page shows through', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.evaluate(() => {
      const hook = (window as HookWindow).__SHATTER_TEST__;
      if (hook) hook.pauseAt = 'animating';
    });
    await page.getByRole('link', { name: 'See the work' }).click();
    await page.waitForFunction(
      () => (window as HookWindow).__SHATTER_TEST__?.paused === 'animating',
    );
    const atRest = await page.screenshot();
    await page.evaluate(() => {
      (window as HookWindow).__SHATTER_TEST__?.setMotionTime(600);
    });
    const moving = await page.screenshot();
    expect(moving.equals(atRest)).toBe(false);
    await test.info().attach('motion-600ms.png', { body: moving, contentType: 'image/png' });
    await page.evaluate(() => {
      (window as HookWindow).__SHATTER_TEST__?.resume();
    });
    await waitForIdle(page);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
  });

  test('focus moves to the new page heading and the title is announced', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'About', exact: true }).click();
    await waitForIdle(page);
    await expect(page.locator('main h1')).toBeFocused();
    await expect(page.locator('[aria-live="polite"]')).toHaveText(/^About — Shatter Router/);
  });

  test('keyboard activation breaks from the link centre and completes', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'About this example' }).focus();
    await page.keyboard.press('Enter');
    await waitForIdle(page);
    await expect(page).toHaveURL(`${BASE}/about`);
    expect((await hookState(page)).fallback).toBeNull();
  });

  test('pre-capture: pressing a link starts the capture before the click', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    const link = page.getByRole('link', { name: 'Work', exact: true });
    const box = await link.boundingBox();
    if (!box) throw new Error('no link box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    // Hold the button long enough for the capture to finish.
    await page.waitForTimeout(400);
    await page.mouse.up();
    await waitForIdle(page);
    const state = await hookState(page);
    expect(state.precaptured).toBe(true);
    expect(state.fallback).toBeNull();
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
  });

  test('pre-capture is thrown away when the page changes before the click', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    const link = page.getByRole('link', { name: 'Work', exact: true });
    const box = await link.boundingBox();
    if (!box) throw new Error('no link box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      document.querySelector('.lede')?.append(' (changed)');
    });
    await page.mouse.up();
    await waitForIdle(page);
    const state = await hookState(page);
    expect(state.precaptured).toBe(false);
    expect(state.fallback).toBeNull();
  });

  test('the overlay never stays up: state returns to idle within the time budget', async ({
    page,
  }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    const started = Date.now();
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await waitForState(page, 'animating');
    await waitForIdle(page);
    expect(Date.now() - started).toBeLessThan(4000);
  });
});
