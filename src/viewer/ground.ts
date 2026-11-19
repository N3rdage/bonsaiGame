/**
 * What the pot stands on and what lies behind it, as plain data. Pure: no
 * three.js import, so it is unit-tested in Node; `TreeViewer.ts` turns it into
 * meshes.
 *
 * The ground is a round wooden display slab, washed `floor`, lying flat at the
 * pot's base, drawn as an Inked texture (`art/inked/viewer.mjs`, `ground.png`) with the pot's ground
 * shadow washed into it: a soft dark pool, offset away from the viewer's one
 * light (`LIGHT_DIRECTION`). The light is fixed in the tree's space and so is
 * the slab, so the pool lies where the light puts it from every side the
 * camera orbits to. The backdrop is the Inked surround (`backdrop.png`, the
 * dark `surroundWash` page with the paper grain) laid over the whole canvas in
 * screen space, behind everything, tinted so its mean lands on `SURROUND_RGB`.
 */

import type { PotTier, Vec3 } from '../sim/types';
import { FOOT_H, POT_DEPTH, POT_LIP, POT_R_TOP } from './potGeometry';
import type { Rgb } from './potPalette';
import { LIGHT_DIRECTION, SURROUND_RGB } from './toon';

/** The pot's widest radius, its rim's outer edge, in display units. */
export const POT_RIM_RADIUS = POT_R_TOP + POT_LIP;

/** The slab's radius in display units: comfortably wider than the pot, small enough to stay in frame. */
export const GROUND_RADIUS = 1.6 * POT_RIM_RADIUS;

/** How far below the pot's base the slab lies, so the two never fight for depth. */
export const GROUND_GAP = 0.002;

/** Height of the slab's top face, in display units (the soil surface is z = 0). */
export function groundZ(tier: PotTier): number {
  return -(POT_DEPTH + (tier === 1 ? FOOT_H : 0)) - GROUND_GAP;
}

/** The ground texture's side in logical px (four art px each): 256 art px. */
export const GROUND_TEXTURE_SIZE = 64;
/** The slab's radius in the texture, logical px; the margin around it holds the wash's bleed and the ink's overshoot. */
export const GROUND_DISC_PX = 29;

/** Half the side of the square the ground texture is laid on, display units: the slab lands at `GROUND_RADIUS`. */
export const GROUND_HALF = (GROUND_RADIUS * GROUND_TEXTURE_SIZE) / 2 / GROUND_DISC_PX;

/**
 * Where a point `height` above the ground falls on it, relative to the point
 * below it, in the tree's own space: away from the light, further the higher
 * the point and the lower the light.
 */
export function shadowOffset(height: number, light: Vec3 = LIGHT_DIRECTION): Vec3 {
  if (light.z <= 0) throw new Error('the light must be above the ground');
  return { x: (-light.x * height) / light.z, y: (-light.y * height) / light.z, z: 0 };
}

/**
 * The pot's ground shadow in the tree's own space: one round pool covering
 * what the rim and the base cast, centred where the plain pot's mid-height
 * falls and wide enough to reach the rim's shadow on the far side. One pool
 * serves both tiers: the footed pot stands its feet's height taller, a
 * difference the soft pool does not show.
 */
export function potShadow(): { x: number; y: number; radius: number } {
  const offset = shadowOffset(POT_DEPTH / 2);
  return {
    x: offset.x,
    y: offset.y,
    radius: POT_RIM_RADIUS + Math.hypot(offset.x, offset.y),
  };
}

/**
 * A point in the tree's own space (x, y on the ground) as logical px in the
 * ground texture. The texture lies centred on the trunk, its u along +x and
 * its v along +y; the image's rows run top down, so +y is up the image.
 */
export function groundTexturePx(x: number, y: number): { px: number; py: number } {
  const perUnit = GROUND_TEXTURE_SIZE / 2 / GROUND_HALF;
  return { px: GROUND_TEXTURE_SIZE / 2 + x * perUnit, py: GROUND_TEXTURE_SIZE / 2 - y * perUnit };
}

/** The shadow pool as `art/inked/viewer.mjs` draws it, logical px, rounded to hundredths. */
export function groundShadowPx(): { cx: number; cy: number; r: number } {
  const { x, y, radius } = potShadow();
  const { px, py } = groundTexturePx(x, y);
  const r = (radius * GROUND_TEXTURE_SIZE) / 2 / GROUND_HALF;
  const round = (v: number): number => Math.round(v * 100) / 100;
  return { cx: round(px), cy: round(py), r: round(r) };
}

/** The backdrop texture's side in art px (64 logical px): one paper grain period, so it tiles without a seam. */
export const BACKDROP_TEXTURE_PX = 256;
/** CSS px per backdrop texel: the grain lands a pixel to a texel, so it reads as paper on every screen. */
export const BACKDROP_CSS_PX_PER_TEXEL = 1;

/** The mean colour of `backdrop.png` as drawn (`ground.test.ts` measures it). */
export const BACKDROP_MEAN_RGB: Rgb = { r: 117, g: 106, b: 96 };

/** What the backdrop texture is multiplied by, per channel, so its mean lands on the surround. */
export function backdropTint(mean: Rgb = BACKDROP_MEAN_RGB, target: Rgb = SURROUND_RGB): Rgb {
  if (mean.r <= 0 || mean.g <= 0 || mean.b <= 0) throw new Error('the backdrop must not be black');
  return { r: target.r / mean.r, g: target.g / mean.g, b: target.b / mean.b };
}
