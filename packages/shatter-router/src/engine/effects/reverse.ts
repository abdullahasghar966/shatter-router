import type { ShatterEffect } from '../../core/effect';

/** Name suffix of a reversed effect: `'shatter:reverse'`. */
export const REVERSE_SUFFIX = ':reverse';

/**
 * The time reverse of an effect, for Back (ADR-047): the pieces of the page
 * you return to come back along the paths they left on, ending exactly at
 * rest, while the page you leave stays still underneath.
 *
 * Two layers in one draw call, like `assemble`: layer 0 is the outgoing page
 * at rest; layer 1 is the incoming page running the effect's own
 * `shardMotion` at `uDuration - uTime` (`uTime` is a writable global,
 * ADR-038). The first frame shows layer 1 at the effect's end pose (gone or
 * transparent), so it is the outgoing page: the first-frame seam holds. The
 * last frame shows layer 1 at rest, which is the incoming page: the
 * last-frame seam holds. Only effects that end off the page can be reversed
 * like this; `flip` and `assemble` have their own reverses.
 */
export function reverseEffect(base: ShatterEffect): ShatterEffect {
  const motion = base.vertexChunk.replace(/\bshardMotion\b/g, 'forwardMotion');
  const fragment = base.fragmentChunk?.replace(/\bshardFragment\b/g, 'forwardFragment');
  const seeds = base.seedPoints?.bind(base);
  return {
    name: `${base.name}${REVERSE_SUFFIX}`,
    needsIncomingSnapshot: true,
    crack: false,
    layers: 2,
    ...(base.duration === undefined ? {} : { duration: base.duration }),
    ...(seeds ? { seedPoints: seeds } : {}),
    shardAttributes: (ctx) => base.shardAttributes(ctx),
    vertexChunk: /* glsl */ `${motion}
void shardMotion(Shard shard, inout Pose pose) {
  // The page being left stays at rest under the returning pieces.
  if (shard.layer == 0) return;
  float now = uTime;
  uTime = max(0.0, uDuration - now);
  forwardMotion(shard, pose);
  uTime = now;
}
`,
    fragmentChunk: /* glsl */ `${fragment ?? ''}
void shardFragment(inout vec4 color) {
  if (vLayer < 0.5) return;
  vec4 page = glassSample(uIncoming, vUv);
  if (abs(vFace) < 0.5) page.rgb *= 0.55;
  else if (vFace < -0.5) page.rgb *= 0.82;
  color = page;${fragment ? '\n  forwardFragment(color);' : ''}
}
`,
    // Every piece is home once the reversed time reaches 0.
    isComplete: (t, state) => t >= state.duration,
  };
}
