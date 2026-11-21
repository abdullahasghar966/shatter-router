import type { Page } from '@playwright/test';
import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import { clearLifecycleEvents, FULL_EFFECT, lifecycleEvents, waitForIdle } from '../hook';
import { waitForShatterReady } from '../seam';

/** The "Material lab" site (ADR-050): theme, materials, glass rail, interactions. */

const BASE = APPS.docs;
const QUERY = '?debug&budget=5000&seed=7';

async function root(page: Page, name: string): Promise<string | null> {
  return page.evaluate((attribute) => document.documentElement.getAttribute(attribute), name);
}

test.describe('docs site: Material lab', () => {
  test('a material switch plays a flip and is remembered across navigation and reload', async ({
    page,
  }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    expect(await root(page, 'data-material')).toBe('glass');
    await clearLifecycleEvents(page);
    await page.getByRole('button', { name: 'Material: obsidian' }).click();
    await expect.poll(() => lifecycleEvents(page), { timeout: 15_000 }).toEqual(FULL_EFFECT);
    await waitForIdle(page, 15_000);
    expect(await root(page, 'data-material')).toBe('obsidian');
    await expect(page.getByRole('button', { name: 'Material: obsidian' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // The flip's back face was the page in the new material.
    expect(
      await page.evaluate(
        () =>
          (window as { __SHATTER_TEST__?: { lastEffect: string | null } }).__SHATTER_TEST__
            ?.lastEffect,
      ),
    ).toBe('flip');

    await page.getByRole('link', { name: 'Docs', exact: true }).click();
    await waitForIdle(page, 15_000);
    expect(await root(page, 'data-material')).toBe('obsidian');
    await page.reload();
    // Applied before the first paint by the inline script.
    expect(await root(page, 'data-material')).toBe('obsidian');
  });

  test('the theme toggle switches light and dark and is remembered', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    const background = (): Promise<string> =>
      page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    const light = await background();
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect.poll(() => root(page, 'data-theme'), { timeout: 15_000 }).toBe('dark');
    await waitForIdle(page, 15_000);
    expect(await background()).not.toBe(light);
    await page.reload();
    expect(await root(page, 'data-theme')).toBe('dark');
    await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
  });

  test('the system dark scheme is followed until the visitor picks a theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(`${BASE}/`);
    expect(await root(page, 'data-theme')).toBeNull();
    const background = await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    );
    expect(background).toBe('rgb(17, 17, 15)');
  });

  test('the glass rail tracks the scroll and can be dragged; the native scrollbar is hidden', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE}/docs/api`);
    const rail = page.locator('.glass-rail');
    await expect(rail).toHaveAttribute('data-hidden', 'false');
    await expect(rail).toHaveAttribute('aria-hidden', 'true');
    const thumb = page.locator('.glass-thumb');
    const before = await thumb.boundingBox();
    // Keyboard scrolling is native and still works.
    await page.keyboard.press('End');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    await expect
      .poll(async () => (await thumb.boundingBox())?.y ?? 0)
      .toBeGreaterThan((before?.y ?? 0) + 100);
    // Drag the thumb back up.
    const box = await thumb.boundingBox();
    if (!box) throw new Error('no thumb');
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, 20, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50);
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth),
    ).toBe('none');
  });

  test('entrances run on the first load only; client navigations do not animate', async ({
    page,
  }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await expect.poll(() => root(page, 'data-entered')).toBe('');
    const animation = await page.evaluate(
      () =>
        getComputedStyle(document.querySelector('.reveal > span') ?? document.body).animationName,
    );
    expect(animation).toBe('none');
  });

  test('a press during the first-load entrance ends it at once, before any capture', async ({
    page,
  }) => {
    await page.goto(`${BASE}/`);
    // Once interactive; before that Shatter does not exist, so nothing can be
    // captured. Clear the flag so the test does not depend on the clock.
    await page.waitForFunction(() => document.documentElement.dataset.lab === 'ready');
    await page.evaluate(() => {
      document.documentElement.removeAttribute('data-entered');
    });
    await page.mouse.move(900, 300);
    await page.mouse.down();
    expect(await root(page, 'data-entered')).toBe('');
    await page.mouse.up();
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('no cursor ring, no entrance, no card tilt', async ({ page }) => {
      await page.goto(`${BASE}/effects`);
      await page.mouse.move(400, 500);
      await page.mouse.move(420, 520);
      await expect(page.locator('.cursor-ring')).toBeHidden();
      const card = page.locator('.card').first();
      await card.hover({ position: { x: 300, y: 40 } });
      expect(await card.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
    });
  });
});
