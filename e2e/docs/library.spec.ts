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

/** The Library and the effect pages (ADR-061). */

const BASE = APPS.docs;
const QUERY = 'debug&budget=5000&seed=7';

async function hookValue(page: Page, key: 'lastEffect' | 'lastMaterial'): Promise<string | null> {
  return page.evaluate(
    (name) =>
      (window as unknown as { __SHATTER_TEST__?: Record<string, string | null> })
        .__SHATTER_TEST__?.[name] ?? null,
    key,
  );
}

async function settle(page: Page): Promise<void> {
  await expect.poll(() => lifecycleEvents(page), { timeout: 15_000 }).toEqual(FULL_EFFECT);
  await waitForIdle(page, 15_000);
}

test.describe('library', () => {
  test('groups every effect by family and filters by family', async ({ page }) => {
    await page.goto(`${BASE}/effects`);
    await expect(page.locator('h1')).toHaveText('Seventeen ways to break a page.');
    await expect(page.locator('a.card')).toHaveCount(17);
    for (const family of ['Gravity', 'Force', 'Order', 'Matter', 'Assembly']) {
      await expect(page.getByRole('heading', { level: 2, name: family })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Order', exact: true }).click();
    await expect(page.locator('a.card')).toHaveCount(5);
    await expect(page.getByRole('status')).toHaveText('5 of 17 effects');
    await expect.poll(() => new URL(page.url()).searchParams.get('family')).toBe('order');
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.locator('a.card')).toHaveCount(17);
    await expect.poll(() => new URL(page.url()).searchParams.has('family')).toBe(false);
    await page.waitForLoadState('networkidle');
  });

  test('a card breaks with the chosen pattern and material, and Back keeps the view', async ({
    page,
  }) => {
    await page.goto(`${BASE}/effects?family=force&${QUERY}`);
    await waitForShatterReady(page);
    await expect(page.locator('a.card')).toHaveCount(4);
    await page.getByRole('combobox', { name: 'Pattern' }).selectOption('hex');
    await page.getByRole('combobox', { name: 'Material' }).selectOption('ice');
    await expect.poll(() => new URL(page.url()).searchParams.get('material')).toBe('ice');
    const card = page.locator('a.card[href^="/effects/vortex"]');
    await expect(card).toHaveAttribute('href', '/effects/vortex?pattern=hex&material=ice');
    await expect(card.locator('.card-meta')).toContainText('hex');

    await clearLifecycleEvents(page);
    await card.click();
    await settle(page);
    await expect(page).toHaveURL(`${BASE}/effects/vortex?pattern=hex&material=ice`);
    expect(await hookValue(page, 'lastEffect')).toBe('vortex pattern=hex material=ice');
    expect(await hookValue(page, 'lastMaterial')).toBe('ice');
    expect((await hookState(page)).fallback).toBeNull();
    // The effect page starts with the same settings.
    await expect(page.getByRole('combobox', { name: 'Pattern' })).toHaveValue('hex');
    await expect(page.getByRole('combobox', { name: 'Material' })).toHaveValue('ice');

    await clearLifecycleEvents(page);
    await page.goBack();
    await settle(page);
    // The composition plays reversed, and the Library is as it was left.
    expect(await hookValue(page, 'lastEffect')).toBe('vortex pattern=hex material=ice:reverse');
    await expect(page.locator('a.card')).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Force', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('combobox', { name: 'Pattern' })).toHaveValue('hex');
  });
});

test.describe('effect page', () => {
  test('replays in place, in slow motion, with its settings as code', async ({ page }) => {
    await page.goto(`${BASE}/effects/shatter?${QUERY}`);
    await waitForShatterReady(page);
    const code = page.getByTestId('effect-code');
    await expect(code).toContainText("createShatter({ effect: 'shatter' });");

    await clearLifecycleEvents(page);
    await page.getByRole('button', { name: 'Replay' }).click();
    await settle(page);
    expect(new URL(page.url()).pathname).toBe('/effects/shatter');
    expect(await hookValue(page, 'lastEffect')).toBe('shatter');
    expect((await hookState(page)).fallback).toBeNull();

    await page.getByRole('button', { name: /Slow motion/ }).click();
    await expect(page.getByRole('button', { name: /Slow motion/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('combobox', { name: 'Easing' }).selectOption('ease-out');
    await expect(code).toContainText(
      "effect: { motion: 'shatter', timing: { duration: 4400, easing: 'ease-out' } }",
    );
    await expect.poll(() => new URL(page.url()).searchParams.get('slow')).toBe('1');

    // A click on the hero breaks it at the click point.
    await clearLifecycleEvents(page);
    await page.locator('.effect-hero').click({ position: { x: 300, y: 120 } });
    await settle(page);
    expect(await hookValue(page, 'lastEffect')).toBe('shatter duration=4400 easing=ease-out');
    expect((await hookState(page)).fallback).toBeNull();
  });

  test('"Open in Studio" carries the settings to the playground', async ({ page }) => {
    await page.goto(`${BASE}/effects/rain?pattern=strips&material=paper&slow=1`);
    const studio = page.getByRole('link', { name: 'Open in Studio' });
    await expect(studio).toHaveAttribute(
      'href',
      '/playground?effect=rain&pattern=strips&material=paper&duration=4800',
    );
    await studio.click();
    await expect(page.locator('h1')).toHaveText('Tune the glass.');
    const code = page.getByTestId('config-code');
    await expect(code).toContainText("effect: { motion: 'rain', pattern: 'strips' },");
    await expect(code).toContainText("material: 'paper',");
    await expect(code).toContainText('duration: 4800,');
    await page.waitForLoadState('networkidle');
  });
});
