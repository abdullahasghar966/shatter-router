import type { Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';

/**
 * How the browser paints a page scrolled to a fractional offset (ADR-049).
 * For each page, the live page scrolled to a fractional offset is compared
 * with the same page scrolled to the whole pixels below and above it: the
 * one that matches is what the browser painted. Chromium and WebKit keep
 * whole-pixel scroll offsets; Firefox does not, and (CI, 2026-11-21) painted
 * a plain page rounded down but the vanilla example's /work page rounded to
 * nearest. These variants find what makes the difference.
 */

const LINES = Array.from(
  { length: 90 },
  (_, i) =>
    `<p style="margin:0">Line ${String(i)}: the quick brown fox jumps over the lazy dog</p>`,
).join('');
const BODY = `margin:0;padding:7.3px 20px;font:15.3px/1.37 sans-serif;background:#fff;color:#111`;
const STICKY = `<header style="position:sticky;top:0;background:#eee;padding:10px">Sticky header</header>`;
const FIXED = `<div style="position:fixed;right:8px;bottom:8px;background:#ddd;padding:6px">Fixed badge</div>`;

const PAGES: Record<string, string> = {
  plain: `<body style="${BODY}">${LINES}</body>`,
  sticky: `<body style="${BODY}">${STICKY}${LINES}</body>`,
  fixed: `<body style="${BODY}">${LINES}${FIXED}</body>`,
  'sticky+fixed': `<body style="${BODY}">${STICKY}${LINES}${FIXED}</body>`,
};

function differing(a: Buffer, b: Buffer): number {
  const x = PNG.sync.read(a);
  const y = PNG.sync.read(b);
  let count = 0;
  for (let i = 0; i < x.data.length; i += 4) {
    const d = Math.max(
      Math.abs((x.data[i] ?? 0) - (y.data[i] ?? 0)),
      Math.abs((x.data[i + 1] ?? 0) - (y.data[i + 1] ?? 0)),
      Math.abs((x.data[i + 2] ?? 0) - (y.data[i + 2] ?? 0)),
    );
    if (d > 40) count++;
  }
  return count;
}

async function scrollTo(page: Page, y: number): Promise<number> {
  const actual = await page.evaluate((target) => {
    window.scrollTo(0, target);
    return window.scrollY;
  }, y);
  // Two frames, so the scroll is painted.
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
  return actual;
}

/** Which whole-pixel scroll the browser painted for each fractional one. */
async function painted(page: Page, label: string, project: string): Promise<void> {
  for (const offset of [240.25, 240.5, 240.75]) {
    const scrollY = await scrollTo(page, offset);
    const live = await page.screenshot();
    await scrollTo(page, Math.floor(offset));
    const below = differing(live, await page.screenshot());
    await scrollTo(page, Math.ceil(offset));
    const above = differing(live, await page.screenshot());
    console.log(
      `[scroll-paint] ${project} ${label} scrollY ${String(scrollY)}: vs ${String(Math.floor(offset))} ${String(below)} px, vs ${String(Math.ceil(offset))} ${String(above)} px`,
    );
    // The browser paints a whole-pixel scroll: one of the two must match.
    expect(Math.min(below, above)).toBe(0);
  }
}

test.describe('scroll offsets as painted (diagnostic for ADR-049)', () => {
  for (const [label, html] of Object.entries(PAGES)) {
    test(`page: ${label}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 800, height: 600 });
      await page.setContent(`<!doctype html><html>${html}</html>`);
      await painted(page, label, testInfo.project.name);
    });
  }

  test('page: the vanilla example /work', async ({ page }, testInfo) => {
    await page.goto(`${APPS.vanilla}/work`);
    await painted(page, 'vanilla /work', testInfo.project.name);
  });
});
