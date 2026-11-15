import type { Page } from '@playwright/test';
import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import { type HookWindow, waitForIdle } from '../hook';
import { waitForShatterReady } from '../seam';

/** The debug panel (section 10, ADR-041): `debug: true` in the app, `?debug&panel` here. */

const BASE = APPS.vanilla;
const QUERY = '?debug&panel&budget=5000&seed=7&shards=60';

async function row(page: Page, name: string): Promise<string> {
  const panel = page.locator('[data-shatter-debug]');
  return (
    (await panel
      .locator('dt', { hasText: new RegExp(`^${name}$`) })
      .locator('+ dd')
      .textContent()) ?? ''
  );
}

test.describe('vanilla example: debug panel', () => {
  test('shows the pipeline numbers of the latest transition', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    const panel = page.locator('[data-shatter-debug]');
    await expect(panel.getByText('shatter-router')).toBeVisible();
    await expect.poll(() => row(page, 'state')).toBe('idle');

    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await waitForIdle(page);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    await expect.poll(() => row(page, 'state')).toBe('idle');
    expect(await row(page, 'shards')).toMatch(/^60 \(\d+\.\d ms\)$/);
    expect(await row(page, 'tier')).toMatch(/^(low|mid|high)$/);
    expect(await row(page, 'draw calls')).toBe('1.00 / frame');
    expect(await row(page, 'fps')).toMatch(/^\d+\.\d \(worst \d+ ms\)$/);
    expect(await row(page, 'capture')).toMatch(/^\d+ ms$/);
    expect(await row(page, 'effect')).toBe('shatter');
    expect(await row(page, 'textures')).toBe('0');
    // The app's own CSS cannot reach into the panel's shadow root.
    const font = await panel
      .locator('.p')
      .evaluate((element) => getComputedStyle(element).fontFamily);
    expect(font).toMatch(/monospace/);
  });

  test('stays above the overlay during a transition', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.evaluate(() => {
      const hook = (window as HookWindow).__SHATTER_TEST__;
      if (hook) hook.pauseAt = 'fractured';
    });
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await page.waitForFunction(
      () => (window as HookWindow).__SHATTER_TEST__?.paused === 'fractured',
    );
    const topmost = await page.evaluate(() => {
      const panel = document.querySelector('[data-shatter-debug]');
      const box = panel?.shadowRoot?.querySelector('.p')?.getBoundingClientRect();
      if (!box) return null;
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + 8);
      return hit === panel;
    });
    expect(topmost).toBe(true);
    await expect.poll(() => row(page, 'state')).toBe('covering');
    await page.evaluate(() => {
      (window as HookWindow).__SHATTER_TEST__?.resume();
    });
    await waitForIdle(page);
  });

  test('the wireframe toggle drives the overlay', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.locator('[data-shatter-debug]').getByLabel('wireframe + impact point').check();
    const wireframe = await page.evaluate(
      () =>
        (window as HookWindow & { __SHATTER_TEST__?: { wireframe: boolean } }).__SHATTER_TEST__
          ?.wireframe,
    );
    expect(wireframe).toBe(true);
  });

  test('seam check reports the share of differing pixels and a heatmap', async ({ page }) => {
    // The user declines screen sharing. Firefox in CI would otherwise wait on
    // its share prompt forever (Chromium and WebKit headless refuse at once).
    await page.addInitScript(() => {
      const media = navigator.mediaDevices as MediaDevices | undefined;
      if (media) {
        media.getDisplayMedia = () =>
          Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
      }
    });
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    const panel = page.locator('[data-shatter-debug]');
    await panel.getByRole('button', { name: 'Seam check' }).click();
    const result = panel.locator('[data-k="seam-result"]');
    await expect(result).toHaveText(/% differ/, { timeout: 20_000 });
    const text = (await result.textContent()) ?? '';
    const percent = Number(/^([\d.]+) %/.exec(text)?.[1]);
    console.log(`[debug-panel] ${test.info().project.name} seam check: ${text}`);
    // Without screen capture the check compares the capture with the
    // overlay's read-back, which must be (nearly) identical.
    expect(text).toContain('capture vs overlay');
    expect(percent).toBeLessThanOrEqual(0.5);
    await expect(panel.locator('canvas')).toBeVisible();
    await waitForIdle(page);
    expect(await row(page, 'textures')).toBe('0');
  });
});
