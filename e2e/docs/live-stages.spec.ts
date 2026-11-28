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

/**
 * Live stages (ADR-067): the Library's card art breaks in place on a resting
 * pointer, and the home page's specimen strip breaks on scroll and on press.
 */

const BASE = APPS.docs;
const QUERY = 'debug&budget=5000&seed=7';

async function centreOf(
  page: Page,
  selector: string,
  index = 0,
): Promise<{ x: number; y: number }> {
  const target = page.locator(selector).nth(index);
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Scrolls so the specimen section is at `progress` (0..1) through its pinned range. */
async function scrollSpecimens(page: Page, progress: number): Promise<void> {
  await page.evaluate((p) => {
    const section = document.querySelector<HTMLElement>('.specimen-section');
    const pin = document.querySelector<HTMLElement>('.specimen-pin');
    if (!section || !pin) throw new Error('no specimen section');
    const top = Math.round(section.getBoundingClientRect().top + window.scrollY);
    const range = Math.round(section.offsetHeight - pin.offsetHeight);
    window.scrollTo(0, top + Math.round(p * range));
  }, progress);
}

function featuredClip(page: Page): Promise<string> {
  return page.evaluate(
    () => document.querySelector<HTMLElement>('.specimen.featured')?.style.clipPath ?? '',
  );
}

test.describe('Library: live card stages (ADR-067)', () => {
  test('resting the pointer on a card breaks its art in place, and nothing navigates', async ({
    page,
  }) => {
    await page.goto(`${BASE}/effects?${QUERY}`);
    await waitForShatterReady(page);
    await clearLifecycleEvents(page);
    const { x, y } = await centreOf(page, '.card-art');
    await page.mouse.move(x, y);
    await expect.poll(() => lifecycleEvents(page), { timeout: 15_000 }).toEqual(FULL_EFFECT);
    await waitForIdle(page, 15_000);
    expect(new URL(page.url()).pathname).toBe('/effects');
    expect((await hookState(page)).textures).toBe(0);
  });

  test('a pointer that only passes over a card does not break it', async ({ page }) => {
    await page.goto(`${BASE}/effects?${QUERY}`);
    await waitForShatterReady(page);
    await clearLifecycleEvents(page);
    const { x, y } = await centreOf(page, '.card-art');
    await page.mouse.move(x, y);
    await page.waitForTimeout(150);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(1500);
    expect(await lifecycleEvents(page)).toEqual([]);
  });

  test('a resting pointer breaks the card once per visit', async ({ page }) => {
    await page.goto(`${BASE}/effects?${QUERY}`);
    await waitForShatterReady(page);
    await clearLifecycleEvents(page);
    const { x, y } = await centreOf(page, '.card-art');
    await page.mouse.move(x, y);
    await expect.poll(() => lifecycleEvents(page), { timeout: 15_000 }).toEqual(FULL_EFFECT);
    await waitForIdle(page, 15_000);
    // The pointer stays on the card: the stage does not break again.
    await page.waitForTimeout(2000);
    const starts = (await lifecycleEvents(page)).filter((event) => event === 'start');
    expect(starts).toHaveLength(1);
  });
});

test.describe('Home: specimen strip (ADR-067)', () => {
  test('the featured specimen breaks as its section scrolls, and is whole at the top', async ({
    page,
  }) => {
    await page.goto(`${BASE}/?${QUERY}`);
    await waitForShatterReady(page);
    await scrollSpecimens(page, 0);
    await page.waitForTimeout(300);
    expect(await featuredClip(page)).toBe('');
    await scrollSpecimens(page, 1);
    await expect.poll(() => featuredClip(page)).toBe('inset(100%)');
    // Still in the accessibility tree: the break hides it, it does not remove it.
    await expect(page.getByRole('heading', { name: 'Shatter', exact: true })).toHaveCount(1);
  });

  test('pressing a specimen breaks it in place and nothing navigates', async ({ page }) => {
    await page.goto(`${BASE}/?${QUERY}`);
    await waitForShatterReady(page);
    await clearLifecycleEvents(page);
    await page.getByRole('button', { name: 'Break the Melt specimen' }).click();
    await expect.poll(() => lifecycleEvents(page), { timeout: 15_000 }).toEqual(FULL_EFFECT);
    await waitForIdle(page, 15_000);
    expect(new URL(page.url()).pathname).toBe('/');
    expect((await hookState(page)).textures).toBe(0);
  });

  test('a specimen breaks from the keyboard', async ({ page }) => {
    await page.goto(`${BASE}/?${QUERY}`);
    await waitForShatterReady(page);
    await clearLifecycleEvents(page);
    await page.getByRole('button', { name: 'Break the Ripple specimen' }).focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => lifecycleEvents(page), { timeout: 15_000 }).toEqual(FULL_EFFECT);
    await waitForIdle(page, 15_000);
  });
});
