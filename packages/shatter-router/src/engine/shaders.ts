import { SETTLE_GLSL } from '../core/spring';

/**
 * GLSL ES 3.00 sources. The page texture holds display-ready sRGB values with
 * premultiplied alpha; shaders pass them through without any gamma maths so the
 * intact page is bit-identical to the capture.
 */

export const PAGE_VERTEX = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPosition;
in vec2 aUv;

uniform mat4 uViewProjection;

out vec2 vUv;

void main() {
  vUv = aUv;
  gl_Position = uViewProjection * vec4(aPosition, 1.0);
}
`;

export const PAGE_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uPage;

in vec2 vUv;
out vec4 outColor;

void main() {
  outColor = texture(uPage, vUv);
}
`;

/** Uniforms and helpers shared by the vertex shader and every effect chunk. */
const MOTION_PRELUDE = /* glsl */ `
uniform float uTime;        // s since the motion phase started
uniform float uDuration;    // s
uniform vec2 uOrigin;       // impact point, CSS px
uniform vec2 uViewport;     // CSS px
uniform float uMaxRadius;   // CSS px
uniform float uGravity;     // px/s^2, +y is down
uniform float uImpulse;     // px/s
uniform float uThickness;   // CSS px
uniform float uDirection;   // 1 forward, -1 back

struct Shard {
  int id;
  int layer;       // 0 outgoing page, 1 incoming page (instanced second copy)
  vec2 center;     // "centroid" is a reserved word in GLSL ES 3.00
  vec4 a;
  vec4 b;
};

struct Pose {
  vec3 translate;
  mat3 rotate;
  float scale;
  float alpha;
};

mat3 axisAngle(vec3 axis, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  float t = 1.0 - c;
  vec3 a = axis;
  return mat3(
    t * a.x * a.x + c,       t * a.x * a.y + s * a.z, t * a.x * a.z - s * a.y,
    t * a.x * a.y - s * a.z, t * a.y * a.y + c,       t * a.y * a.z + s * a.x,
    t * a.x * a.z + s * a.y, t * a.y * a.z - s * a.x, t * a.z * a.z + c
  );
}
${SETTLE_GLSL}`;

/**
 * Shard vertex shader with the effect's `shardMotion` inserted. Per-shard
 * effect data lives in an RGBA32F texture, two texels per row, one row per
 * shard, read with texelFetch by shard id.
 */
export function shardVertexSource(effectChunk: string): string {
  return /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;

in vec3 aPosition;
in vec2 aUv;
in float aShardId;
in vec2 aCentroid;
in float aEdgeDistance;
in vec3 aNormal;

uniform mat4 uViewProjection;
uniform sampler2D uShardData;
uniform float uMaxZ;        // CSS px; nothing may come closer to the camera
uniform float uMoving;      // 0 at rest (cover, fracture, crack): the rest pose, exactly
uniform float uPhysics;     // 1: poses come from a physics simulation (uTransforms)
uniform sampler2D uTransforms; // physics: one mat4 per shard, 4 RGBA32F texels per row

/** Fraction of the motion phase after which physics-driven shards fade out. */
const float PHYSICS_FADE_START = 0.7;
${MOTION_PRELUDE}
// ---- effect chunk ----
${effectChunk}
// ---- end effect chunk ----

out vec2 vUv;
out vec2 vPos;
out vec2 vCentroid;
out float vEdge;
out vec3 vNormal;
out float vFace;
out float vLayer;
out float vAlpha;

void main() {
  int id = int(aShardId + 0.5);
  Shard shard;
  shard.id = id;
  shard.layer = gl_InstanceID;
  shard.center = aCentroid;
  shard.a = texelFetch(uShardData, ivec2(0, id), 0);
  shard.b = texelFetch(uShardData, ivec2(1, id), 0);

  Pose pose;
  pose.translate = vec3(0.0);
  pose.rotate = mat3(1.0);
  pose.scale = 1.0;
  pose.alpha = 1.0;
  // Effects only move shards during the motion phase; until then their data
  // may not be uploaded yet, and the page must be drawn exactly at rest.
  if (uMoving > 0.5) {
    if (uPhysics > 0.5) {
      mat4 m = mat4(
        texelFetch(uTransforms, ivec2(0, id), 0),
        texelFetch(uTransforms, ivec2(1, id), 0),
        texelFetch(uTransforms, ivec2(2, id), 0),
        texelFetch(uTransforms, ivec2(3, id), 0));
      pose.rotate = mat3(m);
      pose.translate = m[3].xyz;
      pose.alpha = 1.0 - smoothstep(PHYSICS_FADE_START, 1.0, uTime / uDuration);
    } else {
      shardMotion(shard, pose);
    }
  }

  vec3 rest = vec3(aCentroid, 0.0);
  vec3 world = rest + pose.translate + pose.rotate * ((aPosition - rest) * pose.scale);
  world.z = min(world.z, uMaxZ);

  vUv = aUv;
  vPos = aPosition.xy;
  vCentroid = aCentroid;
  vEdge = aEdgeDistance;
  vNormal = pose.rotate * aNormal;
  vFace = aNormal.z;
  vLayer = float(gl_InstanceID);
  vAlpha = clamp(pose.alpha, 0.0, 1.0);
  gl_Position = uViewProjection * vec4(world, 1.0);
}
`;
}

/**
 * Shard fragment shader: the page texture with crack propagation
 * (master prompt 5.2), plus the effect's optional `shardFragment`.
 *
 * Every crack term is multiplied by "has the crack front passed this
 * fragment" (uCrackRadius) or by uFlash, so with uCrackRadius = 0, uFlash = 0
 * and the rest pose the output is exactly the page texture: the first
 * fractured frame matches the intact quad. Output is premultiplied alpha.
 */
export function shardFragmentSource(fragmentChunk?: string): string {
  return /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uPage;
uniform sampler2D uIncoming;   // the incoming page (effects with needsIncomingSnapshot)
uniform float uCrackRadius;    // CSS px the crack front has travelled
uniform float uFlash;          // 0..1 impact flash strength
uniform float uWireframe;      // 1 = debug: show every cell edge and the impact point
${MOTION_PRELUDE}

in vec2 vUv;
in vec2 vPos;
in vec2 vCentroid;
in float vEdge;
in vec3 vNormal;
in float vFace;
in float vLayer;
in float vAlpha;

out vec4 outColor;

const float LINE_HALF_WIDTH = 0.65;   // CSS px each side of the edge: a 1.3 px line
const float REFRACT_WIDTH = 2.5;      // CSS px band beside the crack that bends light
const float REFRACT_SHIFT = 0.8;      // CSS px the band is displaced
const float FRONT_GLOW = 70.0;        // CSS px behind the front that stay extra bright
const float FLASH_RADIUS = 34.0;      // CSS px

${fragmentChunk ? `${fragmentChunk}\n#define SHATTER_FRAGMENT_HOOK 1` : ''}

vec4 pageColor() {
  // Thickness faces: darker glass edge.
  if (abs(vFace) < 0.5) {
    vec4 side = texture(uPage, vUv);
    return vec4(side.rgb * 0.55, side.a);
  }

  float d = distance(vPos, uOrigin);
  float reached = uCrackRadius > 0.0 ? 1.0 - step(uCrackRadius, d) : 0.0;

  // Light bends at the break: sample slightly toward the shard's own centre.
  float band = reached * (1.0 - smoothstep(0.0, REFRACT_WIDTH, vEdge));
  vec2 toCentre = vCentroid - vPos;
  float len = length(toCentre);
  vec2 dir = len > 1e-3 ? toCentre / len : vec2(0.0);
  vec4 page = texture(uPage, vUv + dir * band * REFRACT_SHIFT / uViewport);

  // The crack line itself, anti-aliased with screen-space derivatives.
  float aa = max(fwidth(vEdge), 1e-4);
  float line = reached * (1.0 - smoothstep(LINE_HALF_WIDTH - aa, LINE_HALF_WIDTH + aa, vEdge));
  float front = reached * (1.0 - smoothstep(0.0, FRONT_GLOW, uCrackRadius - d));
  float highlight = line * (0.6 + 0.4 * front);

  vec3 rgb = mix(page.rgb, vec3(page.a), highlight * 0.85);
  rgb += vec3(uFlash * exp(-(d * d) / (2.0 * FLASH_RADIUS * FLASH_RADIUS))) * page.a;

  // Back faces show the page through the glass, a little dimmer.
  if (vFace < -0.5) rgb *= 0.82;

  if (uWireframe > 0.5) {
    float wire = 1.0 - smoothstep(0.5 - aa, 0.5 + aa, vEdge);
    rgb = mix(rgb, vec3(0.0, 0.9, 1.0) * page.a, wire);
    float dot = 1.0 - smoothstep(4.0, 5.0, d);
    rgb = mix(rgb, vec3(1.0, 0.15, 0.3) * page.a, dot);
  }

  return vec4(min(rgb, vec3(page.a)), page.a);
}

void main() {
  vec4 color = pageColor();
#ifdef SHATTER_FRAGMENT_HOOK
  shardFragment(color);
#endif
  outColor = color * vAlpha;
}
`;
}
