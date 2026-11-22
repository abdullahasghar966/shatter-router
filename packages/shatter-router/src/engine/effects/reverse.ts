import { mirrorEasing } from '../../core/easing';
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
 * last frame (uTime >= uDuration) draws layer 1 at the rest pose, exactly,
 * which is the incoming page: the last-frame seam holds even for an effect
 * that is not quite at rest at its own t = 0. Only effects that end off the page can be reversed
 * like this; `flip` and `assemble` have their own reverses.
 */
export function reverseEffect(base: ShatterEffect): ShatterEffect {
  const motion = base.vertexChunk.replace(/\bshardMotion\b/g, 'forwardMotion');
  // The effect's own fragment work runs on layer 1, which shows the incoming
  // page: what it reads from "the page" must be that page (ADR-055).
  const fragment = base.fragmentChunk
    ?.replace(/\bshardFragment\b/g, 'forwardFragment')
    .replace(/\buPage\b/g, 'uIncoming');
  const seeds = base.seedPoints?.bind(base);
  return {
    name: `${base.name}${REVERSE_SUFFIX}`,
    needsIncomingSnapshot: true,
    crack: false,
    layers: 2,
    ...(base.duration === undefined ? {} : { duration: base.duration }),
    // The pieces come back along the paths they left on: same cells, same order (ADR-055).
    ...(base.pattern === undefined ? {} : { pattern: base.pattern }),
    ...(base.stagger === undefined ? {} : { stagger: base.stagger }),
    ...(base.material === undefined ? {} : { material: base.material }),
    // Mirrored, so the reverse retraces the eased motion exactly (ADR-059).
    ...(base.easing === undefined ? {} : { easing: mirrorEasing(base.easing) }),
    ...(seeds ? { seedPoints: seeds } : {}),
    shardAttributes: (ctx) => base.shardAttributes(ctx),
    vertexChunk: /* glsl */ `${motion}
void shardMotion(Shard shard, inout Pose pose) {
  // The page being left stays at rest under the returning pieces.
  if (shard.layer == 0) return;
  float now = uTime;
  // The last frame is the page at rest, exactly, whatever the effect does at t = 0.
  if (now >= uDuration) return;
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
  color = page;${
    fragment
      ? `
  // The effect's own colour work (a flash, a split) at the reversed time too,
  // and never on the last frame, which is the page (ADR-055).
  float now = uTime;
  if (now >= uDuration) return;
  uTime = max(0.0, uDuration - now);
  forwardFragment(color);
  uTime = now;`
      : ''
  }
}
`,
    // Every piece is home once the reversed time reaches 0.
    isComplete: (t, state) => t >= state.duration,
  };
}
