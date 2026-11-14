import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import { hookState, waitForIdle } from '../hook';
import { waitForShatterReady } from '../seam';

const BASE = APPS.vanilla;
const QUERY = '?debug&budget=5000&seed=7&duration=300';

test.describe('vanilla example: back and forward', () => {
  test('back and forward shatter too, and restore the scroll position', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto(`${BASE}/work${QUERY}`);
    await waitForShatterReady(page);
    await page.evaluate(() => {
      window.scrollTo(0, 300);
    });
    await page.getByRole('link', { name: 'About', exact: true }).click();
    await waitForIdle(page);
    await expect(page.locator('h1')).toHaveText('Links that behave.');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await page.goBack();
    await waitForIdle(page);
    await expect(page).toHaveURL(`${BASE}/work${QUERY}`);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    expect(await page.evaluate(() => window.scrollY)).toBe(300);
    const back = await hookState(page);
    expect(back.fallback).toBeNull();
    expect(back.animation?.frames).toBeGreaterThan(0);

    await page.goForward();
    await waitForIdle(page);
    await expect(page.locator('h1')).toHaveText('Links that behave.');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});
