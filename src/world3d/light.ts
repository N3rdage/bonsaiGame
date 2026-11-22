/**
 * The 3D world's one light, derived from the game's shared light
 * (src/world/lighting.ts) and never authored beside it. Pure: no Babylon.
 */

import { CAST_SHADOW, SHADOW_ALPHA } from '../world/lighting';
import { toBabylon, type Vec3 } from './meshes';

/**
 * The unit direction the light travels in the plan's frame (x east, y south,
 * z up). A caster `h` tall throws its top `CAST_SHADOW.length * h` along
 * `CAST_SHADOW.direction` on the floor, so a ray that drops 1 travels
 * `CAST_SHADOW.length` sideways that way: down and to the right, as in 2D.
 */
export function lightDirection(): Vec3 {
  const [dx, dy] = CAST_SHADOW.direction;
  const run = CAST_SHADOW.length;
  const norm = Math.hypot(run, 1);
  return { x: (dx * run) / norm, y: (dy * run) / norm, z: -1 / norm };
}

/** The same direction in Babylon's frame, for the directional light. */
export function lightDirectionBabylon(): Vec3 {
  return toBabylon(lightDirection());
}

/** Where, relative to its foot in the plan, the top of a caster `height` metres tall lands on the floor. */
export function shadowOffset(height: number): { x: number; y: number } {
  const d = lightDirection();
  return { x: (d.x * height) / -d.z, y: (d.y * height) / -d.z };
}

/** Babylon's `ShadowGenerator.darkness` is 0 for black to 1 for no shadow, so the wash's opacity is its complement. */
export function shadowDarkness(): number {
  return 1 - SHADOW_ALPHA;
}
