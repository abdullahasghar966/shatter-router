import type { Page } from '@playwright/test';

/** The parts of `window.__SHATTER_TEST__` the e2e suite reads (debug mode only). */
export interface Hook {
  pauseAt: string | null;
  paused: string | null;
  resume(): void;
  ready: boolean;
  state(): string;
  timings(): Record<string, number>;
  textureCount(): number;
  lastCaptureMs: number | null;
  lastPrecaptured: boolean;
  lastFallback: string | null;
  lastFracture: { shardCount: number; fractureMs: number; tier: string } | null;
  lastAnimation: { frames: number; durationMs: number; worstFrameMs: number; fps: number } | null;
  setMotionTime(ms: number): void;
}

export type HookWindow = Window & { __SHATTER_TEST__?: Hook };

/** Snapshot of the hook's plain values. */
export interface HookState {
  state: string;
  textures: number;
  fallback: string | null;
  precaptured: boolean;
  captureMs: number | null;
  animation: Hook['lastAnimation'];
  fracture: Hook['lastFracture'];
  timings: Record<string, number>;
}

export async function hookState(page: Page): Promise<HookState> {
  return page.evaluate(() => {
    const hook = (window as HookWindow).__SHATTER_TEST__;
    if (!hook) throw new Error('debug hook missing: load the page with ?debug');
    return {
      state: hook.state(),
      textures: hook.textureCount(),
      fallback: hook.lastFallback,
      precaptured: hook.lastPrecaptured,
      captureMs: hook.lastCaptureMs,
      animation: hook.lastAnimation,
      fracture: hook.lastFracture,
      timings: hook.timings(),
    };
  });
}

/** Waits until no transition is running and the overlay is gone. */
export async function waitForIdle(page: Page, timeout = 10_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const hook = (window as HookWindow).__SHATTER_TEST__;
      const overlay = document.querySelector(
        '[data-shatter-overlay]:not([data-shatter-overlay="announcer"])',
      );
      const open = overlay?.matches(':popover-open') ?? false;
      return hook?.state() === 'idle' && hook.textureCount() === 0 && !open;
    },
    undefined,
    { timeout },
  );
}

/** Waits until the state machine reaches `state`. */
export async function waitForState(page: Page, state: string, timeout = 10_000): Promise<void> {
  await page.waitForFunction((s) => (window as HookWindow).__SHATTER_TEST__?.state() === s, state, {
    timeout,
  });
}

/** Clears the last fallback so a later read reflects only the next transition. */
export async function resetFallback(page: Page): Promise<void> {
  await page.evaluate(() => {
    const hook = (window as HookWindow).__SHATTER_TEST__;
    if (hook) hook.lastFallback = null;
  });
}

/** Lifecycle events of one transition that played the full effect, in order. */
export const FULL_EFFECT = ['start', 'covered', 'committed', 'animating', 'end'];

/** Lifecycle events the example recorded since the last clear (debug mode). */
export async function lifecycleEvents(page: Page): Promise<string[]> {
  return page.evaluate(() => [
    ...((window as { __shatterEvents?: string[] }).__shatterEvents ?? []),
  ]);
}

/** Forgets the recorded lifecycle events, so the next read covers one navigation. */
export async function clearLifecycleEvents(page: Page): Promise<void> {
  await page.evaluate(() => {
    const log = window as { __shatterEvents?: string[]; __shatterEventTimes?: number[] };
    log.__shatterEvents?.splice(0);
    log.__shatterEventTimes?.splice(0);
  });
}
