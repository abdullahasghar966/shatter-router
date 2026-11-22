import type { Page } from '@playwright/test';
import { APPS } from '../../playwright.config';
import { trackLoopAllocations } from '../alloc';
import { expect, test } from '../fixtures';
import {
  clearLifecycleEvents,
  FULL_EFFECT,
  hookState,
  lifecycleEvents,
  waitForIdle,
} from '../hook';
import { pauseAt, waitForPause, waitForShatterReady } from '../seam';

/**
 * Section 8 performance budgets, measured on the vanilla example at 1440x900
 * with 160 shards.
 *
 * The structural budgets run everywhere: one draw call per frame (every
 * engine), no allocations per frame in the render loop, and textures freed
 * after `end` (Chromium, through the Chrome DevTools Protocol). The frame-rate
 * and long-task budgets need a real GPU: CI and headless runs use software GL,
 * so there they are printed, not enforced. `SHATTER_PERF=1` runs headed Chrome
 * on the machine's GPU and enforces them (PROGRESS records the numbers).
 */

const PERF = Boolean(process.env.SHATTER_PERF);
const BASE = APPS.vanilla;
const QUERY = '?debug&budget=5000&seed=7&shards=160';
const EFFECTS = [
  'shatter',
  'explode',
  'implode',
  'flip',
  'assemble',
  // Motion families (ADR-055).
  'crumble',
  'rain',
  'vortex',
  'wind',
  'blinds',
  'domino',
  'slide',
  'fold',
  'melt',
  'ripple',
  'glitch',
] as const;
/** Materials (ADR-057). */
const MATERIALS = ['glass', 'ice', 'mirror', 'obsidian', 'paper', 'metal', 'holo'] as const;
/** Section 8: no long task over 50 ms outside the capture step. */
const LONG_TASK_MS = 50;
/** Waits for a whole transition: CI software GL can draw 2 fps (`flip`, 3 s of motion). */
const SLOW_MS = 30_000;

test.use({ viewport: { width: 1440, height: 900 } });
if (PERF) {
  test.use({
    // The installed Google Chrome: Playwright's own full Chromium build does
    // not start on the dev machine (side-by-side error, LEARNINGS).
    channel: 'chrome',
    headless: false,
    // The discrete GPU the budgets were measured on: Chrome may otherwise
    // pick the integrated one (it did in session 5, LEARNINGS).
    launchOptions: {
      args: [
        '--ignore-gpu-blocklist',
        '--enable-gpu-rasterization',
        '--force_high_performance_gpu',
      ],
    },
  });
}

interface PerfWindow {
  __perf?: { frames: number[]; current: number };
  __longTasks?: { start: number; duration: number }[];
  __shatterEventTimes?: number[];
}

/**
 * Counts GL draw calls between consecutive `clear`s. The engine clears once
 * per drawn frame, so each entry is the number of draw calls of one frame.
 * Also records long tasks.
 */
async function instrument(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const perf = { frames: [] as number[], current: -1 };
    const w = window as PerfWindow;
    w.__perf = perf;
    const proto = WebGL2RenderingContext.prototype as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >;
    const wrap = (name: string, before: () => void): void => {
      const original = proto[name];
      if (!original) return;
      proto[name] = function (this: unknown, ...args: unknown[]) {
        before();
        return original.apply(this, args);
      };
    };
    wrap('clear', () => {
      if (perf.current >= 0) perf.frames.push(perf.current);
      perf.current = 0;
    });
    for (const name of [
      'drawArrays',
      'drawArraysInstanced',
      'drawElements',
      'drawElementsInstanced',
      'drawRangeElements',
    ]) {
      wrap(name, () => {
        perf.current = Math.max(0, perf.current) + 1;
      });
    }
    const tasks: { start: number; duration: number }[] = [];
    w.__longTasks = tasks;
    if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          tasks.push({ start: entry.startTime, duration: entry.duration });
        }
      }).observe({ type: 'longtask', buffered: true });
    }
  });
}

async function resetCounters(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as PerfWindow;
    if (w.__perf) {
      w.__perf.frames = [];
      w.__perf.current = -1;
    }
    w.__longTasks?.splice(0);
  });
}

/**
 * The GPU's name. Firefox reports it in `RENDERER` and warns that
 * `WEBGL_debug_renderer_info` is deprecated (a console warning fails the
 * test); Chromium and WebKit mask `RENDERER` and need the extension.
 */
async function gpuName(page: Page, browserName: string): Promise<string> {
  return page.evaluate((firefox) => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'no WebGL2';
    const info = firefox ? null : gl.getExtension('WEBGL_debug_renderer_info');
    return info
      ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
  }, browserName === 'firefox');
}

async function playEffect(page: Page, effect: string): Promise<void> {
  await clearLifecycleEvents(page);
  await page.getByRole('link', { name: effect, exact: true }).click();
  await expect.poll(() => lifecycleEvents(page), { timeout: SLOW_MS }).toEqual(FULL_EFFECT);
  await waitForIdle(page, SLOW_MS);
}

/**
 * Plays `effect` once and comes back (playing the reverse effect) in the same
 * document, so shaders are compiled and the loop's code is warm. A reload
 * would throw both away.
 */
async function warmUp(page: Page, effect: string): Promise<void> {
  await playEffect(page, effect);
  await clearLifecycleEvents(page);
  await page.goBack();
  await expect.poll(() => lifecycleEvents(page), { timeout: SLOW_MS }).toEqual(FULL_EFFECT);
  await waitForIdle(page, SLOW_MS);
  await expect(page).toHaveURL(/\/effects\?/);
}

test.describe('vanilla example: performance (section 8)', () => {
  // Every effect in glass, and `explode` (fast-turning faces, the most light)
  // in every material (ADR-057).
  const frameCases = [
    ...EFFECTS.map((effect) => ({ label: effect, effect, query: QUERY })),
    ...MATERIALS.filter((material) => material !== 'glass').map((material) => ({
      label: `explode material=${material}`,
      effect: 'explode',
      query: `${QUERY}&material=${material}`,
    })),
    // Interaction and sound on (ADR-060): neither may cost frames or long tasks.
    {
      label: 'shatter with interaction and sound',
      effect: 'shatter',
      query: `${QUERY}&interaction&sound`,
    },
  ];
  for (const { label, effect, query } of frameCases) {
    test(`${label}: one draw call per frame, frame rate and long tasks`, async ({
      page,
      browserName,
    }, testInfo) => {
      test.setTimeout(240_000);
      await instrument(page);
      await page.goto(`${BASE}/effects${query}`);
      await waitForShatterReady(page);
      // Warm-up (shader compile, JIT), then measure the second run.
      await warmUp(page, effect);
      await resetCounters(page);
      await playEffect(page, effect);

      const result = await page.evaluate(() => {
        const w = window as PerfWindow;
        const perf = w.__perf ?? { frames: [], current: -1 };
        const frames = [...perf.frames, ...(perf.current >= 0 ? [perf.current] : [])];
        return {
          frames,
          longTasks: w.__longTasks ?? [],
          times: w.__shatterEventTimes ?? [],
        };
      });
      const state = await hookState(page);
      const gpu = await gpuName(page, browserName);

      // One draw call per drawn frame, from the intact quad to the last shard frame.
      expect(result.frames.length).toBeGreaterThan(0);
      expect(new Set(result.frames)).toEqual(new Set([1]));
      expect(state.textures).toBe(0);
      expect(state.fallback).toBeNull();
      // 160 requested; `blinds` breaks into `strips`, which use fewer, wider
      // pieces by design (ADR-053).
      expect(state.fracture?.shardCount).toBeGreaterThanOrEqual(effect === 'blinds' ? 12 : 150);

      // Phases from the lifecycle events: start, covered, committed, animating, end.
      const [start = 0, covered = 0, , animating = 0, end = 0] = result.times;
      // The capture of the incoming page (flip, assemble) is a capture step
      // too (master prompt 4.7): its tasks are allowed to be long (ADR-056).
      const incoming = await page.evaluate(() => {
        const hook = (
          window as {
            __SHATTER_TEST__?: {
              lastIncomingCaptureStart: number | null;
              lastIncomingCaptureMs: number | null;
            };
          }
        ).__SHATTER_TEST__;
        return {
          start: hook?.lastIncomingCaptureStart ?? null,
          ms: hook?.lastIncomingCaptureMs ?? null,
        };
      });
      // A task overlapping it belongs to it: the task that starts the capture
      // also finishes the wait before it, and the one that ends it uploads the
      // texture (measured: a long task 1 ms before the recorded start).
      const inIncomingCapture = (task: { start: number; duration: number }): boolean =>
        incoming.start !== null &&
        incoming.ms !== null &&
        task.start < incoming.start + incoming.ms &&
        task.start + task.duration > incoming.start;
      const outside = result.longTasks.filter(
        (task) =>
          task.start + task.duration > covered && task.start < end && !inIncomingCapture(task),
      );
      const duringIncoming = result.longTasks.filter(inIncomingCapture);
      // Where each long task lies, ms from `covered` (start+duration).
      console.log(
        `[timeline] ${testInfo.project.name} ${label}: animating at ${(animating - covered).toFixed(0)}, end at ${(end - covered).toFixed(0)}, ` +
          `incoming capture ${incoming.start === null ? '-' : `${(incoming.start - covered).toFixed(0)}+${incoming.ms?.toFixed(0) ?? '?'}`}; ` +
          `long tasks ${result.longTasks.map((t) => `${(t.start - covered).toFixed(0)}+${t.duration.toFixed(0)}`).join(' ') || 'none'}`,
      );
      const animation = state.animation;
      const worstLong = Math.max(0, ...outside.map((task) => task.duration));
      console.log(
        `[perf] ${testInfo.project.name} ${label} (${gpu}): ${state.fracture?.shardCount ?? 0} shards, ` +
          `${animation?.frames ?? 0} frames in ${animation?.durationMs.toFixed(0) ?? '?'} ms = ${animation?.fps.toFixed(1) ?? '?'} fps, ` +
          `worst frame ${animation?.worstFrameMs.toFixed(1) ?? '?'} ms; capture ${state.captureMs?.toFixed(1) ?? '?'} ms, ` +
          `start→covered ${(covered - start).toFixed(0)} ms, covered→animating ${(animating - covered).toFixed(0)} ms; ` +
          `draw calls per frame ${[...new Set(result.frames)].join('/')} over ${result.frames.length} frames; ` +
          `long tasks outside capture: ${outside.length ? outside.map((task) => task.duration.toFixed(0)).join(', ') : 'none'} ms` +
          (incoming.ms === null
            ? ''
            : `; incoming capture ${incoming.ms.toFixed(0)} ms, its long tasks: ${duringIncoming.length ? duringIncoming.map((task) => task.duration.toFixed(0)).join(', ') : 'none'} ms`),
      );
      if (PERF) {
        expect(animation?.fps ?? 0).toBeGreaterThanOrEqual(58);
        expect(worstLong).toBeLessThanOrEqual(LONG_TASK_MS);
      }
    });
  }

  const allocationCases = [
    ...EFFECTS.map((effect) => ({ label: effect, effect, query: QUERY })),
    {
      label: 'shatter with interaction and sound',
      effect: 'shatter',
      query: `${QUERY}&interaction&sound`,
    },
    {
      label: 'shatter with Rapier (report only)',
      effect: 'shatter',
      query: `${QUERY}&physics=rapier`,
    },
  ];
  for (const { label, effect, query } of allocationCases) {
    test(`${label}: no allocations per frame in the render loop`, async ({
      page,
      browserName,
    }, testInfo) => {
      test.skip(
        browserName !== 'chromium',
        'allocation tracking uses the Chrome DevTools Protocol',
      );
      test.setTimeout(240_000);
      // 3 s of motion: even software GL in CI draws a good number of frames.
      await page.goto(`${BASE}/effects${query}&duration=3000`);
      await waitForShatterReady(page);
      // Warm code: a cold first run allocates while V8 compiles (LEARNINGS).
      await warmUp(page, effect);
      await pauseAt(page, 'animating');
      await page.getByRole('link', { name: effect, exact: true }).click();
      await waitForPause(page, 'animating');
      const cdp = await page.context().newCDPSession(page);
      const allocations = await trackLoopAllocations(cdp, async () => {
        await page.evaluate(() => {
          (window as { __SHATTER_TEST__?: { resume(): void } }).__SHATTER_TEST__?.resume();
        });
        await waitForIdle(page, SLOW_MS);
      });
      await cdp.detach();
      const frames = (await hookState(page)).animation?.frames ?? 0;
      console.log(
        `[alloc] ${testInfo.project.name} ${label}: ${String(frames)} frames, objects allocated in the frame loop: ` +
          `${String(allocations.ours)} ours (${String(allocations.oursExcessBytes)} B beyond boxed numbers), ` +
          `${String(allocations.rapier)} inside Rapier` +
          (allocations.sites.length ? `; sites: ${allocations.sites.join('; ')}` : ''),
      );
      expect(frames).toBeGreaterThanOrEqual(5);
      if (query.includes('physics=rapier')) {
        // Report only: Rapier's getters allocate (wasm-bindgen boxes the
        // numbers it writes back) and the optimising compiler inlines them
        // into our `write()`, so the counts cannot be split exactly (ADR-040).
        return;
      }
      // Tracking runs the loop unoptimised, which boxes doubles (12 B each,
      // see HEAP_NUMBER_BYTES); any real object costs more. Measured: a
      // per-frame array destructuring (fixed in M10) added 35 B per frame, a
      // planted 8-field object 32 B. Noise: one-offs up to ~120 B per run.
      // V8 pads a varying share of boxed numbers to 16 B, so an effect that
      // re-ran every piece's closed-form motion each frame measured 0–832 B
      // per run whatever the frame count (`explode`, PR #14; `shatter` 640 B
      // = 160 pieces x 4 B in PR #20's push run). Since ADR-058 those effects
      // compare one remembered time per frame instead.
      // Limit: 20 B per frame, at least 400 B.
      const floor = 400;
      expect(allocations.oursExcessBytes).toBeLessThan(Math.max(floor, frames * 20));
    });
  }
});
