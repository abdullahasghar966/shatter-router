import { chromium } from '@playwright/test';
import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import { type HookWindow, hookState, waitForIdle } from '../hook';
import { waitForShatterReady } from '../seam';

const BASE = APPS.vanilla;

test.describe('vanilla example: fallbacks (navigation always completes)', () => {
  test('reduced motion: a crossfade instead of the effect', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${BASE}/?debug`);
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    await page.waitForFunction(() => {
      const hook = (window as HookWindow).__SHATTER_TEST__;
      return hook?.lastFallback === 'reduced-motion' && hook.state() === 'idle';
    });
    // The WebGL overlay was never shown.
    expect(await page.locator('[data-shatter-overlay]:popover-open').count()).toBe(0);
    await expect(page.locator('main h1')).toBeFocused();
  });

  test('capture over budget: plain navigation', async ({ page }) => {
    await page.goto(`${BASE}/?debug&budget=1`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await waitForIdle(page);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    expect((await hookState(page)).fallback).toBe('capture-budget');
  });

  test.describe('strict CSP', () => {
    // The browser reports the blocked data: image, and debug mode logs the failed
    // capture: both are the point of the test.
    test.use({
      expectedConsole: /Content.Security.Policy|\[shatter-router\] capture failed/i,
    });

    test('strict CSP (no data: images): capture fails, navigation completes', async ({
      page,
      browserName,
    }) => {
      // Playwright's Windows WebKit build crashes the page when a View Transition
      // starts right after an image was blocked by CSP (LEARNINGS, ADR-020).
      // Plain View Transitions and the same fallback without CSP do not crash.
      test.fixme(
        browserName === 'webkit' && process.platform === 'win32',
        'WebKit (Windows build) page crash: View Transition after a CSP-blocked image',
      );
      await page.goto(`${BASE}/csp.html?debug&budget=5000`);
      await waitForShatterReady(page);
      await page.getByRole('link', { name: 'Work', exact: true }).click();
      await waitForIdle(page);
      await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
      expect((await hookState(page)).fallback).toBe('capture-failed');
    });
  });
});

test.describe('vanilla example: no WebGL', () => {
  test('without WebGL the navigation completes plainly', async ({ browserName }) => {
    test.skip(browserName !== 'chromium', 'launch flags are Chromium-specific');
    const browser = await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis'] });
    try {
      const page = await browser.newPage();
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(error.message));
      await page.goto(`${BASE}/?debug`);
      await page.getByRole('link', { name: 'Work', exact: true }).click();
      await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
      await page.waitForFunction(() => {
        const hook = (window as HookWindow).__SHATTER_TEST__;
        return hook?.lastFallback === 'unsupported' && hook.state() === 'idle';
      });
      expect(problems).toEqual([]);
    } finally {
      await browser.close();
    }
  });
});
