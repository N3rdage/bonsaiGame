/**
 * The tree viewer's Inked look (src/viewer/toon.ts) in the forms Babylon
 * wants: the ramp as GLSL, the ink as 0..1 channels and the outline's width in
 * metres. Pure: no Babylon import, so it is unit-tested in Node. The data is
 * the viewer's own, never a second copy.
 */

import { INK_RGB, OUTLINE_WIDTH_PX, TOON_RAMP, toonRampBytes } from '../viewer/toon';

/** The ramp's levels as 0..1 factors, darkest first, from the viewer's gradient bytes. */
export function toonLevels(ramp: readonly number[] = TOON_RAMP): number[] {
  return Array.from(toonRampBytes(ramp), (byte) => byte / 255);
}

/** A GLSL float literal of `value`. */
function glsl(value: number): string {
  return value.toFixed(6);
}

/**
 * GLSL for `float toonLevel(float ndl)`: the ramp sampled across N.L from -1 to
 * 1 as the viewer's gradient map is, each of its `n` levels owning an equal
 * slice, so the result steps and never blends.
 */
export function toonLevelGlsl(ramp: readonly number[] = TOON_RAMP): string {
  const levels = toonLevels(ramp);
  const last = levels[levels.length - 1];
  if (last === undefined) throw new Error('a toon ramp has at least one level');
  const steps = levels.slice(0, -1).map((level, i) => {
    const edge = (2 * (i + 1)) / levels.length - 1;
    return `if (ndl < ${glsl(edge)}) return ${glsl(level)};`;
  });
  return `float toonLevel(float ndl) { ${steps.join(' ')} return ${glsl(last)}; }`;
}

/** The ink as 0..1 channels. */
export function inkUnit(): { r: number; g: number; b: number } {
  return { r: INK_RGB.r / 255, g: INK_RGB.g / 255, b: INK_RGB.b / 255 };
}

/**
 * The outline width, in metres, that draws `px` CSS px on a view
 * `viewportPx` tall at `radius` metres from what the camera looks at, for a
 * vertical field of view of `fov` radians: a metre there spans
 * `viewportPx / (2 radius tan(fov / 2))` px.
 */
export function outlineWidthMetres(
  radius: number,
  fov: number,
  viewportPx: number,
  px: number = OUTLINE_WIDTH_PX,
): number {
  return (px * 2 * radius * Math.tan(fov / 2)) / viewportPx;
}
