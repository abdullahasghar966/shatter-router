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

/** Search and the changelog (ADR-061). */

const BASE = APPS.docs;
const QUERY = '?debug&budget=5000&seed=7';

test.describe('search', () => {
  test('Ctrl/Cmd+K finds a section, and Enter breaks the page to it', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    const dialog = page.getByRole('dialog', { name: 'Search the docs' });
    await expect(dialog).toBeHidden();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole('combobox', { name: 'Search' });
    await expect(input).toBeFocused();
    await input.fill('rapier floor');
    const first = dialog.getByRole('option').first();
    await expect(first).toContainText('API reference');
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(first).toHaveAttribute('href', '/docs/api#physics');

    await clearLifecycleEvents(page);
    await input.press('Enter');
    await expect.poll(() => lifecycleEvents(page), { timeout: 15_000 }).toEqual(FULL_EFFECT);
    await waitForIdle(page, 15_000);
    await expect(page).toHaveURL(`${BASE}/docs/api#physics`);
    await expect(dialog).toBeHidden();
    expect((await hookState(page)).fallback).toBeNull();
  });

  test('"/" opens it; arrow keys move; a framework section opens its tab', async ({ page }) => {
    await page.goto(`${BASE}/docs`);
    await expect(page.locator('h1')).toHaveText('How a page breaks');
    await page.keyboard.press('/');
    const dialog = page.getByRole('dialog', { name: 'Search the docs' });
    const input = dialog.getByRole('combobox', { name: 'Search' });
    await input.fill('createShatterBrowserRouter');
    const options = dialog.getByRole('option');
    await expect(options.first()).toBeVisible();
    const target = dialog.locator('a[href="/docs/getting-started#react-router"]');
    await expect(target).toBeVisible();
    // Move with the arrows until the React Router section is active.
    const count = await options.count();
    for (let i = 0; i < count; i++) {
      if ((await target.getAttribute('aria-selected')) === 'true') break;
      await input.press('ArrowDown');
    }
    await expect(target).toHaveAttribute('aria-selected', 'true');
    await input.press('Enter');
    await expect(page).toHaveURL(`${BASE}/docs/getting-started#react-router`);
    await expect(page.getByRole('tab', { name: 'React Router' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('#react-router')).toBeVisible();
    // Escape closes the dialog without navigating.
    await page.keyboard.press('/');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.waitForLoadState('networkidle');
  });

  test('says when nothing is found', async ({ page }) => {
    await page.goto(`${BASE}/docs`);
    await page.getByRole('button', { name: 'Search' }).click();
    const dialog = page.getByRole('dialog', { name: 'Search the docs' });
    await dialog.getByRole('combobox', { name: 'Search' }).fill('zebra quasar');
    await expect(dialog.getByRole('status')).toHaveText('Nothing found.');
    await page.waitForLoadState('networkidle');
  });
});

test.describe('changelog', () => {
  test('lists the unreleased changes and every release', async ({ page }) => {
    await page.goto(`${BASE}/docs/changelog`);
    await expect(page.locator('h1')).toHaveText('Changelog');
    const unreleased = page.locator('section[aria-labelledby="unreleased"]');
    await expect(unreleased.getByRole('heading', { name: 'Unreleased' })).toBeVisible();
    await expect(unreleased.locator('li').filter({ hasText: 'Eleven new motions' })).toContainText(
      'minor',
    );
    await expect(page.getByRole('heading', { name: '0.1.0' })).toBeVisible();
    await expect(page.locator('code', { hasText: 'createShatter()' }).first()).toBeVisible();
    await page.waitForLoadState('networkidle');
  });
});
