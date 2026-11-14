import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import { hookState, waitForIdle, waitForState } from '../hook';
import { waitForShatterReady } from '../seam';

const BASE = APPS.vanilla;
/** A long motion so there is time to interrupt it. */
const QUERY = '?debug&budget=5000&seed=7&duration=4000';

test.describe('vanilla example: interruptions', () => {
  test('a rapid double click on two different links ends on the second route', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    // Both clicks land before the first transition can cover the page.
    await page.evaluate(() => {
      document.querySelector<HTMLAnchorElement>('nav a[href="/work"]')?.click();
      document.querySelector<HTMLAnchorElement>('nav a[href="/about"]')?.click();
    });
    await waitForIdle(page);
    await expect(page).toHaveURL(`${BASE}/about`);
    await expect(page.locator('h1')).toHaveText('Links that behave.');
    expect((await hookState(page)).textures).toBe(0);
  });

  test('a second navigation during the animation fast-forwards it, then runs', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await waitForState(page, 'animating');
    const started = Date.now();
    // The overlay catches pointer input, so navigate programmatically.
    await page.evaluate(() => {
      document.querySelector<HTMLAnchorElement>('nav a[href="/about"]')?.click();
    });
    await waitForIdle(page);
    await expect(page).toHaveURL(`${BASE}/about`);
    // Far less than two 4 s animations: the first one was cut short.
    expect(Date.now() - started).toBeLessThan(6000);
  });

  test('Escape during the animation skips to the end', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await waitForState(page, 'animating');
    const started = Date.now();
    await page.keyboard.press('Escape');
    await waitForIdle(page);
    expect(Date.now() - started).toBeLessThan(1500);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
  });

  test('a click on the overlay during the animation skips to the end', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await waitForState(page, 'animating');
    const started = Date.now();
    await page.mouse.click(640, 400);
    await waitForIdle(page);
    expect(Date.now() - started).toBeLessThan(1500);
    // The click was caught by the overlay: still on /work.
    await expect(page).toHaveURL(`${BASE}/work`);
  });

  test('the back button during the animation ends on the previous route', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await waitForState(page, 'animating');
    await page.goBack();
    await waitForIdle(page);
    await expect(page).toHaveURL(`${BASE}/${QUERY}`);
    await expect(page.locator('h1')).toHaveText('Break the page.');
  });

  test('wheel scrolling is blocked during the transition and works after', async ({ page }) => {
    await page.goto(`${BASE}/work${QUERY}`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'About', exact: true }).click();
    await waitForState(page, 'animating');
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.keyboard.press('Escape');
    await waitForIdle(page);
    await page.goto(`${BASE}/work${QUERY}`);
    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, 300);
    await page.waitForFunction(() => window.scrollY > 0);
  });
});
