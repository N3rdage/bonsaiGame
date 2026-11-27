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

/** The furniture models' colours, 0xRRGGBB, by what each part is made of: warm woods, glazed ceramics and plain stone, painted rather than washed. */
export const OBJECTS = {
  white: 0xffffff,
  flame: 0xff9a3c,
  flameCore: 0xffe9a0,
  soot: 0x2e2622,
  log: 0x8a5a3a,
  bark: 0x6e4a34,
  soil: 0x4a3426,
  brass: 0xc8a050,
  copper: 0xc87850,
  ink: 0x3a2c28,
  bread: 0xd8a060,
  fruit1: 0xe05a3a,
  fruit2: 0xf0c040,
  fruit3: 0xf0d860,
  cat: 0xe0904a,
  catDark: 0xb86a34,
  cream: 0xf6ecd6,
  wood: 0xb07a4a,
  woodDark: 0x7a4a30,
  woodLight: 0xd4a46a,
  sofa: 0xb85a48,
  sofaLight: 0xcc7058,
  cushionA: 0xe8c060,
  cushionB: 0x4a7a8a,
  throw: 0xf0e0c0,
  chair: 0x5a8a6a,
  chairLight: 0x6e9e7a,
  shade: 0xf6e0b0,
  ceramic: 0xf4ecdc,
  ceramicB: 0x4a7a9a,
  glaze: 0x2e6a7a,
  terracotta: 0xc4643e,
  leaf: 0x4a8a3e,
  leafLight: 0x7aae4a,
  leafDark: 0x2e6a3a,
  stone: 0xb4a898,
  frame: 0xc8a050,
  frameDark: 0x4a3020,
  curtain: 0xf0dcb0,
  curtainDark: 0xd8c098,
  sill: 0xf0e6d0,
  sky: 0xd8eef8,
  flower: 0xf06a7a,
  book1: 0xa83a30,
  book2: 0x2e5a7a,
  book3: 0xe0a840,
  book4: 0x4a7a4a,
  book5: 0x7a4a7a,
  wicker: 0xc49a60,
  cabinet: 0xe8dcc0,
  cabinetLight: 0xf2e8d0,
  towel: 0x4a7aa0,
  jar: 0xf2e8d0,
  jarB: 0xc87048,
  door: 0xe0d2b4,
  doorDark: 0xccbc98,
  coat: 0xa84a3a,
} as const;

/** A name in the object palette. */
export type ObjectKey = keyof typeof OBJECTS;

/** The Rogue's atlas (`rogue_texture.png`): a grid of swatch cells, each a vertical gradient. */
export const BODY_ATLAS = { columns: 8, rows: 4 } as const;

/**
 * The gardener's clothes: the atlas cell (column, row from the image's top)
 * each part of the Rogue's body samples, and the colours, 0xRRGGBB, that
 * cell's gradient is recoloured to, from its lightest end to its darkest.
 * Skin, hair and eyes are cells left as drawn.
 */
export const BODY_PALETTE = {
  /** The tunic, body and skirt: terracotta. */
  tunic: { cell: [0, 1], light: 0xcf7a52, dark: 0x8f4a30 },
  /** The scarf at the neck and a band on each arm: cream. */
  scarf: { cell: [1, 1], light: 0xf4ead2, dark: 0xc9b68f },
  /** The apron's strap over each shoulder and its waistband: cream, a shade warmer than the scarf. */
  apron: { cell: [5, 0], light: 0xeedfbd, dark: 0xbfa57a },
  /** The forearms' sleeves: linen. */
  sleeves: { cell: [7, 2], light: 0xe8dcc0, dark: 0xa89870 },
  /** The belt and the wrist guards: brown leather. */
  belt: { cell: [3, 0], light: 0x7a5236, dark: 0x4a3020 },
  /** The pouches on the hip: a lighter leather. */
  pouches: { cell: [6, 0], light: 0x9a6a44, dark: 0x6a4630 },
  /** The trousers: dark. */
  trousers: { cell: [7, 1], light: 0x4a4038, dark: 0x2a2420 },
  /** The boots: brown. */
  boots: { cell: [3, 2], light: 0x7a4e30, dark: 0x3e2616 },
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
