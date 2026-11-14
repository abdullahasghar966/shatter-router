import { writeFile } from 'node:fs/promises';
import type { Page, TestInfo } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export interface SeamResult {
  /** Share of pixels that differ by more than the tolerance, 0..100. */
  readonly percent: number;
  readonly differing: number;
  readonly total: number;
}

/**
 * Per-pixel colour tolerance (pixelmatch's YIQ threshold, 0..1). 0.1 is its
 * default: it ignores sub-perceptual differences such as an 8-bit rounding
 * step but still flags a shifted or missing glyph.
 */
export const SEAM_TOLERANCE = 0.1;

/** Master prompt, section 11: at most 0.5 % of pixels may differ. */
export const SEAM_MAX_PERCENT = 0.5;

/** Compares two same-sized PNG screenshots and attaches them (plus a diff) to the report. */
export async function compareScreenshots(
  testInfo: TestInfo,
  name: string,
  expected: Buffer,
  actual: Buffer,
): Promise<SeamResult> {
  const a = PNG.sync.read(expected);
  const b = PNG.sync.read(actual);
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`Screenshots differ in size: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const differing = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: SEAM_TOLERANCE,
    includeAA: true,
  });
  const total = a.width * a.height;
  const percent = (differing / total) * 100;

  const files: [string, Buffer][] = [
    ['live', expected],
    ['overlay', actual],
    ['diff', PNG.sync.write(diff)],
  ];
  for (const [kind, body] of files) {
    const path = testInfo.outputPath(`${name}-${kind}.png`);
    await writeFile(path, body);
    await testInfo.attach(`${name}-${kind}.png`, { path, contentType: 'image/png' });
  }
  testInfo.annotations.push({
    type: 'seam',
    description: `${name}: ${percent.toFixed(4)} % (${differing}/${total} px)`,
  });
  return { percent, differing, total };
}

interface TestHook {
  pauseAt: string | null;
  paused: string | null;
  resume(): void;
  ready: boolean;
  textureCount(): number;
  lastCaptureMs: number | null;
  lastFallback: string | null;
  layoutGrid(): string | null;
}

type HookWindow = Window & { __SHATTER_TEST__?: TestHook };

/** Waits until Shatter's lazy chunks are loaded and the capturer is warm. */
export async function waitForShatterReady(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as HookWindow).__SHATTER_TEST__?.ready === true);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** Arms the debug hook so the next transition stops once the overlay covers the page. */
export async function pauseAtCovered(page: Page): Promise<void> {
  await page.evaluate(() => {
    const hook = (window as HookWindow).__SHATTER_TEST__;
    if (!hook) throw new Error('debug hook missing: load the page with ?debug');
    hook.pauseAt = 'covered';
  });
}

export async function waitForCovered(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const hook = (window as HookWindow).__SHATTER_TEST__;
    if (hook?.lastFallback) throw new Error(`Shatter fell back: ${hook.lastFallback}`);
    return hook?.paused === 'covered';
  });
}

/** Resumes a paused transition and waits until the overlay is gone and its texture freed. */
export async function resumeAndFinish(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as HookWindow).__SHATTER_TEST__?.resume();
  });
  await page.waitForFunction(() => {
    const hook = (window as HookWindow).__SHATTER_TEST__;
    const overlay = document.querySelector('[data-shatter-overlay]');
    const open = overlay?.matches(':popover-open') ?? false;
    return hook?.paused === null && hook.textureCount() === 0 && !open;
  });
}

export async function readHook(page: Page): Promise<{
  lastCaptureMs: number | null;
  lastFallback: string | null;
  layoutGrid: string | null;
}> {
  return page.evaluate(() => {
    const hook = (window as HookWindow).__SHATTER_TEST__;
    return {
      lastCaptureMs: hook?.lastCaptureMs ?? null,
      lastFallback: hook?.lastFallback ?? null,
      layoutGrid: hook?.layoutGrid() ?? null,
    };
  });
}
