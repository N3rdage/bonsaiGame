/**
 * The Inked look for the spike's blocks as plain data (backlog #359): each
 * wash as it lands on paper, the ink hull's corner normals and the shaders.
 * Pure: no three.js import, so it is unit-tested in Node; main.ts builds the
 * materials. The toon ramp, ink colour and outline width are the viewer's
 * (src/viewer/toon.ts), imported, not copied.
 */

import type { Rgb } from '../viewer/potPalette';
import type { Wash } from './site';

/** art/inked/style.mjs's PAPER and WASH_ALPHA. */
export const PAPER_RGB: Rgb = { r: 242, g: 234, b: 218 };
export const WASH_ALPHA = 0.82;

/** The WASHES entries the blocks use, mirrored from art/inked/style.mjs (ink.test.ts pins the mirror). */
export const WASH_RGB: Record<Wash, Rgb> = {
  outside: { r: 150, g: 184, b: 118 },
  asphalt: { r: 108, g: 108, b: 110 },
  stone: { r: 196, g: 194, b: 188 },
  render: { r: 214, g: 198, b: 176 },
  tile: { r: 184, g: 116, b: 92 },
  wood: { r: 150, g: 100, b: 64 },
  paint: { r: 204, g: 208, b: 200 },
  glass: { r: 150, g: 204, b: 222 },
  metal: { r: 150, g: 166, b: 178 },
  soil: { r: 120, g: 96, b: 78 },
  foliage: { r: 88, g: 150, b: 84 },
  cap: { r: 98, g: 76, b: 62 },
};

/** A wash as it lands on paper, as style.mjs's palette strip mixes it: the colour every lit face is drawn in. */
export function onPaper(wash: Rgb): Rgb {
  const mix = (p: number, w: number): number => Math.round(p * (1 - WASH_ALPHA) + w * WASH_ALPHA);
  return {
    r: mix(PAPER_RGB.r, wash.r),
    g: mix(PAPER_RGB.g, wash.g),
    b: mix(PAPER_RGB.b, wash.b),
  };
}

/**
 * The ink hull's normals for a box centred on its origin: each vertex pushed
 * along its corner's diagonal, the signs of its position, so the three faces
 * meeting at a corner push their copies of it the same way and the hull
 * stays closed (a box's own face normals would split it at every edge).
 */
export function cornerNormals(positions: ArrayLike<number>): Float32Array {
  const out = new Float32Array(positions.length);
  const k = 1 / Math.sqrt(3);
  for (let i = 0; i < positions.length; i++) out[i] = Math.sign(positions[i] ?? 0) * k;
  return out;
}

/**
 * The ink hull as the viewer draws it (TreeViewer.ts, whose shader is not
 * exported): each vertex pushed `uDepth` straight back from the camera (the
 * viewer pushes along its perspective ray; this camera is orthographic), then
 * out along its normal's screen direction by `uWidth` clip units, so only a
 * rim past the silhouette shows.
 */
export const HULL_VERTEX = /* glsl */ `
uniform vec2 uWidth;
uniform float uDepth;
void main() {
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  view.z -= uDepth;
  vec4 clip = projectionMatrix * view;
  vec2 dir = (projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0)).xy;
  float len = length(dir);
  if (len > 1e-6) clip.xy += dir / len * uWidth * clip.w;
  gl_Position = clip;
}
`;
export const INK_FRAGMENT = /* glsl */ `
uniform vec3 uInk;
void main() {
  gl_FragColor = vec4(uInk, 1.0);
}
`;

/**
 * The player's sprite: a quad facing the camera with its foot on the mesh's
 * origin, every fragment at the foot's depth (nudged toward the camera by
 * `uLift`), so it is hidden by what stands in front of its feet and never cut
 * by a wall behind it, as the rooms sort the 2D sprite by its feet.
 */
export const SPRITE_VERTEX = /* glsl */ `
uniform float uLift;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 foot = projectionMatrix * modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  clip.z = (foot.z / foot.w - uLift) * clip.w;
  gl_Position = clip;
}
`;
export const SPRITE_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform float uFrame;
uniform float uFrames;
varying vec2 vUv;
void main() {
  vec4 texel = texture2D(uMap, vec2((uFrame + vUv.x) / uFrames, vUv.y));
  if (texel.a < 0.5) discard;
  gl_FragColor = texel;
}
`;

/** The player sprite's size in metres at `pitch` degrees: a 2 m frame (a 1.7 m gardener) standing upright as an orthographic camera at that pitch sees it, half as wide as tall. */
export function spriteSize(pitch: number): { w: number; h: number } {
  const h = 2 * Math.cos((pitch * Math.PI) / 180);
  return { w: h / 2, h };
}
