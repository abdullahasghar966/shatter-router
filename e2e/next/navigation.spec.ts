import type { Page } from '@playwright/test';
import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import { hookState, waitForIdle } from '../hook';
import { waitForShatterReady } from '../seam';

const BASE = APPS.next;
const QUERY = '?debug&budget=5000&seed=7&duration=300';

/** Lifecycle events the example recorded (debug mode). */
async function events(page: Page): Promise<string[]> {
  return page.evaluate(() => [
    ...((window as { __shatterEvents?: string[] }).__shatterEvents ?? []),
  ]);
}

async function markDocument(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __marker: string }).__marker = 'same-document';
  });
}

async function marker(page: Page): Promise<string | undefined> {
  return page.evaluate(() => (window as unknown as { __marker?: string }).__marker);
}

test.describe('Next.js example: links', () => {
  test('ShatterLink shatters and stays client-side', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await markDocument(page);
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await waitForIdle(page);
    await expect(page).toHaveURL(`${BASE}/work`);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    await expect(page).toHaveTitle(/^Work — /);
    await expect(page.locator('nav a[aria-current="page"]')).toHaveText('Work');
    expect(await marker(page)).toBe('same-document');
    expect(await events(page)).toEqual(['start', 'covered', 'committed', 'animating', 'end']);
    const state = await hookState(page);
    expect(state.fallback).toBeNull();
    expect(state.textures).toBe(0);
  });

  test('prefetching of next/link is kept', async ({ page }) => {
    const prefetched: string[] = [];
    page.on('request', (request) => {
      if (request.headers()['next-router-prefetch'])
        prefetched.push(new URL(request.url()).pathname);
    });
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await expect.poll(() => prefetched.includes('/work')).toBe(true);
  });

  test('focus moves and the title is announced', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'About this example' }).click();
    await waitForIdle(page);
    await expect(page.locator('h1')).toHaveText('Links that behave.');
    await expect(page.locator('main h1')).toBeFocused();
    await expect(page.locator('[aria-live="polite"]')).toHaveText(/^About — Shatter Router/);
  });

  test('useShatterNavigate navigates in code with the effect', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.getByRole('button', { name: 'Navigate in code' }).click();
    await waitForIdle(page);
    await expect(page).toHaveURL(`${BASE}/about`);
    expect(await events(page)).toContain('animating');
    expect((await hookState(page)).fallback).toBeNull();
  });

  test('Ctrl/Cmd/Shift/Alt-click and middle-click are left to the browser', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    // Record whether the app prevented the default, then stop the browser's
    // own action (new tab or window) so the test stays on this page.
    await page.evaluate(() => {
      const seen: boolean[] = [];
      (window as unknown as { __prevented: boolean[] }).__prevented = seen;
      for (const type of ['click', 'auxclick']) {
        document.addEventListener(type, (event) => {
          if (!(event.target instanceof Element) || !event.target.closest('a')) return;
          seen.push(event.defaultPrevented);
          event.preventDefault();
        });
      }
    });
    const work = page.getByRole('link', { name: 'Work', exact: true });
    for (const modifier of ['ControlOrMeta', 'Shift', 'Alt'] as const) {
      await work.click({ modifiers: [modifier] });
    }
    await work.click({ button: 'middle' });
    await page.waitForTimeout(300);
    const prevented = await page.evaluate(
      () => (window as unknown as { __prevented: boolean[] }).__prevented,
    );
    expect(prevented.length).toBeGreaterThanOrEqual(4);
    expect(prevented.every((value) => !value)).toBe(true);
    await expect(page).toHaveURL(`${BASE}/${QUERY}`);
    expect(await events(page)).toEqual([]);
  });

  test('target="_blank" opens a new tab without a transition', async ({ page, context }) => {
    await page.goto(`${BASE}/about${QUERY}`);
    await waitForShatterReady(page);
    const popupPromise = context.waitForEvent('page');
    await page.getByRole('link', { name: 'Work in a new tab' }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    expect(popup.url()).toBe(`${BASE}/work`);
    await popup.close();
    await expect(page).toHaveURL(`${BASE}/about${QUERY}`);
    expect(await events(page)).toEqual([]);
  });

  test('data-shatter="off" falls through to a plain next/link navigation', async ({ page }) => {
    await page.goto(`${BASE}/about${QUERY}`);
    await waitForShatterReady(page);
    await markDocument(page);
    await page.getByRole('link', { name: /opted out/ }).click();
    await expect(page).toHaveURL(`${BASE}/work`);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    expect(await marker(page)).toBe('same-document');
    expect(await events(page)).toEqual([]);
  });

  test('a link to another page with a #fragment scrolls to it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.goto(`${BASE}/work${QUERY}`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'How links are handled' }).click();
    await waitForIdle(page);
    await expect(page).toHaveURL(`${BASE}/about#links`);
    // Scrolled to the fragment, or as far as the (short) page allows.
    const { scrollY, wanted } = await page.locator('#links').evaluate((el) => {
      const root = document.documentElement;
      const absolute = el.getBoundingClientRect().top + window.scrollY;
      return {
        scrollY: window.scrollY,
        wanted: Math.min(absolute, root.scrollHeight - root.clientHeight),
      };
    });
    expect(wanted).toBeGreaterThan(0);
    expect(Math.abs(scrollY - wanted)).toBeLessThan(2);
  });

  test('same-page hash links neither re-render nor shatter', async ({ page }) => {
    await page.goto(`${BASE}/about${QUERY}`);
    await waitForShatterReady(page);
    await page.locator('h1').evaluate((h1) => {
      h1.setAttribute('data-kept', 'yes');
    });
    await page.getByRole('link', { name: 'Same-page anchor' }).click();
    await expect(page).toHaveURL(`${BASE}/about${QUERY}#links`);
    await page.goBack();
    await expect(page).toHaveURL(`${BASE}/about${QUERY}`);
    await page.waitForTimeout(300);
    await expect(page.locator('h1')).toHaveAttribute('data-kept', 'yes');
    expect(await events(page)).toEqual([]);
  });

  test('deep links render the right route', async ({ page }) => {
    await page.goto(`${BASE}/work${QUERY}`);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    await waitForShatterReady(page);
  });
});

test.describe('Next.js example: unknown routes', () => {
  // Next.js answers an unknown route with an HTTP 404 document; the browser
  // logs that response as a console error. Nothing else may be logged.
  test.use({ expectedConsole: /Failed to load resource: .*status of 404/ });

  test('a deep link to an unknown route renders not-found', async ({ page }) => {
    const response = await page.goto(`${BASE}/nowhere${QUERY}`);
    expect(response?.status()).toBe(404);
    await expect(page.locator('h1')).toHaveText('Nothing here.');
    await waitForShatterReady(page);
  });
});
