import type { Page } from '@playwright/test';
import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import {
  clearLifecycleEvents,
  FULL_EFFECT,
  hookState,
  lifecycleEvents,
  waitForIdle,
} from '../hook';
import { waitForShatterReady } from '../seam';

/** The docs site (`apps/docs`, master prompt section 13). Measurements: landing.spec.ts. */

const BASE = APPS.docs;
const QUERY = '?debug&budget=5000&seed=7';
const EFFECTS = ['shatter', 'explode', 'implode', 'flip', 'assemble', 'ripple-out'];

const PAGES = [
  ['/', 'Break the page.'],
  ['/effects', 'Six ways to break a page.'],
  ['/effects/ripple-out', 'Ripple out'],
  ['/playground', 'Tune the glass.'],
  ['/docs', 'How a page breaks'],
  ['/docs/getting-started', 'Getting started'],
  ['/docs/api', 'API reference'],
  ['/docs/custom-effects', 'Writing a custom effect'],
  ['/docs/performance', 'Performance'],
  ['/docs/accessibility', 'Accessibility'],
  ['/docs/csp', 'Content Security Policy'],
  ['/docs/troubleshooting', 'Troubleshooting'],
  ['/docs/browser-support', 'Browser support'],
] as const;

async function lastEffect(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      (window as { __SHATTER_TEST__?: { lastEffect: string | null } }).__SHATTER_TEST__
        ?.lastEffect ?? null,
  );
}

async function settle(page: Page): Promise<void> {
  await expect.poll(() => lifecycleEvents(page), { timeout: 15_000 }).toEqual(FULL_EFFECT);
  await waitForIdle(page, 15_000);
}

test.describe('docs site', () => {
  test('every page renders its heading with no console errors', async ({ page }) => {
    for (const [path, heading] of PAGES) {
      await page.goto(`${BASE}${path}`);
      await expect(page.locator('h1')).toHaveText(heading);
      await expect(page).toHaveTitle(/Shatter Router/);
      // Let Next finish prefetching the visible links: WebKit reports a
      // prefetch cut short by the next navigation as a page error.
      await page.waitForLoadState('networkidle');
    }
  });

  test('header links navigate with the effect', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await clearLifecycleEvents(page);
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Docs' })
      .click();
    await settle(page);
    await expect(page).toHaveURL(`${BASE}/docs`);
    await expect(page.locator('h1')).toHaveText('How a page breaks');
    // Focus moves to the new page's heading after the reveal.
    await expect(page.locator('h1')).toBeFocused();
    const state = await hookState(page);
    expect(state.fallback).toBeNull();
    expect(state.textures).toBe(0);
  });

  for (const effect of EFFECTS) {
    test(`the ${effect} card opens its page using ${effect}`, async ({ page }) => {
      await page.goto(`${BASE}/effects${QUERY}`);
      await waitForShatterReady(page);
      await clearLifecycleEvents(page);
      await page.locator(`a.card[href="/effects/${effect}"]`).click();
      await settle(page);
      await expect(page).toHaveURL(`${BASE}/effects/${effect}`);
      expect(await lastEffect(page)).toBe(effect);
      expect((await hookState(page)).fallback).toBeNull();
    });
  }

  test('a click on the hero breaks the page in place and puts it back together', async ({
    page,
  }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await clearLifecycleEvents(page);
    await page.locator('.hero').click({ position: { x: 900, y: 300 } });
    await settle(page);
    await expect(page).toHaveURL(`${BASE}/${QUERY}`);
    expect(await lastEffect(page)).toBe('assemble');
    await expect(page.locator('h1')).toHaveText('Break the page.');
    // The "Break it" button does the same, for keyboard users.
    await clearLifecycleEvents(page);
    await page.getByRole('button', { name: 'Break it' }).press('Enter');
    await settle(page);
    expect((await hookState(page)).fallback).toBeNull();
  });

  test('playground: the panel drives the stage and the copied config', async ({
    page,
    context,
    browserName,
  }) => {
    await page.goto(`${BASE}/playground`);
    const code = page.getByTestId('config-code');
    await expect(code).toContainText("effect: 'shatter',");
    // Tweakpane's list binding renders a native <select>.
    const select = page.locator('.pane-host select').first();
    await expect(select).toBeVisible();
    await select.selectOption('flip');
    await expect(code).toContainText("effect: 'flip',");
    await expect(code).toContainText("import { createShatter } from 'shatter-router';");

    const title = page.getByTestId('stage-title');
    await expect(title).toHaveText('Glass');
    await page.getByRole('button', { name: /click to break/ }).click();
    await expect(title).toHaveText('Shards', { timeout: 15_000 });
    // The stage's own instance finishes: the overlay goes away.
    await expect(
      page.locator('[data-shatter-overlay]:not([data-shatter-overlay="announcer"])').first(),
    ).not.toBeVisible({ timeout: 15_000 });

    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.getByRole('button', { name: 'Copy config' }).click();
      await expect(page.getByRole('status')).toHaveText('Copied.');
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      // The Windows clipboard hands text back with CRLF line endings.
      expect(copied.replace(/\r\n/g, '\n')).toBe(await code.textContent());
    }
  });

  test('playground: the settings live in the URL, so Back and a reload restore them', async ({
    page,
  }) => {
    await page.goto(`${BASE}/playground${QUERY}`);
    await waitForShatterReady(page);
    const code = page.getByTestId('config-code');
    const select = page.locator('.pane-host select').first();
    await select.selectOption('explode');
    await expect(code).toContainText("effect: 'explode',");
    // Written with replaceState: the site's own parameters stay.
    await expect.poll(() => new URL(page.url()).searchParams.get('effect')).toBe('explode');
    expect(new URL(page.url()).searchParams.has('debug')).toBe(true);
    const historyLength = await page.evaluate(() => history.length);

    await clearLifecycleEvents(page);
    await page.getByRole('link', { name: 'Docs', exact: true }).click();
    await settle(page);
    await expect(page.locator('h1')).toHaveText('How a page breaks');
    expect(await page.evaluate(() => history.length)).toBe(historyLength + 1);

    await clearLifecycleEvents(page);
    await page.goBack();
    await settle(page);
    await expect(page.locator('h1')).toHaveText('Tune the glass.');
    // The page that rewrote its own query is still found in the memory.
    expect(await lastEffect(page)).toBe('shatter:reverse');
    await expect(code).toContainText("effect: 'explode',");
    await expect(select).toHaveValue('explode');

    await page.reload();
    await expect(page.locator('.pane-host select').first()).toHaveValue('explode');
    await expect(page.getByTestId('config-code')).toContainText("effect: 'explode',");
  });

  test.describe('not found', () => {
    test.use({ expectedConsole: /Failed to load resource: .*404/ });
    test('an unknown route shows the 404 page', async ({ page }) => {
      const response = await page.goto(`${BASE}/no-such-page`);
      expect(response?.status()).toBe(404);
      await expect(page.locator('h1')).toHaveText('Nothing here to break.');
    });
  });
});
