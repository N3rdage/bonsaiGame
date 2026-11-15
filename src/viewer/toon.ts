/**
 * The viewer's Inked look as plain data: the toon light ramp, the ink outline
 * and the colours they are drawn in. Pure: no three.js import, so it is
 * unit-tested in Node; `TreeViewer.ts` turns it into materials.
 *
 * Every mesh is lit by one world-fixed directional light through a stepped
 * ramp (MeshToonMaterial's gradient map), so a form reads as a lit side, a
 * half-tone and a shadow side, never a gradient. Bark and pot are outlined by
 * an inked hull: the same geometry pushed out along its normals by a fixed
 * width in screen pixels and drawn in ink just behind the form, so only its
 * rim shows past the silhouette. Foliage carries its ink in its texture.
 */

import type { Vec3 } from '../sim/types';
import type { Rgb } from './potPalette';

/** Ink, as art/inked/style.mjs has it. */
export const INK_RGB: Rgb = { r: 50, g: 42, b: 38 };
/** The Inked surround (art/inked/style.mjs), the dark warm ground every room page sits on. */
export const SURROUND_RGB: Rgb = { r: 62, g: 54, b: 50 };

/**
 * The light ramp, darkest to lightest, as 0..255 levels, sampled across
 * N.L from -1 to 1. Three bands: N.L below -0.5 is shadow, -0.5 to 0 the
 * half-tone, above 0 fully lit (the palette colour itself).
 */
export const TOON_RAMP: readonly number[] = [150, 205, 255, 255];

/** The ramp as the bytes of a one-row, one-channel gradient texture. */
export function toonRampBytes(ramp: readonly number[] = TOON_RAMP): Uint8Array {
  if (ramp.some((level) => !Number.isInteger(level) || level < 0 || level > 255)) {
    throw new Error('toon ramp levels must be integers in 0..255');
  }
  return Uint8Array.from(ramp);
}

/** Toward the light, in world space (z up), before the viewer's y mirror: above the tree and to one side. */
export const LIGHT_DIRECTION: Vec3 = (() => {
  const d = { x: 1, y: 0.4, z: 1.6 };
  const len = Math.hypot(d.x, d.y, d.z);
  return { x: d.x / len, y: d.y / len, z: d.z / len };
})();

/** Ink outline width in CSS px. */
export const OUTLINE_WIDTH_PX = 2;
/** How far behind its form the ink hull sits, in display units, so it shows only past the silhouette. */
export const OUTLINE_DEPTH = 0.1;

/**
 * An index list drawing each triangle of a flat triangle list twice, once in
 * each winding. With back-face culling (three.js's default `FrontSide`) it
 * draws every face from both sides
 * while the stored normal is used as it is, outward, on either side, where
 * a double-sided material would flip it for faces seen from the back.
 */
export function bothWindings(vertexCount: number): Uint32Array {
  if (vertexCount % 3 !== 0) throw new Error('a triangle list has a multiple of 3 vertices');
  const index = new Uint32Array(vertexCount * 2);
  for (let v = 0; v < vertexCount; v += 3) {
    index.set([v, v + 1, v + 2, v, v + 2, v + 1], v * 2);
  }
  return index;
}
