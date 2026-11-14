import type { Page } from '@playwright/test';
import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';

const BASE = APPS.vanilla;

/** Counts full document loads, to prove a navigation stayed client-side. */
async function documentLoads(page: Page): Promise<number> {
  return page.evaluate(() => performance.getEntriesByType('navigation').length);
}

test.describe('vanilla example: navigation', () => {
  test('internal links navigate client-side', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('h1')).toHaveText('Break the page.');
    await page.evaluate(() => {
      (window as unknown as { __marker: string }).__marker = 'same-document';
    });

    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await expect(page).toHaveURL(`${BASE}/work`);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    await expect(page).toHaveTitle(/^Work/);
    await expect(page.locator('.card')).toHaveCount(6);
    await expect(page.locator('nav a[aria-current="page"]')).toHaveText('Work');

    // The window object survived, so no document load happened.
    expect(await page.evaluate(() => (window as unknown as { __marker?: string }).__marker)).toBe(
      'same-document',
    );
    expect(await documentLoads(page)).toBe(1);
  });

  test('back and forward restore the route', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('link', { name: 'About', exact: true }).click();
    await expect(page.locator('h1')).toHaveText('Links that behave.');

    await page.goBack();
    await expect(page).toHaveURL(`${BASE}/`);
    await expect(page.locator('h1')).toHaveText('Break the page.');

    await page.goForward();
    await expect(page).toHaveURL(`${BASE}/about`);
    await expect(page.locator('h1')).toHaveText('Links that behave.');
  });

  test('deep links render the right route', async ({ page }) => {
    await page.goto(`${BASE}/work`);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
  });

  test('target="_blank" is left to the browser', async ({ page, context }) => {
    await page.goto(`${BASE}/about`);
    const popupPromise = context.waitForEvent('page');
    await page.getByRole('link', { name: 'Work in a new tab' }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    expect(popup.url()).toBe(`${BASE}/work`);
    await expect(page).toHaveURL(`${BASE}/about`);
    await popup.close();
  });

  test('data-shatter="off" does a full document navigation', async ({ page }) => {
    await page.goto(`${BASE}/about`);
    await page.evaluate(() => {
      (window as unknown as { __marker: string }).__marker = 'old-document';
    });
    await page.getByRole('link', { name: /opted out/ }).click();
    await expect(page).toHaveURL(`${BASE}/work`);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    expect(
      await page.evaluate(() => (window as unknown as { __marker?: string }).__marker),
    ).toBeUndefined();
  });

  test('same-page hash links do not re-render the route', async ({ page }) => {
    await page.goto(`${BASE}/about`);
    await page.locator('h1').evaluate((h1) => {
      h1.setAttribute('data-kept', 'yes');
    });
    await page.getByRole('link', { name: 'Same-page anchor' }).click();
    await expect(page).toHaveURL(`${BASE}/about#links`);
    await expect(page.locator('h1')).toHaveAttribute('data-kept', 'yes');
  });
});
