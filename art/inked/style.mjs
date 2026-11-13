// The Inked style as data: its authoring scale, its palette and its knobs.
// STYLE is the look Drew chose (backlog #137): the proposal's Inked made a
// little grungier. PROPOSAL_STYLE turns every grunge knob off, which
// reproduces the proposal render of #127 exactly; it exists so the two can be
// shown side by side. art/inked/README.md documents each knob.

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
};
/** Which washes wear as which material: wood splits and knots, pots chip and ring, cloth frays and stains. */
export const WEAR_BY_WASH = { wood: 'wood', top: 'wood', terracotta: 'pot', rug: 'cloth', cream: 'cloth' };

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

/** The proposal's Inked (#127): every grunge knob off. */
export const PROPOSAL_STYLE = {
  jitter: 0.5,
  overshoot: 1.5,
  weightVariation: 0,
  dryBrush: { strength: 0, minLength: 0, every: 1 },
  spatter: { chance: 0, minWidth: 0, dots: 0, radius: 0 },
  washPool: 0,
  washPoolWidth: 0,
  washBleed: 0,
  washGranulation: 0,
  grain: 0,
  shadowAlpha: 0.35,
  crossHatch: null,
  cornerShade: 0,
  wear: 0,
};
