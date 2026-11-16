// The Inked style as data: its authoring scale, its palette and its knobs.
// STYLE is the game's look: rough, uneven ink with dry-brush breaks and
// spatter, washes that pool and bleed, paper grain, corner shading and wear.
// art/inked/README.md documents each knob.

/** Art px per logical px: a 16 px tile is 64 art px. */
export const PER_LOGICAL = 4;
/** Samples per art px in each direction; the rasteriser box-filters them down. */
export const SUPERSAMPLE = 3;

export const PAPER = [242, 234, 218];
export const INK = [50, 42, 38];
export const SURROUND = [62, 54, 50];
export const WASH_ALPHA = 0.65;
/** Every wash by material. A form names its wash; later rooms add materials here, never inline. */
export const WASHES = {
  wall: [222, 204, 176],
  floor: [214, 190, 156],
  wood: [184, 140, 100],
  top: [212, 178, 136],
  cap: [150, 124, 100],
  stone: [196, 194, 188],
  metal: [150, 166, 178],
  terracotta: [208, 136, 100],
  foliage: [132, 164, 108],
  soil: [120, 96, 78],
  shirt: [116, 146, 184],
  trousers: [120, 106, 96],
  skin: [236, 192, 160],
  hair: [96, 76, 64],
  brass: [214, 180, 96],
  glass: [168, 198, 206],
  lamp: [250, 222, 150],
  cream: [230, 216, 188],
  rug: [190, 120, 110],
  outside: [150, 184, 118],
  shadow: [110, 94, 80],
  // The buildings seen from the garden: the house's render and roof tiles, the greenhouse's white frame.
  render: [214, 198, 176],
  tile: [184, 116, 92],
  paint: [204, 208, 200],
  // The road the front garden looks onto.
  asphalt: [108, 108, 110],
  // The 3D viewer's textures are tinted by each species' colours, so their washes are near neutral.
  bark: [170, 160, 148],
  leaf: [188, 190, 178],
  // The gardens' season washes, laid over the whole baked garden at runtime
  // (src/world/palette.ts mirrors these): spring's fresh green, autumn's
  // browning, winter's frost. Summer has none.
  lawnSpring: [200, 226, 150],
  lawnAutumn: [200, 140, 80],
  frost: [236, 240, 244],
  // The weather's particles, drawn live (src/world/weather.ts by way of
  // palette.ts), the prototype's colours: spring petals, summer fireflies,
  // autumn leaves, winter snow, and the indoor rooms' dust motes.
  petal: [255, 214, 224],
  petalDeep: [255, 190, 212],
  petalPale: [250, 226, 233],
  firefly: [214, 240, 140],
  fireflyPale: [232, 246, 165],
  leafRed: [210, 90, 40],
  leafOrange: [230, 140, 40],
  leafRust: [178, 68, 30],
  leafOchre: [160, 112, 42],
  snow: [255, 255, 255],
  snowShade: [226, 236, 246],
  mote: [232, 226, 200],
};
/**
 * How far from paper a finished pixel may be and still count as paper when a
 * cut-out sprite (`finishCutOut`) drops the paper around its forms: above
 * the grain's deepest darkening, below every wash as it lands.
 */
export const CUT_OUT_TOLERANCE = 42;
/** Which washes wear as which material: wood splits and knots, pots chip and ring, cloth frays and stains. */
export const WEAR_BY_WASH = {
  wood: 'wood',
  top: 'wood',
  terracotta: 'pot',
  rug: 'cloth',
  cream: 'cloth',
};

const mix = (wash) => PAPER.map((p, i) => Math.round(p * (1 - WASH_ALPHA) + wash[i] * WASH_ALPHA));

/** The palette strip: surround, ink, paper, then each wash as it lands on paper. */
export const palette = [
  { name: 'surround', rgb: SURROUND },
  { name: 'ink', rgb: INK },
  { name: 'paper', rgb: PAPER },
  ...Object.entries(WASHES).map(([n, w]) => ({ name: `${n} wash`, rgb: mix(w) })),
];

/** The chosen look. Lengths are logical px unless a comment says art px. */
export const STYLE = {
  jitter: 0.8,
  overshoot: 1.8,
  weightVariation: 0.35,
  dryBrush: { strength: 0.85, minLength: 12, every: 24 },
  spatter: { chance: 0.12, minWidth: 2.4, dots: 3, radius: 2.2 },
  washPool: 0.25,
  washPoolWidth: 0.9,
  washBleed: 0.8,
  washGranulation: 0.12,
  grain: 0.09,
  shadowAlpha: 0.45,
  crossHatch: { angle: -0.75, spacing: 1.7 },
  cornerShade: 7,
  wear: 1,
};
