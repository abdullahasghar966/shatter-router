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
