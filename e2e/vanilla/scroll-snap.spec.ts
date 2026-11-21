import { PNG } from 'pngjs';
import { expect, test } from '../fixtures';

/**
 * How the browser paints a page scrolled to a fractional offset (ADR-049).
 * Compares the live scrolled page with the same page unscrolled and pulled up
 * by a negative margin of the exact offset, or the offset rounded down, to
 * nearest, or up. The capture must shift its copy the way the browser paints.
 * Chromium and WebKit keep whole-pixel scroll offsets; Firefox does not.
 */

const LINES = Array.from(
  { length: 90 },
  (_, i) =>
    `<p style="margin:0">Line ${String(i)}: the quick brown fox jumps over the lazy dog</p>`,
).join('');
// A fractional line height puts every line at a different sub-pixel position.
const PAGE = `<!doctype html><html><body style="margin:0;padding:7.3px 20px;font:15.3px/1.37 sans-serif;background:#fff;color:#111">${LINES}</body></html>`;

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

test.describe('scroll offsets as painted (diagnostic for ADR-049)', () => {
  for (const offset of [240.25, 240.5, 240.75]) {
    test(`a page scrolled to ${String(offset)} px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 800, height: 600 });
      await page.setContent(PAGE);
      const scrollY = await page.evaluate((y) => {
        window.scrollTo(0, y);
        return window.scrollY;
      }, offset);
      const live = await page.screenshot();
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      const candidates = {
        exact: scrollY,
        floor: Math.floor(scrollY),
        round: Math.round(scrollY),
        ceil: Math.ceil(scrollY),
      };
      const results: Record<string, number> = {};
      for (const [name, shift] of Object.entries(candidates)) {
        await page.evaluate((s) => {
          document.documentElement.style.marginTop = `${String(-s)}px`;
        }, shift);
        results[name] = differing(live, await page.screenshot());
      }
      console.log(
        `[scroll-snap] ${testInfo.project.name} asked ${String(offset)} scrollY ${String(scrollY)}: ${JSON.stringify(results)}`,
      );
      // The capture's rule (snapScroll: round down to device pixels) must
      // reproduce the live page exactly. Firefox CI, 2026-11-21: floor 0 at
      // .25, .5 and .75; round only at .25; exact and ceil never.
      expect(results.floor).toBe(0);
    });
  }
});
