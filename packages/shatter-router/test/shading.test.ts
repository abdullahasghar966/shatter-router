import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  aberrationPx,
  DEFAULT_GLASS_TINT,
  LIGHT_FADE_S,
  lightFade,
  MAX_ABERRATION_PX,
  parseHexColor,
} from '../src/core/shading';
import type { Shatter, ShatterOptions } from '../src/core/types';
import { shardFragmentSource, shardVertexSource } from '../src/engine/shaders';
import { createShatterWith } from '../src/runtime/index';
import { FakeWorld } from './helpers/fakes';

describe('glass shading maths (master prompt 5.5)', () => {
  it('parses #rgb and #rrggbb tints, rejects anything else', () => {
    expect(parseHexColor('#cfe8ff')).toEqual([0xcf / 255, 0xe8 / 255, 1]);
    expect(parseHexColor('#FFF')).toEqual([1, 1, 1]);
    expect(parseHexColor(' #102030 ')).toEqual([0x10 / 255, 0x20 / 255, 0x30 / 255]);
    for (const bad of ['cfe8ff', '#cfe8f', 'red', 'rgb(1,2,3)', '#cfe8ffaa', '']) {
      expect(parseHexColor(bad)).toBeNull();
    }
    expect(parseHexColor(DEFAULT_GLASS_TINT)).not.toBeNull();
  });

  it('lighting is exactly 0 at t = 0 and fully on after 60 ms, rising smoothly', () => {
    expect(LIGHT_FADE_S).toBe(0.06);
    expect(lightFade(0)).toBe(0);
    expect(lightFade(-1)).toBe(0);
    expect(lightFade(LIGHT_FADE_S)).toBe(1);
    expect(lightFade(5)).toBe(1);
    let previous = 0;
    for (let i = 1; i < 60; i++) {
      const value = lightFade((i / 60) * LIGHT_FADE_S);
      expect(value).toBeGreaterThan(previous);
      expect(value).toBeLessThan(1);
      previous = value;
    }
  });

  it('chromatic aberration grows with speed and never exceeds 1.5 px', () => {
    expect(MAX_ABERRATION_PX).toBe(1.5);
    expect(aberrationPx(0)).toBe(0);
    expect(aberrationPx(-50)).toBe(0);
    expect(aberrationPx(600)).toBeCloseTo(0.75, 6);
    expect(aberrationPx(100_000)).toBe(1.5);
  });

  it('the shaders gate every lighting term by the fade-in and the rest pose', () => {
    const fragment = shardFragmentSource();
    expect(fragment).toContain('float gate = uLight * vMotion;');
    expect(fragment).toContain('if (gate <= 0.0) return;');
    expect(fragment).toContain('uChromatic * uMatB.x * uLight * vMotion');
    expect(fragment).toContain('float frost = uMatB.y * uLight * vMotion;');
    expect(fragment).toContain('vec4 glassSample(sampler2D tex, vec2 uv)');
    const vertex = shardVertexSource('void shardMotion(Shard shard, inout Pose pose) {}');
    // The rest pose is exactly 0 away; the velocity is 0 until the motion starts.
    expect(vertex).toContain('vMotion = clamp(away / 2.0, 0.0, 1.0);');
    expect(vertex).toContain('uTimeValue > 0.0 ?');
  });
});

describe('runtime: shading options', () => {
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

  it("defaults to the material's own tint with chromatic aberration on (ADR-057)", async () => {
    const world = new FakeWorld();
    await create(world).transition({ commit: () => undefined });
    // No override: glass's own #cfe8ff applies in the engine.
    expect(world.shading).toEqual({ tint: null, chromatic: true });
    expect(world.materials).toEqual(['glass']);
  });

  it('passes glassTint and chromatic through', async () => {
    const world = new FakeWorld();
    await create(world, { glassTint: '#f00', chromatic: false }).transition({
      commit: () => undefined,
    });
    expect(world.shading).toEqual({ tint: [1, 0, 0], chromatic: false });
  });

  it("an invalid tint falls back to the material's (with a warning in debug mode)", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const world = new FakeWorld();
    await create(world, { glassTint: 'sky blue', debug: true }).transition({
      commit: () => undefined,
    });
    expect(world.shading?.tint).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('glassTint "sky blue"'));
  });
});
