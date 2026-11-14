import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextFrame } from '../src/core/frame';
import {
  createShatter,
  type FallbackReason,
  type Shatter,
  type ShatterEventName,
  type ShatterTestHook,
} from '../src/core/shatter';

// happy-dom has no WebGL2, so every transition here takes the fallback path:
// exactly the situation where navigation must still complete.

const instances: Shatter[] = [];

function create(options?: Parameters<typeof createShatter>[0]): Shatter {
  const shatter = createShatter(options);
  instances.push(shatter);
  return shatter;
}

function record(shatter: Shatter): string[] {
  const events: string[] = [];
  const names: ShatterEventName[] = ['start', 'covered', 'committed', 'end', 'fallback', 'error'];
  for (const name of names) shatter.on(name, () => events.push(name));
  return events;
}

function hook(): ShatterTestHook | undefined {
  return (window as unknown as { __SHATTER_TEST__?: ShatterTestHook }).__SHATTER_TEST__;
}

afterEach(() => {
  for (const shatter of instances.splice(0)) shatter.destroy();
  vi.restoreAllMocks();
});

describe('createShatter', () => {
  it('always runs commit, even when the effect is unavailable', async () => {
    const shatter = create();
    const events = record(shatter);
    const reasons: FallbackReason[] = [];
    shatter.on('fallback', ({ reason }) => reasons.push(reason));
    const commit = vi.fn();

    await shatter.transition({ commit });

    expect(commit).toHaveBeenCalledTimes(1);
    expect(reasons).toEqual(['unsupported']);
    expect(events).toEqual(['start', 'fallback', 'committed', 'end']);
  });

  it('waits for an async commit', async () => {
    const shatter = create();
    let done = false;
    await shatter.transition({
      commit: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        done = true;
      },
    });
    expect(done).toBe(true);
  });

  it('commits a second transition immediately while one is running', async () => {
    const shatter = create();
    const reasons: FallbackReason[] = [];
    shatter.on('fallback', ({ reason }) => reasons.push(reason));
    const order: string[] = [];

    const first = shatter.transition({ commit: () => void order.push('first') });
    const second = shatter.transition({ commit: () => void order.push('second') });
    await Promise.all([first, second]);

    expect(order).toEqual(['second', 'first']);
    expect(reasons).toContain('busy');
  });

  it('surfaces an error thrown by commit to the caller', async () => {
    const shatter = create();
    await expect(
      shatter.transition({
        commit: () => {
          throw new Error('router exploded');
        },
      }),
    ).rejects.toThrow('router exploded');
    // The instance stays usable.
    const commit = vi.fn();
    await shatter.transition({ commit });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('keeps going when an event handler throws', async () => {
    const shatter = create();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    shatter.on('start', () => {
      throw new Error('bad listener');
    });
    const commit = vi.fn();
    await shatter.transition({ commit });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
  });

  it('unsubscribes handlers', async () => {
    const shatter = create();
    const handler = vi.fn();
    const off = shatter.on('start', handler);
    off();
    await shatter.transition({ commit: () => undefined });
    expect(handler).not.toHaveBeenCalled();
  });

  it('destroy is idempotent and later transitions still commit', async () => {
    const shatter = create();
    const events = record(shatter);
    shatter.destroy();
    shatter.destroy();
    const commit = vi.fn();
    await shatter.transition({ commit });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(events).toEqual([]);
  });

  it('installs the test hook only in debug mode and removes it on destroy', () => {
    create();
    expect(hook()).toBeUndefined();
    const debug = create({ debug: true });
    expect(hook()).toMatchObject({ pauseAt: null, paused: null, ready: false });
    expect(hook()?.textureCount()).toBe(0);
    debug.destroy();
    expect(hook()).toBeUndefined();
  });

  it('records the fallback reason on the debug hook', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const shatter = create({ debug: true });
    await shatter.transition({ commit: () => undefined });
    expect(hook()?.lastFallback).toBe('unsupported');
    expect(warn).toHaveBeenCalled();
  });
});

describe('nextFrame', () => {
  it('resolves on the next animation frame', async () => {
    let fired = false;
    const promise = nextFrame(window).then(() => {
      fired = true;
    });
    expect(fired).toBe(false);
    await promise;
    expect(fired).toBe(true);
  });

  it('falls back to a timer when frames are not being produced', async () => {
    vi.useFakeTimers();
    const frames = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    let fired = false;
    void nextFrame(window).then(() => {
      fired = true;
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(fired).toBe(false);
    await vi.advanceTimersByTimeAsync(50);
    expect(fired).toBe(true);
    expect(frames).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith(1);
    vi.useRealTimers();
  });
});
