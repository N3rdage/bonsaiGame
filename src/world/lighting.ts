/**
 * The one light every room and the 3D viewer share, mirrored from
 * art/inked/style.mjs's `STYLE.castShadow` and `STYLE.shadowAlpha` (the
 * generator's module is untyped JavaScript; lighting.test.ts pins the mirror).
 *
 * The light is high in the upper left, so a cast shadow falls down and to
 * the right on the floor: a caster standing `h` logical px tall throws its
 * shadow `CAST_SHADOW.length * h` px along `CAST_SHADOW.direction` (screen
 * space, x right, y down the screen). The viewer's light (toon.ts's
 * `LIGHT_DIRECTION`) is this one with the floor's axes laid on the ground at
 * the viewer's default orbit (`roomLight`).
 */

/** A unit vector on the floor in screen space (x right, y down) shadows fall along, and their length per px of a caster's standing height. */
export const CAST_SHADOW = {
  direction: [0.8, 0.6],
  length: 0.5,
} as const;

/** The cast shadows' wash opacity, STYLE.shadowAlpha; their colour is WASHES.shadow (PALETTE.shadow). */
export const SHADOW_ALPHA = 0.45;

/** Where the top of a caster `height` px tall falls on the floor, relative to its foot, in logical px. */
export function castOffset(height: number): { x: number; y: number } {
  const [dx, dy] = CAST_SHADOW.direction;
  const reach = CAST_SHADOW.length * height;
  return { x: dx * reach, y: dy * reach };
}
