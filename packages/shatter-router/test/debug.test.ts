import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Shatter, ShatterOptions } from '../src/core/types';
import { diffFrames, SEAM_CHANNEL_TOLERANCE } from '../src/debug/index';
import { createShatterWith } from '../src/runtime/index';
import { FakeWorld, gate } from './helpers/fakes';

function panelRoot(): ShadowRoot | null {
  return document.querySelector('[data-shatter-debug]')?.shadowRoot ?? null;
}

function rows(root: ShadowRoot): Record<string, string> {
  const out: Record<string, string> = {};
  const terms = [...root.querySelectorAll('dt')];
  terms.forEach((dt) => {
    out[dt.textContent] = dt.nextElementSibling?.textContent ?? '';
  });
  return out;
}

describe('seam diff (master prompt section 10)', () => {
  it('counts pixels whose largest channel difference exceeds the tolerance', () => {
    const live = new Uint8ClampedArray([
      10, 10, 10, 255, 200, 0, 0, 255, 0, 0, 0, 255, 9, 9, 9, 255,
    ]);
    const overlay = new Uint8ClampedArray(live);
    expect(diffFrames(live, overlay, 2, 2).percent).toBe(0);
    overlay[4] = 200 - SEAM_CHANNEL_TOLERANCE; // exactly at the tolerance: same
    overlay[9] = SEAM_CHANNEL_TOLERANCE + 1; // above it: differs
    const diff = diffFrames(live, overlay, 2, 2);
    expect(diff.percent).toBe(25);
    // Red where it differs, dimmed grey elsewhere, all opaque.
    expect([...diff.heatmap.data.slice(8, 12)]).toEqual([255, 0, 0, 255]);
    const grey = diff.heatmap.data[0] ?? -1;
    expect(grey).toBeGreaterThan(0);
    expect(grey).toBeLessThan(10);
    expect(diff.heatmap.data[3]).toBe(255);
  });
});

describe('runtime: debug panel', () => {
  const instances: Shatter[] = [];
  function create(world: FakeWorld, options: ShatterOptions): Shatter {
    const shatter = createShatterWith({ precapture: false, ...options }, world.deps);
    instances.push(shatter);
    return shatter;
  }
  afterEach(() => {
    for (const shatter of instances.splice(0)) shatter.destroy();
    vi.restoreAllMocks();
  });

  it('debug: true opens the panel in a shadow root; destroy removes it', async () => {
    const world = new FakeWorld();
    const shatter = create(world, { debug: true });
    await shatter.transition({ commit: () => undefined });
    await vi.waitFor(() => {
      expect(panelRoot()).not.toBeNull();
    });
    const host = document.querySelector('[data-shatter-debug]');
    // Excluded from captures.
    expect(host?.hasAttribute('data-shatter-ignore')).toBe(true);
    shatter.destroy();
    expect(document.querySelector('[data-shatter-debug]')).toBeNull();
  });

  it('{ panel: false } keeps the test hook but opens no panel; debug off has neither', async () => {
    const world = new FakeWorld();
    await create(world, { debug: false }).transition({ commit: () => undefined });
    expect((window as { __SHATTER_TEST__?: unknown }).__SHATTER_TEST__).toBeUndefined();
    await create(world, { debug: { panel: false } }).transition({ commit: () => undefined });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.querySelector('[data-shatter-debug]')).toBeNull();
    expect((window as { __SHATTER_TEST__?: unknown }).__SHATTER_TEST__).toBeDefined();
  });

  it('shows state, shard count, tier, fps and draw calls per frame after a transition', async () => {
    const world = new FakeWorld();
    const shatter = create(world, { debug: true });
    await vi.waitFor(() => {
      expect(panelRoot()).not.toBeNull();
    });
    await shatter.transition({ commit: () => undefined });
    const root = panelRoot();
    if (!root) throw new Error('no panel');
    const values = rows(root);
    expect(values.state).toBe('idle');
    expect(values.shards).toBe('40 (1.0 ms)');
    expect(values.tier).toBe('low');
    expect(values.fps).toBe('60.0 (worst 17 ms)');
    expect(values['draw calls']).toBe('1.00 / frame');
    expect(values.textures).toBe('0');
  });

  it('the wireframe checkbox drives the hook', async () => {
    const world = new FakeWorld();
    create(world, { debug: true });
    await vi.waitFor(() => {
      expect(panelRoot()).not.toBeNull();
    });
    const box = panelRoot()?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!box) throw new Error('no checkbox');
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    const hook = (window as { __SHATTER_TEST__?: { wireframe: boolean } }).__SHATTER_TEST__;
    expect(hook?.wireframe).toBe(true);
  });

  it('seam check without screen capture compares the capture with the overlay and frees everything', async () => {
    const context = {
      drawImage: vi.fn(),
      putImageData: vi.fn(),
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
      }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => context as unknown as CanvasRenderingContext2D,
    );
    const world = new FakeWorld();
    create(world, { debug: true });
    await vi.waitFor(() => {
      expect(panelRoot()).not.toBeNull();
    });
    const root = panelRoot();
    const button = root?.querySelector<HTMLButtonElement>('[data-k="seam"]');
    if (!root || !button) throw new Error('no seam button');
    button.click();
    const result = root.querySelector('[data-k="seam-result"]');
    await vi.waitFor(() => {
      expect(result?.textContent).toBe('0.000 % differ (capture vs overlay)');
    });
    expect(world.calls).toEqual(
      expect.arrayContaining(['capture', 'cover', 'fracture', 'release']),
    );
    expect(world.snapshots[0]?.dispose.mock.calls.length).toBeGreaterThan(0);
    expect(root.querySelector('canvas')?.hidden).toBe(false);
  });

  it('a transition started during a seam check waits for it', async () => {
    const world = new FakeWorld();
    const shatter = create(world, { debug: true });
    await vi.waitFor(() => {
      expect(panelRoot()).not.toBeNull();
    });
    const held = gate();
    world.captureGate = held;
    panelRoot()?.querySelector<HTMLButtonElement>('[data-k="seam"]')?.click();
    await vi.waitFor(() => {
      expect(world.calls).toContain('capture');
    });
    world.captureGate = null;
    const commit = vi.fn();
    const transition = shatter.transition({ commit });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(commit).not.toHaveBeenCalled();
    held.open();
    await transition;
    expect(commit).toHaveBeenCalledOnce();
  });
});
