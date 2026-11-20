// Records the README demo (media/shatter-demo.gif): `shatter` on the docs site,
// in installed Chrome on the GPU, through the DevTools screencast (real-time
// frames), encoded as a GIF at about 30 fps.
//
// 1. Build and start the docs site: pnpm build && pnpm build:examples &&
//    pnpm --filter @shatter-router/docs start   (serves http://localhost:4176)
// 2. Install the encoders outside the repo: npm i gifenc@1.0.3 jpeg-js@0.4.4
//    (in an empty folder of your choice)
// 3. node scripts/record-demo.mjs <that folder> media/shatter-demo.gif
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const [encoderDir, out = 'media/shatter-demo.gif'] = process.argv.slice(2);
const require = createRequire(join(encoderDir, 'package.json'));
const { GIFEncoder, quantize, applyPalette } = require('gifenc');
const jpeg = require('jpeg-js');

const WIDTH = 1200;
const HEIGHT = 750;
const GIF_WIDTH = 640;

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
await page.goto('http://localhost:4176/?debug');
await page.waitForFunction(() => window.__SHATTER_TEST__?.ready === true);
await page.evaluate(() => document.fonts.ready);
// A visitor's first pointer move primes the capturer (ADR-043).
await page.mouse.move(300, 300);
await page.waitForTimeout(1500);
const link = page.getByRole('link', { name: 'See every effect' });
const box = await link.boundingBox();
if (!box) throw new Error('link not found');
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
await page.waitForTimeout(400);

const cdp = await page.context().newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', (event) => {
  frames.push({ data: event.data, time: event.metadata.timestamp ?? Date.now() / 1000 });
  void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
});
await cdp.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 85,
  maxWidth: GIF_WIDTH,
  maxHeight: Math.round((GIF_WIDTH * HEIGHT) / WIDTH),
  everyNthFrame: 1,
});
await page.waitForTimeout(300);
await link.click();
await page.waitForFunction(
  () => window.__SHATTER_TEST__?.state() === 'idle' && location.pathname === '/effects',
  null,
  { timeout: 15000 },
);
await page.waitForTimeout(900);
await cdp.send('Page.stopScreencast');
await browser.close();

console.log(`frames: ${String(frames.length)}`);
// About 30 fps: drop frames closer than 30 ms to the last kept one (their
// time goes to the kept frame's delay).
const kept = frames.filter((frame, i) => {
  if (i === 0 || i === frames.length - 1) return true;
  const previous = frames
    .slice(0, i)
    .reverse()
    .find((f) => f.kept);
  const keep = !previous || frame.time - previous.time >= 0.03;
  frame.kept = keep;
  return keep;
});
frames[0].kept = true;
frames.length = 0;
frames.push(...kept);
console.log(`kept: ${String(frames.length)}`);
const gif = GIFEncoder();
frames.forEach((frame, i) => {
  const { width, height, data } = jpeg.decode(Buffer.from(frame.data, 'base64'), {
    useTArray: true,
    formatAsRGBA: true,
  });
  const palette = quantize(data, 256);
  const index = applyPalette(data, palette);
  const next = frames[i + 1];
  const delay =
    i === 0 ? 800 : next ? Math.max(20, Math.round((next.time - frame.time) * 1000)) : 1800;
  gif.writeFrame(index, width, height, { palette, delay });
});
gif.finish();
const bytes = gif.bytes();
writeFileSync(out, bytes);
console.log(`${out}: ${(bytes.length / 1024 / 1024).toFixed(2)} MB`);
