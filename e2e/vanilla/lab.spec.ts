import type { Locator, Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';
import { hookState } from '../hook';
import { pauseAt, resumeAndFinish, waitForPause, waitForShatterReady } from '../seam';

const BASE = APPS.vanilla;
const QUERY = '?debug&budget=5000&seed=7';

type Rgb = readonly [number, number, number];

/** The average colour of a small square at the centre of `locator`, in a screenshot. */
async function centreColour(page: Page, png: PNG, locator: Locator, dx = 0, dy = 0): Promise<Rgb> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element has no box');
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const cx = Math.round((box.x + box.width / 2 + dx) * dpr);
  const cy = Math.round((box.y + box.height / 2 + dy) * dpr);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = cy - 2; y <= cy + 2; y++) {
    for (let x = cx - 2; x <= cx + 2; x++) {
      const i = (y * png.width + x) * 4;
      r += png.data[i] ?? 0;
      g += png.data[i + 1] ?? 0;
      b += png.data[i + 2] ?? 0;
      n++;
    }
  }
  return [r / n, g / n, b / n];
}

function expectColour(actual: Rgb, expected: Rgb, tolerance = 24): void {
  for (let i = 0; i < 3; i++) {
    expect(
      Math.abs((actual[i] ?? 0) - (expected[i] ?? 0)),
      `channel ${i} of ${actual.join(',')}`,
    ).toBeLessThanOrEqual(tolerance);
  }
}

test.describe('vanilla example: hard-to-capture content (section 9)', () => {
  test('every case is captured without tainting, errors or a fallback', async ({ page }) => {
    await page.goto(`${BASE}/lab${QUERY}`);
    await waitForShatterReady(page);
    // Let the canvas-stream video produce frames where the browser can (Playwright's
    // Windows WebKit has no captureStream; Linux WebKit has it but never delivers a
    // frame). Without a frame the substitute shows the video's background colour.
    const streams = await page
      .waitForFunction(
        () => {
          const video = document.querySelector<HTMLVideoElement>('#lab-video');
          return video !== null && video.readyState >= 2;
        },
        undefined,
        { timeout: 5000 },
      )
      .then(
        () => true,
        () => false,
      );
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    await page.getByRole('link', { name: 'Back home' }).hover();
    const live = PNG.sync.read(await page.screenshot());
    await pauseAt(page, 'covered');
    await page.getByRole('link', { name: 'Back home' }).click();
    await waitForPause(page, 'covered');
    const overlay = PNG.sync.read(await page.screenshot());

    // Cross-origin iframe → a solid box in its computed background colour.
    expectColour(
      await centreColour(page, overlay, page.locator('#lab-iframe')),
      [0x2b, 0x6c, 0xb0],
    );
    // Video with readable frames → the current frame (the stream is orange);
    // without a frame or poster → its background colour.
    expectColour(
      await centreColour(page, overlay, page.locator('#lab-video')),
      streams ? [0xff, 0x88, 0x00] : [0x33, 0x33, 0x33],
    );
    // Video without a source → its poster (left half red, right half blue).
    expectColour(await centreColour(page, overlay, page.locator('#lab-poster'), -80), [255, 0, 0]);
    expectColour(await centreColour(page, overlay, page.locator('#lab-poster'), 80), [0, 0, 255]);
    // 2D canvas → its pixels.
    const canvasLive = await centreColour(page, live, page.locator('#lab-canvas'));
    expectColour(await centreColour(page, overlay, page.locator('#lab-canvas')), canvasLive, 8);
    // Cross-origin image without CORS → the transparent placeholder over its background.
    expectColour(await centreColour(page, overlay, page.locator('#lab-cors')), [0x11, 0x11, 0x11]);
    // data-shatter-ignore → its background colour, no text.
    expectColour(
      await centreColour(page, overlay, page.locator('#lab-ignore')),
      [0x6d, 0x5e, 0xfc],
    );

    await resumeAndFinish(page);
    expect((await hookState(page)).fallback).toBeNull();
    await expect(page.locator('h1')).toHaveText('Break the page.');
  });
});
