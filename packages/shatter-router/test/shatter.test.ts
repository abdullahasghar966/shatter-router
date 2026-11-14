import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShatterEffect } from '../src/core/effect';
import { nextFrame } from '../src/core/frame';
import type { TransitionState } from '../src/core/machine';
import { createShatter, ShatterFacade } from '../src/core/shatter';
import { createShatterWith } from '../src/runtime/index';
import type {
  FallbackReason,
  Shatter,
  ShatterEventName,
  ShatterOptions,
  ShatterTestHook,
} from '../src/core/types';
import { FakeWorld, flush, gate, testEffect, until } from './helpers/fakes';

const instances: Shatter[] = [];

function create(world: FakeWorld, options: ShatterOptions = {}): Shatter {
  const shatter = createShatterWith({ precapture: false, ...options }, world.deps);
  instances.push(shatter);
  return shatter;
}

interface Recorder {
  readonly events: string[];
  readonly states: TransitionState[];
  readonly reasons: FallbackReason[];
  readonly errors: unknown[];
}

function record(shatter: Shatter): Recorder {
  const recorder: Recorder = { events: [], states: [], reasons: [], errors: [] };
  const names: ShatterEventName[] = [
    'start',
    'covered',
    'fractured',
    'committed',
    'animating',
    'end',
    'fallback',
    'error',
  ];
  for (const name of names) {
    shatter.on(name, () => {
      recorder.events.push(name);
      recorder.states.push(shatter.state);
    });
  }
  shatter.on('fallback', ({ reason }) => recorder.reasons.push(reason));
  shatter.on('error', ({ error }) => recorder.errors.push(error));
  return recorder;
}

function hook(): ShatterTestHook | undefined {
  return (window as unknown as { __SHATTER_TEST__?: ShatterTestHook }).__SHATTER_TEST__;
}

beforeEach(() => {
  document.body.innerHTML = '<main><h1>Page</h1></main>';
  document.title = 'Page';
});

afterEach(() => {
  for (const shatter of instances.splice(0)) shatter.destroy();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('state machine: the full pipeline', () => {
  it('walks idle → capturing → covering → committing → waiting → animating → revealing → idle', async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    const seen: TransitionState[] = [];
    const commit = vi.fn(() => {
      seen.push(shatter.state);
    });
    const recorder = record(shatter);

    await shatter.transition({ commit });

    expect(commit).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['committing']);
    expect(recorder.events).toEqual([
      'start',
      'covered',
      'fractured',
      'committed',
      'animating',
      'end',
    ]);
    expect(recorder.states).toEqual([
      'idle',
      'covering',
      'covering',
      'committing',
      'animating',
      'revealing',
    ]);
    expect(shatter.state).toBe('idle');
    expect(world.calls).toEqual([
      'resolveEffect',
      'capture',
      'cover',
      'fracture',
      'prepareMotion',
      'crack',
      'animate',
      'animate:done',
      'release',
    ]);
  });

  it('skips the crack for effects that do not crack', async () => {
    const world = new FakeWorld();
    const shatter = create(world, { effect: { ...testEffect, name: 'no-crack', crack: false } });
    await shatter.transition({ commit: () => undefined });
    expect(world.calls).not.toContain('crack');
    expect(world.calls).toContain('animate');
  });

  it('records the phase timings on the debug hook', async () => {
    const world = new FakeWorld();
    const shatter = create(world, { debug: true });
    await shatter.transition({ commit: () => undefined });
    const timings = hook()?.timings() ?? {};
    for (const phase of [
      'capturing',
      'covering',
      'committing',
      'waiting',
      'animating',
      'revealing',
    ]) {
      expect(timings).toHaveProperty(phase);
    }
    expect(hook()?.state()).toBe('idle');
    expect(hook()?.lastAnimation?.frames).toBe(61);
  });
});

describe('fallbacks: navigation always completes', () => {
  async function fallbackFor(
    setup: (world: FakeWorld) => void,
    options: ShatterOptions = {},
  ): Promise<{ recorder: Recorder; commit: ReturnType<typeof vi.fn>; world: FakeWorld }> {
    const world = new FakeWorld();
    setup(world);
    const shatter = create(world, options);
    const recorder = record(shatter);
    const commit = vi.fn();
    await shatter.transition({ commit });
    expect(shatter.state).toBe('idle');
    return { recorder, commit, world };
  }

  it('unsupported: the engine cannot load (no WebGL2)', async () => {
    const { recorder, commit } = await fallbackFor((w) => {
      w.loadError = new Error('WebGL2 is not available');
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(recorder.reasons).toEqual(['unsupported']);
    expect(recorder.events).toEqual(['start', 'fallback', 'committed', 'end']);
  });

  it('reduced-motion: crossfade instead of the effect', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) => ({ matches: query.includes('reduce') }) as MediaQueryList,
    );
    const { recorder, commit, world } = await fallbackFor(() => undefined);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(recorder.reasons).toEqual(['reduced-motion']);
    expect(world.calls).not.toContain('capture');
  });

  it("reducedMotion: 'ignore' plays the effect anyway", async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) => ({ matches: query.includes('reduce') }) as MediaQueryList,
    );
    const { recorder, world } = await fallbackFor(() => undefined, { reducedMotion: 'ignore' });
    expect(recorder.reasons).toEqual([]);
    expect(world.calls).toContain('animate');
  });

  it('hidden: the page is not visible', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const { recorder, commit } = await fallbackFor(() => undefined);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(recorder.reasons).toEqual(['hidden']);
  });

  it('context-lost', async () => {
    const { recorder, commit } = await fallbackFor((w) => {
      w.contextLost = true;
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(recorder.reasons).toEqual(['context-lost']);
  });

  it('pinch-zoom', async () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: { width: 400, height: 300, scale: 2 },
    });
    const { recorder, commit, world } = await fallbackFor(() => undefined);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(recorder.reasons).toEqual(['pinch-zoom']);
    expect(world.calls).not.toContain('capture');
    Reflect.deleteProperty(window, 'visualViewport');
  });

  it('capture-failed: the capture throws', async () => {
    const { recorder, commit } = await fallbackFor((w) => {
      w.captureError = new Error('tainted');
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(recorder.reasons).toEqual(['capture-failed']);
  });

  it('capture-budget: the capture is too slow, and its late snapshot is freed', async () => {
    const world = new FakeWorld();
    world.captureGate = gate();
    const shatter = create(world, { captureBudget: 20 });
    const recorder = record(shatter);
    const commit = vi.fn();
    await shatter.transition({ commit });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(recorder.reasons).toEqual(['capture-budget']);
    world.captureGate.open();
    await flush();
    const late = world.snapshots[0];
    expect(late?.dispose.mock.calls.length).toBe(1);
  });

  it('error: something throws before the commit (fallback commit, error event)', async () => {
    const boom = new Error('cover failed');
    const { recorder, commit, world } = await fallbackFor((w) => {
      w.coverError = boom;
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(recorder.reasons).toEqual(['error']);
    expect(recorder.errors).toEqual([boom]);
    expect(world.calls).toContain('release');
  });

  it('error after the commit: the overlay goes, commit is not repeated', async () => {
    const { recorder, commit, world } = await fallbackFor((w) => {
      w.animateError = new Error('draw failed');
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(recorder.reasons).toEqual(['error']);
    expect(recorder.events.filter((e) => e === 'committed')).toHaveLength(1);
    expect(world.calls.at(-1)).toBe('release');
  });

  it('an unknown effect name falls back with an error', async () => {
    const world = new FakeWorld();
    const shatter = create(world, { effect: 'nope' });
    const recorder = record(shatter);
    const commit = vi.fn();
    await shatter.transition({ commit });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(recorder.reasons).toEqual(['error']);
  });

  it('passes an error thrown by commit to the caller and stays usable', async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    await expect(
      shatter.transition({
        commit: () => {
          throw new Error('router exploded');
        },
      }),
    ).rejects.toThrow('router exploded');
    expect(shatter.state).toBe('idle');
    const commit = vi.fn();
    await shatter.transition({ commit });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('passes a commit error through the fallback path too', async () => {
    const world = new FakeWorld();
    world.loadError = new Error('no webgl');
    const shatter = create(world);
    await expect(
      shatter.transition({
        commit: () => {
          throw new Error('fallback commit failed');
        },
      }),
    ).rejects.toThrow('fallback commit failed');
    expect(shatter.state).toBe('idle');
  });
});

describe('interruption rules', () => {
  it('a new navigation while capturing drops the old one', async () => {
    const world = new FakeWorld();
    world.captureGate = gate();
    const shatter = create(world);
    const first = vi.fn();
    const second = vi.fn();
    const a = shatter.transition({ commit: first });
    await until(() => shatter.state === 'capturing' && world.calls.includes('capture'));
    const b = shatter.transition({ commit: second });
    world.captureGate.open();
    await Promise.all([a, b]);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(shatter.state).toBe('idle');
  });

  it('a new navigation while covering drops the old one and frees its overlay', async () => {
    const world = new FakeWorld();
    world.coverGate = gate();
    const shatter = create(world);
    const first = vi.fn();
    const second = vi.fn();
    const a = shatter.transition({ commit: first });
    await until(() => shatter.state === 'covering');
    const held = world.coverGate;
    world.coverGate = null;
    const b = shatter.transition({ commit: second });
    // The overlay finishes covering (two frames in the real engine); then the old run notices.
    held.open();
    await Promise.all([a, b]);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(world.calls.filter((c) => c === 'release').length).toBeGreaterThanOrEqual(2);
  });

  it('a new navigation while committing lets the old commit finish, then runs', async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    const commitGate = gate();
    const order: string[] = [];
    const a = shatter.transition({
      commit: async () => {
        await commitGate.promise;
        order.push('first');
      },
    });
    await until(() => shatter.state === 'committing');
    const b = shatter.transition({ commit: () => void order.push('second') });
    commitGate.open();
    await Promise.all([a, b]);
    expect(order).toEqual(['first', 'second']);
  });

  it('a new navigation while waiting skips the rest of the old one', async () => {
    const world = new FakeWorld();
    const shatter = create(world, { readyTimeout: 10_000 });
    const image = document.createElement('img');
    // A never-decoding visible image keeps the old transition waiting.
    image.decode = () => new Promise(() => undefined);
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 100));
    const order: string[] = [];
    const a = shatter.transition({
      commit: () => {
        order.push('first');
        document.body.append(image);
      },
    });
    await until(() => shatter.state === 'waiting');
    const b = shatter.transition({
      commit: () => {
        order.push('second');
        image.remove();
      },
    });
    await Promise.all([a, b]);
    expect(order).toEqual(['first', 'second']);
  });

  it('a new navigation while animating fast-forwards the old effect, then runs', async () => {
    const world = new FakeWorld();
    world.animateGate = gate();
    const shatter = create(world);
    const order: string[] = [];
    const a = shatter.transition({ commit: () => void order.push('first') });
    await until(() => world.calls.includes('animate'));
    expect(shatter.state).toBe('animating');
    world.animateGate = null;
    const b = shatter.transition({ commit: () => void order.push('second') });
    await Promise.all([a, b]);
    expect(order).toEqual(['first', 'second']);
    expect(world.calls).toContain('animate:skipped');
    expect(world.lastAnimateSignal?.aborted).toBe(false);
  });

  it('only the latest of several rapid navigations runs', async () => {
    const world = new FakeWorld();
    world.captureGate = gate();
    const shatter = create(world);
    const commits = [vi.fn(), vi.fn(), vi.fn()];
    const runs = commits.map((commit) => shatter.transition({ commit }));
    world.captureGate.open();
    await Promise.all(runs);
    expect(commits[0]).not.toHaveBeenCalled();
    expect(commits[1]).not.toHaveBeenCalled();
    expect(commits[2]).toHaveBeenCalledTimes(1);
  });

  it('Escape during the animation skips to the end', async () => {
    const world = new FakeWorld();
    world.animateGate = gate();
    const shatter = create(world);
    const run = shatter.transition({ commit: () => undefined });
    await until(() => world.calls.includes('animate'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await run;
    expect(world.calls).toContain('animate:skipped');
  });

  it('Escape during the crack skips the crack and the motion', async () => {
    const world = new FakeWorld();
    world.crackGate = gate();
    world.animateGate = gate();
    const shatter = create(world);
    const run = shatter.transition({ commit: () => undefined });
    await until(() => world.calls.includes('crack'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await run;
    expect(world.lastCrackSignal?.aborted).toBe(true);
    expect(world.calls).toContain('animate:skipped');
  });

  it('a click on the overlay during the animation skips to the end', async () => {
    const world = new FakeWorld();
    world.animateGate = gate();
    const shatter = create(world);
    const run = shatter.transition({ commit: () => undefined });
    await until(() => world.calls.includes('animate'));
    world.overlay.dispatchEvent(new Event('pointerdown'));
    await run;
    expect(world.calls).toContain('animate:skipped');
  });

  it('the page becoming hidden during the animation finishes it instantly', async () => {
    const world = new FakeWorld();
    world.animateGate = gate();
    const shatter = create(world);
    const run = shatter.transition({ commit: () => undefined });
    await until(() => world.calls.includes('animate'));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await run;
    expect(world.calls).toContain('animate:skipped');
  });

  it('other keys do not skip', async () => {
    const world = new FakeWorld();
    world.animateGate = gate();
    const shatter = create(world);
    const run = shatter.transition({ commit: () => undefined });
    await until(() => world.calls.includes('animate'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flush(10);
    expect(shatter.state).toBe('animating');
    world.animateGate.open();
    await run;
    expect(world.calls).toContain('animate:done');
  });
});

describe('destroy', () => {
  it('during the animation: the transition still completes, destroy is idempotent', async () => {
    const world = new FakeWorld();
    world.animateGate = gate();
    const shatter = create(world);
    const commit = vi.fn();
    const run = shatter.transition({ commit });
    await until(() => world.calls.includes('animate'));
    shatter.destroy();
    shatter.destroy();
    await run;
    expect(commit).toHaveBeenCalledTimes(1);
    expect(world.calls.filter((c) => c === 'destroy')).toHaveLength(1);
    const later = vi.fn();
    await shatter.transition({ commit: later });
    expect(later).toHaveBeenCalledTimes(1);
  });

  it('while capturing: the dropped navigation does not commit', async () => {
    const world = new FakeWorld();
    world.captureGate = gate();
    const shatter = create(world);
    const commit = vi.fn();
    const run = shatter.transition({ commit });
    await until(() => world.calls.includes('capture'));
    shatter.destroy();
    world.captureGate.open();
    await run;
    expect(commit).not.toHaveBeenCalled();
  });

  it('removes the debug hook it installed', async () => {
    const world = new FakeWorld();
    const shatter = create(world, { debug: true });
    // The hook arrives with the lazily loaded runtime.
    await shatter.transition({ commit: () => undefined });
    expect(hook()).toBeDefined();
    shatter.destroy();
    expect(hook()).toBeUndefined();
  });
});

describe('effects, events and options', () => {
  it('uses a registered effect by name, per call', async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    const custom: ShatterEffect = { ...testEffect, name: 'ripple-out', crack: false };
    shatter.registerEffect(custom);
    await shatter.transition({ commit: () => undefined, effect: 'ripple-out' });
    expect(world.calls).not.toContain('crack');
  });

  it('rejects an effect without a name', () => {
    const shatter = create(new FakeWorld());
    expect(() => {
      shatter.registerEffect({ ...testEffect, name: '' });
    }).toThrow(TypeError);
  });

  it('keeps going when an event handler throws', async () => {
    const shatter = create(new FakeWorld());
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
    const shatter = create(new FakeWorld());
    const handler = vi.fn();
    const off = shatter.on('start', handler);
    off();
    await shatter.transition({ commit: () => undefined });
    expect(handler).not.toHaveBeenCalled();
  });

  it('scrolls to the top for forward navigation and leaves back navigation alone', async () => {
    const shatter = create(new FakeWorld());
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    await shatter.transition({ commit: () => undefined });
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockClear();
    await shatter.transition({ commit: () => undefined, direction: 'back' });
    expect(scrollTo).not.toHaveBeenCalled();
    await shatter.transition({ commit: () => undefined, scroll: { x: 0, y: 320 } });
    expect(scrollTo).toHaveBeenCalledWith(0, 320);
  });
});

describe('accessibility after the swap', () => {
  it('focuses [data-shatter-focus] first', async () => {
    const shatter = create(new FakeWorld());
    await shatter.transition({
      commit: () => {
        document.body.innerHTML =
          '<main><h1>Title</h1><p data-shatter-focus id="start">Start</p></main>';
      },
    });
    expect(document.activeElement?.id).toBe('start');
  });

  it('then the first h1 in main, made focusable only while focused', async () => {
    const shatter = create(new FakeWorld());
    await shatter.transition({
      commit: () => {
        document.body.innerHTML =
          '<h1>Outside</h1><main><h1 id="t">Inside</h1></main><a href="/x">x</a>';
      },
    });
    const heading = document.getElementById('t');
    expect(document.activeElement).toBe(heading);
    expect(heading?.getAttribute('tabindex')).toBe('-1');
    document.querySelector<HTMLAnchorElement>('a')?.focus();
    expect(heading?.hasAttribute('tabindex')).toBe(false);
  });

  it('then main itself', async () => {
    const shatter = create(new FakeWorld());
    await shatter.transition({
      commit: () => {
        document.body.innerHTML = '<main id="m"><p>No heading</p></main>';
      },
    });
    expect(document.activeElement?.id).toBe('m');
  });

  it('announces the new title in a polite live region, after fallbacks too', async () => {
    const world = new FakeWorld();
    world.loadError = new Error('no webgl');
    const shatter = create(world);
    await shatter.transition({
      commit: () => {
        document.title = 'About us';
      },
    });
    await flush(80);
    const region = document.querySelector('[aria-live="polite"]');
    expect(region?.textContent).toBe('About us');
    expect(region?.hasAttribute('data-shatter-overlay')).toBe(true);
  });
});

describe('scroll lock', () => {
  it('blocks wheel and scroll keys during the transition only', async () => {
    const world = new FakeWorld();
    world.animateGate = gate();
    const shatter = create(world);
    const run = shatter.transition({ commit: () => undefined });
    await until(() => world.calls.includes('animate'));
    const wheel = new WheelEvent('wheel', { cancelable: true });
    window.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    window.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(true);
    world.animateGate.open();
    await run;
    const after = new WheelEvent('wheel', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it('calls a custom scroll lock (Lenis etc.) and releases it after fallbacks', async () => {
    const world = new FakeWorld();
    world.captureError = new Error('nope');
    const lock = vi.fn();
    const unlock = vi.fn();
    const shatter = create(world, { scrollLock: { lock, unlock } });
    await shatter.transition({ commit: () => undefined });
    expect(lock).toHaveBeenCalledTimes(1);
    expect(unlock).toHaveBeenCalledTimes(1);
  });
});

describe('the core facade', () => {
  it('navigates plainly when the runtime chunk cannot load', async () => {
    const shatter = new ShatterFacade({ precapture: false }, () =>
      Promise.reject(new Error('chunk blocked')),
    );
    instances.push(shatter);
    const recorder = record(shatter);
    const commit = vi.fn();
    await shatter.transition({ commit });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(recorder.reasons).toEqual(['unsupported']);
    expect(recorder.events).toEqual(['start', 'fallback', 'committed', 'end']);
    expect(shatter.state).toBe('idle');
  });

  it('starts a pre-capture on pointerdown over a link it would handle, not on others', async () => {
    const world = new FakeWorld();
    const shatter = createShatterWith({ precapture: 'pointerdown' }, world.deps);
    instances.push(shatter);
    document.body.innerHTML =
      '<main><a id="in" href="/next">In</a><a id="out" href="https://elsewhere.example/">Out</a></main>';
    const press = (id: string): void => {
      document
        .getElementById(id)
        ?.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, button: 0 }),
        );
    };
    press('out');
    await flush(10);
    expect(world.calls).not.toContain('capture');
    press('in');
    await until(() => world.calls.includes('capture'));
    // The click that follows uses it instead of capturing again.
    await shatter.transition({ commit: () => undefined });
    expect(world.calls.filter((c) => c === 'capture')).toHaveLength(1);
  });

  it('does not use a pre-capture that took longer than the capture budget', async () => {
    const world = new FakeWorld();
    const shatter = createShatterWith({ precapture: 'pointerdown', captureBudget: 30 }, world.deps);
    instances.push(shatter);
    const recorder = record(shatter);
    document.body.innerHTML = '<main><a id="in" href="/next">In</a></main>';
    const slow = world.capturer.capture.bind(world.capturer);
    world.capturer.capture = async (request) => ({ ...(await slow(request)), duration: 400 });
    document
      .getElementById('in')
      ?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, button: 0 }),
      );
    await until(() => world.calls.includes('capture'));
    await flush(10);
    const commit = vi.fn();
    await shatter.transition({ commit });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(recorder.reasons).toEqual(['capture-budget']);
  });
});

describe('createShatter without injected dependencies', () => {
  // happy-dom has no WebGL2: the real loader fails and navigation still completes.
  it('falls back and commits', async () => {
    const shatter = createShatter({ precapture: false });
    instances.push(shatter);
    const reasons: FallbackReason[] = [];
    shatter.on('fallback', ({ reason }) => reasons.push(reason));
    const commit = vi.fn();
    await shatter.transition({ commit });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(reasons).toEqual(['unsupported']);
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
