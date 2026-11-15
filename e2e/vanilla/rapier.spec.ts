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
import { waitForShatterReady } from '../seam';

const BASE = APPS.vanilla;
const QUERY = '?debug&budget=5000&seed=7&physics=rapier';

async function lastPhysics(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      (window as HookWindow & { __SHATTER_TEST__?: { lastPhysics: string | null } })
        .__SHATTER_TEST__?.lastPhysics ?? null,
  );
}

async function navigateWith(page: Page, linkName: string): Promise<void> {
  await clearLifecycleEvents(page);
  await page.getByRole('link', { name: linkName, exact: true }).click();
  await expect.poll(() => lifecycleEvents(page)).toEqual(FULL_EFFECT);
  await waitForIdle(page);
}

test.describe('vanilla example: physics: rapier()', () => {
  test('shatter falls through Rapier and lands on the new route', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}&duration=800`);
    await waitForShatterReady(page);
    await navigateWith(page, 'Work');
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    expect(await lastPhysics(page)).toBe('rapier');
    const state = await hookState(page);
    expect(state.fallback).toBeNull();
    expect(state.textures).toBe(0);
    console.log(
      `[rapier] ${test.info().project.name} shatter: ${state.animation?.frames ?? 0} frames in ${state.animation?.durationMs.toFixed(0) ?? '?'} ms (${state.animation?.fps.toFixed(1) ?? '?'} fps, worst ${state.animation?.worstFrameMs.toFixed(1) ?? '?'} ms), ${state.fracture?.shardCount ?? '?'} shards`,
    );
  });

  test('with a floor, shards pile up inside the viewport before they fade', async ({ page }) => {
    await page.goto(`${BASE}/effects${QUERY}&floor&duration=2500`);
    await waitForShatterReady(page);
    await page.evaluate(() => {
      const hook = (window as HookWindow).__SHATTER_TEST__;
      if (hook) hook.pauseAt = 'animating';
    });
    await page.getByRole('link', { name: 'explode', exact: true }).click();
    await page.waitForFunction(
      () => (window as HookWindow).__SHATTER_TEST__?.paused === 'animating',
    );
    // Run the simulation forward to 1.5 s in frame-sized steps, then look at the bottom band.
    await page.evaluate(() => {
      const hook = (window as HookWindow).__SHATTER_TEST__;
      for (let ms = 0; ms <= 1500; ms += 16) hook?.setMotionTime(ms);
    });
    const shot = await page.screenshot({ clip: { x: 0, y: 600, width: 1280, height: 120 } });
    await test.info().attach('floor-pile.png', { body: shot, contentType: 'image/png' });
    expect(await lastPhysics(page)).toBe('rapier');
    await page.evaluate(() => {
      (window as HookWindow).__SHATTER_TEST__?.resume();
    });
    await waitForIdle(page, 15_000);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    expect((await hookState(page)).fallback).toBeNull();
  });

  test('effects that do not fall keep their own motion', async ({ page }) => {
    await page.goto(`${BASE}/effects${QUERY}&duration=400`);
    await waitForShatterReady(page);
    await navigateWith(page, 'flip');
    expect(await lastPhysics(page)).toBe('procedural');
  });
});

test.describe('vanilla example: rapier under a CSP without wasm-unsafe-eval', () => {
  // The browser refuses to compile Rapier's WebAssembly and says so; debug mode
  // logs that physics is unavailable. Nothing else may be logged.
  test.use({ expectedConsole: /WebAssembly|wasm|physics "rapier" unavailable/i });

  test('the effect still plays, with procedural motion', async ({ page }) => {
    await page.goto(`${BASE}/csp-wasm.html${QUERY}&duration=400`);
    await waitForShatterReady(page);
    await navigateWith(page, 'Work');
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    expect(await lastPhysics(page)).toBe('procedural');
    expect((await hookState(page)).fallback).toBeNull();
  });
});
