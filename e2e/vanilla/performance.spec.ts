import type { CDPSession, Page } from '@playwright/test';
import { APPS } from '../../playwright.config';
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
const EFFECTS = ['shatter', 'explode', 'implode', 'flip', 'assemble'] as const;
/** Lazy chunks that hold the render loop (the core is bundled into the app's main chunk). */
const LOOP_CHUNKS = /\/assets\/(engine|runtime|rapier-backend)-[\w-]+\.js$/;
/** Section 8: no long task over 50 ms outside the capture step. */
const LONG_TASK_MS = 50;

test.use({ viewport: { width: 1440, height: 900 } });
if (PERF) {
  test.use({
    // The installed Google Chrome: Playwright's own full Chromium build does
    // not start on the dev machine (side-by-side error, LEARNINGS).
    channel: 'chrome',
    headless: false,
    launchOptions: { args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] },
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
  await expect.poll(() => lifecycleEvents(page)).toEqual(FULL_EFFECT);
  await waitForIdle(page);
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
  await expect.poll(() => lifecycleEvents(page)).toEqual(FULL_EFFECT);
  await waitForIdle(page);
  await expect(page).toHaveURL(/\/effects\?/);
}

test.describe('vanilla example: performance (section 8)', () => {
  for (const effect of EFFECTS) {
    test(`${effect}: one draw call per frame, frame rate and long tasks`, async ({
      page,
      browserName,
    }, testInfo) => {
      test.setTimeout(60_000);
      await instrument(page);
      await page.goto(`${BASE}/effects${QUERY}`);
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
      expect(state.fracture?.shardCount).toBeGreaterThanOrEqual(150);

      // Phases from the lifecycle events: start, covered, committed, animating, end.
      const [start = 0, covered = 0, , animating = 0, end = 0] = result.times;
      const outside = result.longTasks.filter(
        (task) => task.start + task.duration > covered && task.start < end,
      );
      const animation = state.animation;
      const worstLong = Math.max(0, ...outside.map((task) => task.duration));
      console.log(
        `[perf] ${testInfo.project.name} ${effect} (${gpu}): ${state.fracture?.shardCount ?? 0} shards, ` +
          `${animation?.frames ?? 0} frames in ${animation?.durationMs.toFixed(0) ?? '?'} ms = ${animation?.fps.toFixed(1) ?? '?'} fps, ` +
          `worst frame ${animation?.worstFrameMs.toFixed(1) ?? '?'} ms; capture ${state.captureMs?.toFixed(1) ?? '?'} ms, ` +
          `start→covered ${(covered - start).toFixed(0)} ms, covered→animating ${(animating - covered).toFixed(0)} ms; ` +
          `draw calls per frame ${[...new Set(result.frames)].join('/')} over ${result.frames.length} frames; ` +
          `long tasks outside capture: ${outside.length ? outside.map((task) => task.duration.toFixed(0)).join(', ') : 'none'} ms`,
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
        'allocation sampling uses the Chrome DevTools Protocol',
      );
      test.setTimeout(60_000);
      // 3 s of motion: even software GL in CI draws well over 10 frames.
      await page.goto(`${BASE}/effects${query}&duration=3000`);
      await waitForShatterReady(page);
      await warmUp(page, effect);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('HeapProfiler.enable');
      await pauseAt(page, 'animating');
      await page.getByRole('link', { name: effect, exact: true }).click();
      await waitForPause(page, 'animating');
      // Sample every 64 bytes allocated: an allocation per frame would show up
      // dozens of times over a second of animation.
      await cdp.send('HeapProfiler.startSampling', { samplingInterval: 64 });
      await page.evaluate(() => {
        (window as { __SHATTER_TEST__?: { resume(): void } }).__SHATTER_TEST__?.resume();
      });
      await waitForIdle(page);
      const { profile } = await cdp.send('HeapProfiler.stopSampling');
      const state = await hookState(page);
      const frames = state.animation?.frames ?? 0;
      const { samples, objects, rapierObjects, bytes, sites } = loopAllocations(profile);
      console.log(
        `[alloc] ${testInfo.project.name} ${label}: ${frames} frames, ${samples} samples in the frame loop ` +
          `(${bytes} B; objects: ${objects} ours, ${rapierObjects} inside Rapier)` +
          (sites.length ? `; sites: ${sites.join('; ')}` : ''),
      );
      await detach(cdp);
      expect(frames).toBeGreaterThan(10);
      if (query.includes('physics=rapier')) {
        // Report only: Rapier's getters allocate (wasm-bindgen boxes the
        // numbers it writes back), and the optimising compiler inlines them
        // into our `write()`, so the profile cannot split the two (ADR-040).
        return;
      }
      // An allocation in every frame, even 16 B, would be sampled about
      // frames / 4 times at a 64 B interval. One or two samples are one-off
      // runtime work (a function tiering up), seen in single runs only.
      expect(objects).toBeLessThanOrEqual(2);
    });
  }
});

interface SamplingNode {
  callFrame: { functionName: string; url: string; lineNumber: number; columnNumber: number };
  selfSize: number;
  id: number;
  children: SamplingNode[];
}

interface SamplingProfile {
  head: SamplingNode;
  samples: { size: number; nodeId: number }[];
}

/** `RapierSimulation` methods that run every frame (src/rapier/simulation.ts). */
const SIMULATION_METHODS = new Set(['advance', 'release', 'write', 'get finished', 'finished']);

/** V8 HeapNumber with pointer compression: a map word and a double. */
const HEAP_NUMBER_BYTES = 12;

/**
 * Engine functions that run inside the loop's first frame but once per run or
 * per effect, never per frame: `FrameLoop.stop` builds the run's stats object,
 * and `ensureEffectProgram` compiles an effect's program on its first draw (in
 * CI a warm-up `flip` can fall back to `shatter`, leaving `flip` uncompiled).
 */
const ONCE_PER_RUN = new Set(['stop', 'ensureEffectProgram']);

/**
 * Sampled allocations made inside the frame loop: any stack with the engine's
 * `FrameLoop.tick` on it (the motion and crack steps, `draw()`, physics),
 * except the end of a run. Measured after a warm-up in the same document: a
 * cold first run also allocates bytecode and feedback vectors (one-off,
 * 80-352 B each, LEARNINGS).
 */
function loopAllocations(profile: SamplingProfile): {
  samples: number;
  /** Sampled objects allocated by our code. */
  objects: number;
  /** Sampled objects allocated inside Rapier's `World.step` (wasm-bindgen glue). */
  rapierObjects: number;
  bytes: number;
  sites: string[];
} {
  const owner = new Map<number, { site: string; rapier: boolean }>();
  const walk = (
    node: SamplingNode,
    site: string | null,
    inLoop: boolean,
    inRapier: boolean,
  ): void => {
    const frame = node.callFrame;
    const ours = LOOP_CHUNKS.test(frame.url);
    if (ours && ONCE_PER_RUN.has(frame.functionName)) return;
    const loop = inLoop || (ours && frame.functionName === 'tick');
    // Rapier is bundled into the rapier-backend chunk: any frame there that is
    // not one of our simulation's per-frame methods is Rapier's (its getters,
    // `World.step`, the wasm-bindgen glue).
    const rapier =
      inRapier ||
      (frame.url.includes('/rapier-backend-') && !SIMULATION_METHODS.has(frame.functionName));
    const here = ours
      ? `${frame.functionName || '(anonymous)'}@${frame.url.split('/').pop() ?? ''}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`
      : site;
    if (loop && here) owner.set(node.id, { site: here, rapier });
    for (const child of node.children) walk(child, here, loop, rapier);
  };
  walk(profile.head, null, false, false);
  let samples = 0;
  let objects = 0;
  let rapierObjects = 0;
  let bytes = 0;
  const sites = new Map<string, number[]>();
  for (const sample of profile.samples) {
    const found = owner.get(sample.nodeId);
    if (!found) continue;
    samples++;
    bytes += sample.size;
    if (sample.size > HEAP_NUMBER_BYTES) {
      if (found.rapier) rapierObjects++;
      else objects++;
    }
    const site = found.rapier ? `Rapier ${found.site}` : found.site;
    sites.set(site, [...(sites.get(site) ?? []), sample.size]);
  }
  const ranked = [...sites.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 6);
  return {
    samples,
    objects,
    rapierObjects,
    bytes,
    sites: ranked.map(
      ([site, sizes]) => `${site} ${sizes.length}× [${[...new Set(sizes)].join(',')} B]`,
    ),
  };
}

async function detach(cdp: CDPSession): Promise<void> {
  await cdp.send('HeapProfiler.disable');
  await cdp.detach();
}
