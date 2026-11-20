import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Shatter, ShatterOptions } from '../src/core/types';
import { createShatterWith } from '../src/runtime/index';
import { FakeWorld, flush } from './helpers/fakes';

/** The priming capture on the first sign of intent (ADR-043). */

const instances: Shatter[] = [];

function create(world: FakeWorld, options: ShatterOptions = {}): Shatter {
  const shatter = createShatterWith({ precapture: false, ...options }, world.deps);
  instances.push(shatter);
  return shatter;
}

const captures = (world: FakeWorld): number => world.calls.filter((c) => c === 'capture').length;

function move(): void {
  window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
}

/** The facade warms the runtime up on idle (a 200 ms timer without requestIdleCallback). */
async function afterWarmUp(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 260));
  await flush(5);
}

afterEach(() => {
  for (const shatter of instances.splice(0)) shatter.destroy();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('priming capture', () => {
  it('runs one throwaway capture on the first pointer move and frees it', async () => {
    const world = new FakeWorld();
    create(world);
    await afterWarmUp();
    expect(captures(world)).toBe(0);
    move();
    await vi.waitFor(() => {
      expect(captures(world)).toBe(1);
    });
    await flush(5);
    expect(world.snapshots[0]?.dispose.mock.calls.length).toBe(1);
    move();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(captures(world)).toBe(1);
  });

  it('is not needed once a transition has captured', async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    await shatter.transition({ commit: () => undefined });
    expect(captures(world)).toBe(1);
    await afterWarmUp();
    move();
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(captures(world)).toBe(1);
  });

  it('is skipped when reduced motion means no effect will play', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const world = new FakeWorld();
    create(world);
    await afterWarmUp();
    move();
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(captures(world)).toBe(0);
  });

  it('stops listening when the instance is destroyed', async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    await afterWarmUp();
    shatter.destroy();
    move();
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(captures(world)).toBe(0);
  });
});
