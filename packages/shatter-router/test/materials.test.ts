import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectName } from '../src/core/compose';
import { BUILT_IN_MATERIAL_NAMES } from '../src/core/material';
import { parseHexColor } from '../src/core/shading';
import type { Shatter, ShatterEventName, ShatterOptions } from '../src/core/types';
import { composeEffect } from '../src/engine/compose';
import { reverseEffect } from '../src/engine/effects/reverse';
import { shatterEffect } from '../src/engine/effects/shatter';
import { MATERIAL_FLOATS, packMaterial, resolveMaterial } from '../src/engine/materials';
import { shardFragmentSource } from '../src/engine/shaders';
import { createShatterWith } from '../src/runtime/index';
import { FakeWorld } from './helpers/fakes';

/** Materials (ADR-057). */

describe('material table', () => {
  it('glass is exactly the shading of M9 (ADR-038)', () => {
    const glass = resolveMaterial('glass');
    expect(glass.tint).toEqual(parseHexColor('#cfe8ff'));
    expect(glass).toMatchObject({
      name: 'glass',
      tintStrength: 0.12,
      sideShade: 0.55,
      rim: 1,
      rimWidth: 2,
      glint: 0.55,
      shininess: 60,
      chromatic: 1,
      frost: 0,
      reflect: 0,
      iridescence: 0,
      brushed: 0,
      diffuse: 0,
    });
  });

  it('every built-in material resolves, and each one differs from glass', () => {
    const glass = JSON.stringify({ ...resolveMaterial('glass'), name: '' });
    for (const name of BUILT_IN_MATERIAL_NAMES) {
      const material = resolveMaterial(name);
      expect(material.name).toBe(name);
      for (const value of Object.values(material)) {
        if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
      }
      if (name !== 'glass') expect(JSON.stringify({ ...material, name: '' })).not.toBe(glass);
    }
    expect(new Set(BUILT_IN_MATERIAL_NAMES).size).toBe(7);
  });

  it('the families read as described: paper has no shine, ice is frosted, holo iridescent', () => {
    expect(resolveMaterial('paper')).toMatchObject({ rim: 0, glint: 0, chromatic: 0 });
    expect(resolveMaterial('ice').frost).toBeGreaterThan(0.5);
    expect(resolveMaterial('mirror').reflect).toBeGreaterThan(0.5);
    expect(resolveMaterial('metal').brushed).toBeGreaterThan(0.5);
    expect(resolveMaterial('holo').iridescence).toBe(1);
    expect(resolveMaterial('obsidian').shininess).toBeGreaterThan(150);
  });

  it('an unknown name throws; a custom object fills in from glass, or from the built-in it names', () => {
    expect(() => resolveMaterial('jelly')).toThrow(/Unknown material "jelly"/);
    const custom = resolveMaterial({ name: 'amber', tint: '#ffb000', glint: 2 });
    expect(custom).toMatchObject({ name: 'amber', glint: 2, rim: 1, shininess: 60 });
    expect(custom.tint).toEqual(parseHexColor('#ffb000'));
    // A tweak of a built-in keeps the rest of it.
    expect(resolveMaterial({ name: 'ice', frost: 0.3 })).toMatchObject({
      frost: 0.3,
      rimWidth: 3.5,
    });
  });

  it('clamps out-of-range values and ignores non-finite ones and bad tints', () => {
    const odd = resolveMaterial({
      name: 'odd',
      tint: 'blue',
      frost: 7,
      rim: -1,
      shininess: Number.NaN,
      rimWidth: Number.POSITIVE_INFINITY,
    });
    expect(odd.frost).toBe(1);
    expect(odd.rim).toBe(0);
    expect(odd.shininess).toBe(60);
    expect(odd.rimWidth).toBe(2);
    expect(odd.tint).toEqual(parseHexColor('#cfe8ff'));
  });

  it('packs into the three vec4 uniforms in the documented order', () => {
    const out = packMaterial(resolveMaterial('metal'), new Float32Array(MATERIAL_FLOATS));
    const metal = resolveMaterial('metal');
    expect([...out]).toEqual(
      [
        metal.rim,
        metal.rimWidth,
        metal.glint,
        metal.shininess,
        metal.chromatic,
        metal.frost,
        metal.reflect,
        metal.iridescence,
        metal.brushed,
        metal.sideShade,
        metal.diffuse,
        metal.tintStrength,
      ].map(Math.fround),
    );
  });
});

describe('material shading', () => {
  it('every material term sits behind the lighting gate (0 at rest, ADR-038)', () => {
    const fragment = shardFragmentSource();
    for (const uniform of ['uMatA', 'uMatB', 'uMatC']) {
      expect(fragment).toContain(`uniform vec4 ${uniform};`);
    }
    const light = fragment.slice(fragment.indexOf('void materialLight('));
    expect(light.indexOf('if (gate <= 0.0) return;')).toBeLessThan(light.indexOf('uMatC.z'));
    expect(light).toContain('float mirror = uMatB.z * gate');
    expect(light).toContain('float light = gate * (uMatA.x * rim + uMatA.z * glint);');
    expect(fragment).toContain('float frost = uMatB.y * uLight * vMotion;');
    expect(fragment).toContain('if (frost > 0.0)');
  });
});

describe('material in compositions and reverses', () => {
  it('a composition carries its material and is named after it', () => {
    const spec = { motion: 'shatter', material: 'ice' } as const;
    expect(composeEffect(spec, shatterEffect).material).toBe('ice');
    expect(effectName(spec)).toBe('shatter material=ice');
    expect(effectName({ motion: 'shatter', material: { name: 'amber' } })).toBe(
      'shatter material=amber',
    );
  });

  it('the reverse keeps the material', () => {
    const icy = composeEffect({ motion: 'shatter', material: 'ice' }, shatterEffect);
    expect(reverseEffect(icy).material).toBe('ice');
  });
});

describe('runtime: which material a transition uses', () => {
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

  it('glass by default, else the option, else setMaterial', async () => {
    const world = new FakeWorld();
    const plain = create(world);
    await plain.transition({ commit });
    const withOption = create(world, { material: 'paper' });
    await withOption.transition({ commit });
    withOption.setMaterial('holo');
    await withOption.transition({ commit });
    withOption.setMaterial(undefined);
    await withOption.transition({ commit });
    expect(world.materials).toEqual(['glass', 'paper', 'holo', 'paper']);
  });

  it("the effect's own material beats the option; the call's beats both", async () => {
    const world = new FakeWorld();
    const shatter = create(world, { material: 'paper' });
    await shatter.transition({ commit, effect: { motion: 'shatter', material: 'ice' } });
    await shatter.transition({
      commit,
      effect: { motion: 'shatter', material: 'ice' },
      material: { name: 'mine', tint: '#123' },
    });
    expect(world.materials).toEqual(['ice', 'mine']);
  });

  it('an unknown material falls back with an error, and the navigation still completes', async () => {
    const world = new FakeWorld();
    const shatter = create(world, { material: 'jelly' });
    const reasons: string[] = [];
    const events: ShatterEventName[] = [];
    shatter.on('fallback', ({ reason }) => reasons.push(reason));
    shatter.on('end', () => events.push('end'));
    const done = vi.fn();
    await shatter.transition({ commit: done });
    expect(done).toHaveBeenCalledTimes(1);
    expect(reasons).toEqual(['error']);
    expect(events).toEqual(['end']);
    // Nothing was shown: the material failed before the capture.
    expect(world.calls).not.toContain('cover');
  });
});
