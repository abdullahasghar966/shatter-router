import type { Page, TestInfo } from '@playwright/test';
import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import { hookState, waitForIdle } from '../hook';
import {
  compareScreenshots,
  pauseAt,
  readHook,
  resumeAndFinish,
  SEAM_MAX_BLOCK_PERCENT,
  seamLimit,
  waitForPause,
  waitForShatterReady,
} from '../seam';

const BASE = APPS.reactRouter;
const QUERY = '?debug&budget=5000&seed=7&duration=300';

/** Forgets the lifecycle events recorded so far (the example keeps one array). */
async function clearEvents(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as { __shatterEvents?: string[] }).__shatterEvents?.splice(0);
  });
}

async function events(page: Page): Promise<string[]> {
  return page.evaluate(() => [
    ...((window as { __shatterEvents?: string[] }).__shatterEvents ?? []),
  ]);
}

const FULL_EFFECT = ['start', 'covered', 'committed', 'animating', 'end'];

test.describe('React Router example: transitions', () => {
  test('a loader route: the overlay stays up until the loaded page has rendered', async ({
    page,
  }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await pauseAt(page, 'animating');
    await page.getByRole('link', { name: 'Slow', exact: true }).click();
    await waitForPause(page, 'animating');
    // The motion has not started, yet the new page (with its loader data) is
    // already in the DOM under the overlay.
    await expect(page.locator('h1')).toHaveText('Worth the wait.');
    await expect(page.getByTestId('slow-data')).toHaveText('Loaded after 400 ms.');
    const { timings } = await hookState(page);
    console.log(
      `[react-router] ${test.info().project.name}: committing ${timings.committing?.toFixed(0) ?? '?'} ms (loader 400 ms)`,
    );
    expect(timings.committing).toBeGreaterThanOrEqual(350);
    await resumeAndFinish(page);
    await expect(page).toHaveURL(`${BASE}/slow`);
    expect((await hookState(page)).fallback).toBeNull();
  });

  test('back and forward shatter, land on the right route and restore scroll', async ({ page }) => {
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

    // Diagnostics: every scroll position change with the route and lifecycle
    // events at that moment, printed at the end (CI-only Firefox issue).
    await page.evaluate(() => {
      const log: string[] = [];
      (window as unknown as { __scrollLog: string[] }).__scrollLog = log;
      const note = (what: string): void => {
        const ev = (window as { __shatterEvents?: string[] }).__shatterEvents ?? [];
        log.push(
          `${performance.now().toFixed(0)} ${what} y=${window.scrollY.toFixed(1)} url=${location.pathname} h1=${document.querySelector('h1')?.textContent ?? ''} ev=${ev.join(',')} sr=${history.scrollRestoration}`,
        );
      };
      window.addEventListener(
        'scroll',
        () => {
          note('scroll');
        },
        { passive: true },
      );
      window.addEventListener(
        'popstate',
        () => {
          note('popstate-capture');
        },
        true,
      );
      window.addEventListener('popstate', () => {
        note('popstate-bubble');
      });
    });
    await clearEvents(page);
    await page.goBack();
    await expect.poll(() => events(page)).toEqual(FULL_EFFECT);
    await waitForIdle(page);
    await expect(page).toHaveURL(`${BASE}/work${QUERY}`);
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
    expect(await page.evaluate(() => window.scrollY)).toBe(300);
    expect((await hookState(page)).fallback).toBeNull();

    await clearEvents(page);
    await page.goForward();
    await expect.poll(() => events(page)).toEqual(FULL_EFFECT);
    await waitForIdle(page);
    await expect(page).toHaveURL(`${BASE}/about`);
    await expect(page.locator('h1')).toHaveText('Links that behave.');
    const scrollLog = await page.evaluate(
      () => (window as unknown as { __scrollLog: string[] }).__scrollLog,
    );
    console.log(`[scroll-log] ${test.info().project.name}\n${scrollLog.join('\n')}`);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect((await hookState(page)).fallback).toBeNull();
  });

  test('with the plain createBrowserRouter, back/forward still land on the right route', async ({
    page,
  }) => {
    await page.goto(`${BASE}/${QUERY}&mode=data-plain`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'About', exact: true }).click();
    await waitForIdle(page);
    await page.goBack();
    await expect(page.locator('h1')).toHaveText('Break the page.');
    await waitForIdle(page);
    await page.goForward();
    await expect(page.locator('h1')).toHaveText('Links that behave.');
    await waitForIdle(page);
  });

  test('back: the overlay shows the outgoing page, not the incoming one', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'About', exact: true }).click();
    await waitForIdle(page);
    const outgoing = await page.screenshot();
    await pauseAt(page, 'covered');
    await page.goBack();
    await waitForPause(page, 'covered');
    // The router has not rendered Home yet: its popstate is held until covered.
    await expect(page.locator('h1')).toHaveText('Links that behave.');
    const covered = await page.screenshot();
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    const result = await compareScreenshots(
      test.info(),
      'back-covered',
      outgoing,
      covered,
      Math.max(0, Math.round(Math.min(dpr, 2)) - 1),
    );
    console.log(
      `[seam] ${test.info().project.name} react-router back: ${result.percent.toFixed(4)} % (raw ${result.rawPercent.toFixed(4)} %)`,
    );
    expect(result.percent).toBeLessThanOrEqual(seamLimit(test.info().project.name, dpr));
    await resumeAndFinish(page);
    await expect(page.locator('h1')).toHaveText('Break the page.');
  });

  test('a rapid double click on two links ends on the second route', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await page.evaluate(() => {
      document.querySelector<HTMLAnchorElement>('nav a[href="/work"]')?.click();
      document.querySelector<HTMLAnchorElement>('nav a[href="/about"]')?.click();
    });
    await waitForIdle(page);
    await expect(page).toHaveURL(`${BASE}/about`);
    await expect(page.locator('h1')).toHaveText('Links that behave.');
    expect((await hookState(page)).textures).toBe(0);
  });

  test('declarative mode (<BrowserRouter>): links and back shatter', async ({ page }) => {
    await page.goto(`${BASE}/${QUERY}&mode=declarative`);
    await waitForShatterReady(page);
    await page.getByRole('link', { name: 'Slow', exact: true }).click();
    await waitForIdle(page);
    await expect(page.getByTestId('slow-data')).toHaveText('No loader in declarative mode.');
    expect((await hookState(page)).fallback).toBeNull();
    await clearEvents(page);
    await page.goBack();
    await expect.poll(() => events(page)).toEqual(FULL_EFFECT);
    await waitForIdle(page);
    await expect(page.locator('h1')).toHaveText('Break the page.');
    expect((await hookState(page)).fallback).toBeNull();
  });
});

async function firstFrameSeam(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  // Diagnostics for the platform font of form controls (ADR-029), CI only.
  const buttonFont = await page.evaluate(() => {
    const button = document.querySelector('button');
    const families = ['-webkit-standard', 'sans-serif', 'serif', 'monospace', 'system-ui'];
    const context = document.createElement('canvas').getContext('2d');
    const canvas = families.map((family) => {
      if (!context) return `${family}=?`;
      context.font = `72px ${family}`;
      return `${family}=${context.measureText('mmmwwwiiil0O@Qg').width.toFixed(2)}(${context.font})`;
    });
    const dom = families.map((family) => {
      const span = document.createElement('span');
      span.style.cssText = `position:absolute;visibility:hidden;font:72px ${family};white-space:nowrap`;
      span.textContent = 'mmmwwwiiil0O@Qg';
      document.body.append(span);
      const width = span.getBoundingClientRect().width;
      span.remove();
      return `${family}=${width.toFixed(2)}`;
    });
    return `${button ? getComputedStyle(button).font : 'no button'} | canvas ${canvas.join(' ')} | dom ${dom.join(' ')}`;
  });
  console.log(`[button-font] ${testInfo.project.name}: ${buttonFont}`);
  const link = page.getByRole('link', { name: 'Work', exact: true });
  await link.hover();
  const live = await page.screenshot();
  await pauseAt(page, 'covered');
  await link.click();
  await waitForPause(page, 'covered');
  const overlay = await page.screenshot();
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const shiftRadius = Math.max(0, Math.round(Math.min(dpr, 2)) - 1);
  const result = await compareScreenshots(testInfo, name, live, overlay, shiftRadius);
  await resumeAndFinish(page);
  const hook = await readHook(page);
  expect(hook.lastFallback).toBeNull();
  console.log(
    `[seam] ${testInfo.project.name} react-router ${name}: ${result.percent.toFixed(4)} % differ (raw ${result.rawPercent.toFixed(4)} %, worst block ${result.worstBlockPercent.toFixed(1)} %), capture ${hook.lastCaptureMs?.toFixed(1) ?? '?'} ms`,
  );
  expect(result.percent).toBeLessThanOrEqual(seamLimit(testInfo.project.name, dpr));
  expect(result.worstBlockPercent).toBeLessThanOrEqual(SEAM_MAX_BLOCK_PERCENT);
}

test.describe('React Router example: first-frame seam', () => {
  test('at the top of the home page', async ({ page }, testInfo) => {
    await page.goto(`${BASE}/${QUERY}`);
    await waitForShatterReady(page);
    await firstFrameSeam(page, testInfo, 'top');
    await expect(page.locator('h1')).toHaveText('Six pieces of glass.');
  });
});
