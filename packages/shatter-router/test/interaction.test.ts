import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Gesture, InteractionHost } from '../src/core/interaction';
import type { Shatter, ShatterOptions } from '../src/core/types';
import { fracture } from '../src/engine/fracture';
import {
  cleanPath,
  distanceToPath,
  farthestCornerFromPath,
  MAX_PATH_POINTS,
  pathLength,
  pointAlong,
} from '../src/engine/path';
import { impactPattern, sampleSeeds } from '../src/engine/patterns/impact';
import { createInteraction } from '../src/interaction/index';
import { createShatterWith } from '../src/runtime/index';
import { FakeWorld, flush } from './helpers/fakes';

/** Interaction and sound (ADR-060). */

const TEAR = [
  { x: 200, y: 300 },
  { x: 700, y: 420 },
  { x: 1200, y: 380 },
];

describe('tear path geometry', () => {
  it('measures distance to the polyline, its length, and points along it', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(distanceToPath(path, 50, 10)).toBeCloseTo(10, 10);
    expect(distanceToPath(path, 130, 50)).toBeCloseTo(30, 10);
    expect(distanceToPath(path, -30, -40)).toBeCloseTo(50, 10);
    expect(pathLength(path)).toBe(200);
    expect(pointAlong(path, 150)).toEqual({ x: 100, y: 50 });
    expect(pointAlong(path, 999)).toEqual({ x: 100, y: 100 });
    expect(farthestCornerFromPath(path, 100, 100)).toBeCloseTo(100, 10);
  });

  it('cleans a path: clamped, deduplicated, at most 8 points, null when too short', () => {
    expect(cleanPath(undefined, 100, 100)).toBeNull();
    expect(cleanPath([{ x: 5, y: 5 }], 100, 100)).toBeNull();
    expect(
      cleanPath(
        [
          { x: 5, y: 5 },
          { x: 5.2, y: 5.1 },
        ],
        100,
        100,
      ),
    ).toBeNull();
    expect(
      cleanPath(
        [
          { x: -50, y: 10 },
          { x: 500, y: Number.NaN },
          { x: 500, y: 20 },
        ],
        100,
        100,
      ),
    ).toEqual([
      { x: 0, y: 10 },
      { x: 100, y: 20 },
    ]);
    const long = Array.from({ length: 20 }, (_, i) => ({ x: i * 10, y: 0 }));
    const cleaned = cleanPath(long, 1000, 100);
    expect(cleaned).toHaveLength(MAX_PATH_POINTS);
    expect(cleaned?.[MAX_PATH_POINTS - 1]).toEqual({ x: 190, y: 0 });
  });

  it('a torn fracture measures every distance to the path and keeps the path for the crack', () => {
    const torn = fracture(impactPattern, {
      width: 1440,
      height: 900,
      origin: TEAR[0] ?? { x: 0, y: 0 },
      count: 160,
      seed: 4,
      path: TEAR,
    });
    for (const shard of torn.shards) {
      expect(shard.distance).toBeCloseTo(
        distanceToPath(TEAR, shard.centroid.x, shard.centroid.y),
        6,
      );
    }
    expect(torn.maxRadius).toBeCloseTo(farthestCornerFromPath(TEAR, 1440, 900), 6);
    expect([...(torn.path ?? [])]).toEqual([200, 300, 700, 420, 1200, 380]);
    const plain = fracture(impactPattern, {
      width: 1440,
      height: 900,
      origin: TEAR[0] ?? { x: 0, y: 0 },
      count: 160,
      seed: 4,
    });
    expect(plain.path).toBeNull();
  });

  it('seeds cluster along a tear instead of around one point', () => {
    // The share of seeds within 60 px of the path (measured: torn 0.39–0.52,
    // plain 0.26–0.32 for these seeds; the plain impact point is the path's start).
    const share = (points: Float64Array): number => {
      let near = 0;
      for (let i = 0; i < points.length; i += 2) {
        if (distanceToPath(TEAR, points[i] ?? 0, points[i + 1] ?? 0) < 60) near++;
      }
      return near / (points.length / 2);
    };
    for (const seed of [1, 2, 3, 9]) {
      const options = { width: 1440, height: 900, origin: { x: 200, y: 300 }, count: 160, seed };
      expect(share(sampleSeeds({ ...options, path: TEAR }))).toBeGreaterThan(
        share(sampleSeeds(options)) * 1.3,
      );
    }
  });
});

describe('runtime: intensity, tears and sound', () => {
  const instances: Shatter[] = [];
  function create(world: FakeWorld, options: ShatterOptions = {}): Shatter {
    const shatter = createShatterWith({ precapture: false, ...options }, world.deps);
    instances.push(shatter);
    return shatter;
  }
  afterEach(() => {
    for (const shatter of instances.splice(0)) shatter.destroy();
    vi.restoreAllMocks();
  });
  const commit = (): void => undefined;

  it('intensity scales the impulse; 0.5 (a click) leaves it as set', async () => {
    const world = new FakeWorld();
    const shatter = create(world, { impulse: 1000 });
    await shatter.transition({ commit });
    await shatter.transition({ commit, intensity: 1 });
    await shatter.transition({ commit, intensity: 0 });
    await shatter.transition({ commit, intensity: 7 });
    expect(world.impulses).toEqual([1000, 1500, 500, 1500]);
  });

  it("a request's path reaches the fracture", async () => {
    const world = new FakeWorld();
    const shatter = create(world);
    await shatter.transition({ commit, path: TEAR });
    await shatter.transition({ commit });
    expect(world.paths).toEqual([TEAR, undefined]);
  });

  it('sound waits for a gesture, plays at the motion, follows setSound', async () => {
    const world = new FakeWorld();
    world.withSound = true;
    const shatter = create(world, { sound: true });
    await shatter.transition({ commit });
    // No gesture yet: no engine, no sound.
    expect(world.sounds).toHaveLength(0);
    document.dispatchEvent(new Event('pointerdown'));
    await flush(10);
    expect(world.soundResumes).toBe(1);
    await shatter.transition({ commit, intensity: 0.9 });
    expect(world.sounds).toEqual([{ motion: 'shatter', intensity: 0.9, reverse: false }]);
    shatter.setSound(false);
    await shatter.transition({ commit });
    expect(world.sounds).toHaveLength(1);
  });

  it('sound stays off by default and under reduced motion', async () => {
    const world = new FakeWorld();
    world.withSound = true;
    const silent = create(world);
    document.dispatchEvent(new Event('pointerdown'));
    await flush(10);
    await silent.transition({ commit });
    expect(world.soundResumes).toBe(0);
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('reduce'),
          media: query,
          addEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    const reduced = create(world, { sound: true, reducedMotion: 'ignore' });
    document.dispatchEvent(new Event('keydown'));
    await flush(10);
    await reduced.transition({ commit });
    expect(world.soundResumes).toBe(0);
    expect(world.sounds).toHaveLength(0);
  });
});

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} is missing`);
  return element;
}

describe('interaction kit (happy-dom)', () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function setup(busy = false): {
    anchor: HTMLAnchorElement;
    gestures: Gesture[];
  } {
    document.body.innerHTML = '<a href="/work" id="work">Work</a><p id="away">away</p>';
    const anchor = document.getElementById('work') as HTMLAnchorElement;
    const gestures: Gesture[] = [];
    const host: InteractionHost = {
      window,
      shatterLink: (event) =>
        event.target instanceof Element && event.target.closest('#work') ? anchor : null,
      gesture: (gesture) => gestures.push(gesture),
      busy: () => busy,
      watch: () => () => undefined,
    };
    const kit = createInteraction(host, { cursor: 'none' });
    cleanups.push(() => {
      kit.destroy();
    });
    return { anchor, gestures };
  }

  function pointer(type: string, target: Element, x: number, y: number, time: number): void {
    const event = new PointerEvent(type, {
      bubbles: true,
      clientX: x,
      clientY: y,
      button: 0,
      isPrimary: true,
      pointerType: 'mouse',
    });
    Object.defineProperty(event, 'timeStamp', { value: time });
    target.dispatchEvent(event);
  }

  it('a click leaves no gesture; holding charges the break', () => {
    const { anchor, gestures } = setup();
    pointer('pointerdown', anchor, 10, 10, 1000);
    pointer('pointerup', anchor, 10, 10, 1060);
    expect(gestures).toHaveLength(0);
    pointer('pointerdown', anchor, 10, 10, 2000);
    pointer('pointerup', anchor, 12, 11, 2000 + 120 + 800);
    expect(gestures).toEqual([{ origin: { x: 12, y: 11 }, intensity: 1 }]);
    pointer('pointerdown', anchor, 10, 10, 3000);
    pointer('pointerup', anchor, 10, 10, 3000 + 120 + 400);
    expect(gestures[1]?.intensity).toBeCloseTo(0.75, 6);
  });

  it('dragging across a link tears along the drag and follows the link when released off it', () => {
    const { anchor, gestures } = setup();
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => undefined);
    const away = byId('away');
    pointer('pointerdown', anchor, 100, 100, 1000);
    for (let i = 1; i <= 6; i++)
      pointer('pointermove', away, 100 + i * 30, 100 + i * 5, 1000 + i * 16);
    pointer('pointerup', away, 280, 130, 1200);
    expect(gestures).toHaveLength(1);
    const gesture = gestures[0];
    expect(gesture?.origin).toEqual({ x: 100, y: 100 });
    expect(gesture?.path?.length).toBeGreaterThanOrEqual(2);
    expect(gesture?.path?.length).toBeLessThanOrEqual(8);
    // A tear is not also a charge.
    expect(gesture?.intensity).toBe(0.5);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('records nothing while a transition runs, or off a link', () => {
    const { anchor, gestures } = setup(true);
    pointer('pointerdown', anchor, 10, 10, 1000);
    pointer('pointerup', anchor, 10, 10, 2500);
    const other = setup();
    const away = byId('away');
    pointer('pointerdown', away, 10, 10, 1000);
    pointer('pointerup', away, 10, 10, 2500);
    expect(gestures).toHaveLength(0);
    expect(other.gestures).toHaveLength(0);
  });

  it('the cursor is decorative, ignored by captures, and removed on destroy', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({ matches: query.includes('fine'), media: query }) as unknown as MediaQueryList,
    );
    const host: InteractionHost = {
      window,
      shatterLink: () => null,
      gesture: () => undefined,
      busy: () => false,
      watch: (listener) => {
        watchers.push(listener);
        return () => undefined;
      },
    };
    const watchers: ((running: boolean) => void)[] = [];
    const kit = createInteraction(host, { cursor: 'reticle' });
    const cursor = document.querySelector('[data-shatter-cursor]');
    expect(cursor?.getAttribute('data-shatter-cursor')).toBe('reticle');
    expect(cursor?.hasAttribute('data-shatter-ignore')).toBe(true);
    expect(cursor?.getAttribute('aria-hidden')).toBe('true');
    expect((cursor as HTMLElement | null)?.style.pointerEvents).toBe('none');
    // It steps aside while a transition runs.
    window.dispatchEvent(new Event('resize'));
    document.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 5, clientY: 5, pointerType: 'mouse' }),
    );
    expect((cursor as HTMLElement | null)?.style.opacity).toBe('1');
    for (const watcher of watchers) watcher(true);
    expect((cursor as HTMLElement | null)?.style.opacity).toBe('0');
    for (const watcher of watchers) watcher(false);
    expect((cursor as HTMLElement | null)?.style.opacity).toBe('1');
    kit.destroy();
    expect(document.querySelector('[data-shatter-cursor]')).toBeNull();
  });
});
