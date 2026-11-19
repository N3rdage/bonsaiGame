// The Inked style as data: its authoring scale, its palette and its knobs.
// STYLE is the game's look: calm ink that seldom runs dry, strong washes that
// pool and bleed a little, a light paper grain, corner shading and a little
// wear. Large flat areas stay calm; detail goes on what the player looks at.
// art/inked/README.md documents each knob.

/** Art px per logical px: a 16 px tile is 64 art px. */
export const PER_LOGICAL = 4;
/** Samples per art px in each direction; the rasteriser box-filters them down. */
export const SUPERSAMPLE = 3;

export const PAPER = [242, 234, 218];
export const INK = [50, 42, 38];
export const SURROUND = [62, 54, 50];
export const WASH_ALPHA = 0.82;
/** Every wash by material. A form names its wash; later rooms add materials here, never inline. */
export const WASHES = {
  wall: [238, 226, 200],
  floor: [186, 140, 98],
  wood: [150, 100, 64],
  top: [168, 120, 78],
  cap: [98, 76, 62],
  stone: [196, 194, 188],
  metal: [150, 166, 178],
  terracotta: [204, 112, 74],
  foliage: [88, 150, 84],
  soil: [120, 96, 78],
  shirt: [116, 146, 184],
  trousers: [120, 106, 96],
  skin: [236, 192, 160],
  hair: [96, 76, 64],
  brass: [214, 180, 96],
  glass: [150, 204, 222],
  lamp: [250, 222, 150],
  cream: [240, 226, 196],
  rug: [168, 70, 66],
  outside: [150, 184, 118],
  shadow: [110, 94, 80],
  // The dark surround the rooms' paper is washed with, so each room stands framed.
  surroundWash: [92, 80, 72],
  // The buildings seen from the garden: the house's render and roof tiles, the greenhouse's white frame.
  render: [214, 198, 176],
  tile: [184, 116, 92],
  paint: [204, 208, 200],
  // The road the front garden looks onto.
  asphalt: [108, 108, 110],
  // The house rooms: the lounge's carpet and wallpaper, the hallway's runner,
  // the study's paper and parquet.
  carpet: [168, 128, 110],
  wallpaper: [196, 206, 178],
  runner: [76, 128, 92],
  studyPaper: [184, 196, 208],
  parquet: [178, 116, 86],
  // The 3D viewer's textures are tinted by each species' colours: these are chosen to land near neutral.
  bark: [185, 175, 163],
  leaf: [199, 199, 186],
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
 * the grain's deepest darkening. A wash that lands within it (`wall`,
 * `cream`) survives a cut-out only inside an ink edge.
 */
export const CUT_OUT_TOLERANCE = 42;
/** Which washes wear as which material: wood splits and knots, pots chip and ring, cloth frays and stains. */
export const WEAR_BY_WASH = {
  wood: 'wood',
  top: 'wood',
  terracotta: 'pot',
  rug: 'cloth',
  runner: 'cloth',
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
  jitter: 0.5,
  overshoot: 1.0,
  weightVariation: 0.35,
  dryBrush: { strength: 0.5, minLength: 20, every: 80 },
  spatter: { chance: 0.02, minWidth: 2.4, dots: 3, radius: 2.2 },
  washPool: 0.25,
  washPoolWidth: 0.9,
  washBleed: 0.8,
  washGranulation: 0.06,
  grain: 0.04,
  shadowAlpha: 0.45,
  castShadow: { direction: [0.8, 0.6], length: 0.5 },
  crossHatch: { angle: -0.75, spacing: 1.7 },
  cornerShade: 7,
  wear: 0.3,
};
