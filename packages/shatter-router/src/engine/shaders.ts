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

/**
 * Shard mesh vertex shader. Shards are still in this milestone; motion is
 * added through the effect hook in Milestone 4.
 */
export const SHARD_VERTEX = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPosition;
in vec2 aUv;
in float aShardId;
in vec2 aCentroid;
in float aEdgeDistance;
in vec3 aNormal;

uniform mat4 uViewProjection;

out vec2 vUv;
out vec2 vPos;
out vec2 vCentroid;
out float vEdge;
out vec3 vNormal;

void main() {
  vUv = aUv;
  vPos = aPosition.xy;
  vCentroid = aCentroid;
  vEdge = aEdgeDistance;
  vNormal = aNormal;
  gl_Position = uViewProjection * vec4(aPosition, 1.0);
}
`;

/**
 * Shard mesh fragment shader with crack propagation (master prompt 5.2).
 *
 * Every crack term is multiplied by "has the crack front passed this
 * fragment" (uCrackRadius) or by uFlash, so with uCrackRadius = 0 and
 * uFlash = 0 the output is exactly the page texture: the first fractured
 * frame matches the intact quad.
 */
export const SHARD_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uPage;
uniform vec2 uViewport;        // CSS px
uniform vec2 uOrigin;          // impact point, CSS px
uniform float uCrackRadius;    // CSS px the crack front has travelled
uniform float uFlash;          // 0..1 impact flash strength
uniform float uWireframe;      // 1 = debug: show every cell edge and the impact point

in vec2 vUv;
in vec2 vPos;
in vec2 vCentroid;
in float vEdge;
in vec3 vNormal;

out vec4 outColor;

const float LINE_HALF_WIDTH = 0.65;   // CSS px each side of the edge: a 1.3 px line
const float REFRACT_WIDTH = 2.5;      // CSS px band beside the crack that bends light
const float REFRACT_SHIFT = 0.8;      // CSS px the band is displaced
const float FRONT_GLOW = 70.0;        // CSS px behind the front that stay extra bright
const float FLASH_RADIUS = 34.0;      // CSS px

void main() {
  // Thickness faces (not visible while the shards lie flat).
  if (abs(vNormal.z) < 0.5) {
    vec4 side = texture(uPage, vUv);
    outColor = vec4(side.rgb * 0.55, side.a);
    return;
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

  if (uWireframe > 0.5) {
    float wire = 1.0 - smoothstep(0.5 - aa, 0.5 + aa, vEdge);
    rgb = mix(rgb, vec3(0.0, 0.9, 1.0) * page.a, wire);
    float dot = 1.0 - smoothstep(4.0, 5.0, d);
    rgb = mix(rgb, vec3(1.0, 0.15, 0.3) * page.a, dot);
  }

  outColor = vec4(min(rgb, vec3(page.a)), page.a);
}
`;
