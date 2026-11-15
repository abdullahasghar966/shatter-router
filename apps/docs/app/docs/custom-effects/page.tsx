import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';
import { Code } from '../../code';

export const metadata: Metadata = { title: 'Writing a custom effect' };

/** The real effect this site registers, read at build time so the page can't drift from it. */
const SOURCE = readFileSync(join(process.cwd(), 'effects', 'ripple-out.ts'), 'utf8');

export default function CustomEffects(): ReactNode {
  return (
    <>
      <p className="kicker">Docs</p>
      <h1>Writing a custom effect</h1>
      <p className="lede">
        The engine cuts the page into shards, and an effect only decides how each shard moves. It
        does that in two parts: a little per-shard data computed once in JavaScript, and a GLSL
        function that runs for every vertex, every frame.
      </p>
      <p>
        This page builds <code>ripple-out</code>, the sixth card in the gallery.{' '}
        <ShatterLink href="/effects/ripple-out" effect="ripple-out">
          Try it now
        </ShatterLink>
        .
      </p>

      <h2>The interface</h2>
      <Code lang="ts">{`
interface ShatterEffect {
  name: string;                        // used by effect: 'name' and data-shatter-effect
  needsIncomingSnapshot: boolean;      // true to show the new page on the shards (flip, assemble)
  crack: boolean;                      // play the crack before the motion
  layers?: 1 | 2;                      // 2: also draw the incoming page's shards
  duration?: number;                   // preferred motion length, ms
  seedPoints?(ctx): Float32Array;      // custom Voronoi seeds
  shardAttributes(ctx): { data: Float32Array }; // 8 floats per shard
  vertexChunk: string;                 // GLSL: void shardMotion(Shard shard, inout Pose pose)
  fragmentChunk?: string;              // GLSL: void shardFragment(inout vec4 color)
  isComplete(t: number, state): boolean;
}
`}</Code>

      <h2>1. Per-shard data</h2>
      <p>
        <code>shardAttributes(ctx)</code> gets every shard at rest (its centroid, area, distance
        from the click), the impact point, the viewport and a seeded random function. It returns{' '}
        <code>SHARD_ATTRIBUTE_FLOATS</code> (8) floats per shard. They arrive in GLSL as two{' '}
        <code>vec4</code>: <code>shard.a</code> and <code>shard.b</code>.
      </p>
      <p>
        For <code>ripple-out</code> that is a direction away from the click, a delay that grows with
        distance (the ring), a lifetime, a tilt, a drift and a lift.
      </p>

      <h2>2. The motion, in GLSL</h2>
      <p>
        <code>shardMotion</code> receives the shard and a pose that starts at rest:{' '}
        <code>translate</code> (CSS px, +z toward you), <code>rotate</code> (a 3×3 matrix about the
        shard&apos;s centre), <code>scale</code> and <code>alpha</code>. Read the time from{' '}
        <code>uTime</code> (seconds). Helpers: <code>axisAngle(axis, angle)</code> and{' '}
        <code>settle(t, T)</code>, a critically damped spring that is exactly 1 from <code>T</code>{' '}
        on.
      </p>
      <div className="callout">
        <p>
          <strong>The one rule:</strong> at <code>uTime = 0</code> every shard must be exactly at
          rest. The first frame of the effect is then the page itself, with no visible seam. Effects
          that end on the new page (<code>needsIncomingSnapshot</code>) must also end exactly at
          rest.
        </p>
      </div>

      <h2>3. Knowing when it is done</h2>
      <p>
        <code>isComplete(t, state)</code> runs every frame with the time in ms and the data you
        returned. Return true once every shard has left, faded or settled; the glass is removed in
        that frame. Keep it allocation-free: no <code>for...of</code>, no array destructuring, no
        new objects.
      </p>

      <h2>The whole effect</h2>
      <Code lang="ts">{SOURCE}</Code>

      <h2>Use it</h2>
      <Code lang="tsx">{`
shatter.registerEffect(rippleOut);       // then effect: 'ripple-out' anywhere

<ShatterLink href="/work" effect={rippleOut}>Work</ShatterLink>  // or pass the object
`}</Code>
      <p>
        Lighting, chromatic aberration, the crack and the glass edges come from the engine, and all
        of it is exactly zero at rest. Your effect only moves the shards.
      </p>
    </>
  );
}
