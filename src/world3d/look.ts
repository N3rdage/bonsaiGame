/**
 * The 3D world's look, as pure data and the helpers derived from it: the
 * painterly one, with a soft three-level light ramp, a hemisphere fill so a
 * shadow takes a hue rather than grey, and a thin ink silhouette. Nothing here
 * imports Babylon, so the numbers and the shader text are unit-tested in
 * Node. `lookPlugin.ts` puts the light on materials and `renderer.ts` applies
 * the ink and the image processing.
 */

type Rgb = readonly [number, number, number];

/** A 0xRRGGBB colour as 0..1 channels. */
export function unitRgb(hex: number): Rgb {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

function scaled(colour: Rgb, factor: number): Rgb {
  return [colour[0] * factor, colour[1] * factor, colour[2] * factor];
}

/** The look's numbers: the ramp, the sun, the hemisphere fill, the ink and the image processing. */
export const LOOK = {
  /** Ramp levels, darkest first, across N.L from -1 to 1. */
  ramp: [0.5, 0.74, 1.0],
  /** How much of each slice is a blend into the next, 0 stepped, 1 a smooth gradient. */
  soft: 0.45,
  /** The ink of the silhouettes, 0xRRGGBB, and their width in CSS px. */
  ink: 0x2a2030,
  outlinePx: 1.4,
  sun: 0xffe6b4,
  sunPower: 0.7,
  skyFill: 0x8aa4d4,
  groundFill: 0x7a5a74,
  /** The hemisphere fill's strength. */
  fillPower: 0.5,
  /** The fill's share where the shadow map is fully dark; it is whole where lit. */
  shadowFill: 0.75,
  exposure: 1.05,
  contrast: 1.1,
} as const;

/** The painted surfaces' colours, 0xRRGGBB: what the texture painters take as their defaults. */
export const SURFACES = {
  walls: {
    paper: 0x4f7a64,
    motif: 0x6a9478,
    wainscot: 0xe6d8b8,
    rail: 0x9a6a44,
    skirting: 0x6a4630,
  },
  floor: { plank: 0xb4804e, gap: 0x4a2e20, worn: 0xd0a070 },
  tiles: { tile: 0xd8cbb0, grout: 0x9a8a74 },
  rug: [0x2e4a6a, 0xf0dcb0, 0xb8473a, 0xe0a040],
} as const;

/** The light's colours as the shader takes them: 0..1 triples, power folded in. */
export function lookLight(): { sun: Rgb; sky: Rgb; ground: Rgb } {
  return {
    sun: scaled(unitRgb(LOOK.sun), LOOK.sunPower),
    sky: scaled(unitRgb(LOOK.skyFill), LOOK.fillPower),
    ground: scaled(unitRgb(LOOK.groundFill), LOOK.fillPower),
  };
}

/** A GLSL float literal of `value`. */
function glsl(value: number): string {
  return value.toFixed(5);
}

/**
 * GLSL for `float lookRamp(float ndl)`: the levels across N.L from -1 to 1,
 * each owning an equal slice, blended into the next over `soft` of the slice
 * (a smoothstep about the slice's middle) and flat elsewhere.
 */
export function rampGlsl(levels: readonly number[] = LOOK.ramp, soft: number = LOOK.soft): string {
  const last = levels[levels.length - 1];
  if (last === undefined) throw new Error('a ramp has at least one level');
  const n = levels.length;
  const width = Math.max(soft, 0.02);
  const picks = levels
    .slice(0, -1)
    .map((level, i) => `if (i < ${glsl(i + 0.5)}) return ${glsl(level)};`);
  return `
    float lookLevel(float i) { ${picks.join(' ')} return ${glsl(last)}; }
    float lookRamp(float ndl) {
      float x = clamp((ndl * 0.5 + 0.5) * ${glsl(n)} - 0.5, 0.0, ${glsl(n - 1)});
      float i = floor(x);
      float t = smoothstep(${glsl(0.5 - width / 2)}, ${glsl(0.5 + width / 2)}, x - i);
      return mix(lookLevel(i), lookLevel(min(i + 1.0, ${glsl(n - 1)})), t);
    }`;
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
  px: number = LOOK.outlinePx,
): number {
  return (px * 2 * radius * Math.tan(fov / 2)) / viewportPx;
}
