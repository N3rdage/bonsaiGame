// The proposed scale rule as data: one 16 px tile is 50 cm of floor, heights
// draw foreshortened to two thirds (the rooms are a three-quarter top-down
// view). Furniture's drawn height is its front face (real height x about
// 21.33 px/m) plus its footprint's depth, rounded to 4 px; the avatar and the
// front-on door round to the tile grid instead. The table below is the one in
// docs/proposals/art-direction/README.md; the scene and the scale diagram
// read their sizes from it.

export const TILE = 16;
export const CM_PER_TILE = 50;
export const FORESHORTEN = 2 / 3;
/** Logical pixels per metre of floor (32) and of drawn height (about 21). */
export const PX_PER_M = (TILE * 100) / CM_PER_TILE;
export const PX_PER_M_HIGH = PX_PER_M * FORESHORTEN;
/** The starter bonsai alone is drawn at three times true size so it reads on a phone. */
export const HERO_SCALE = 3;

/** Real sizes in metres (w, d, h) and the logical-pixel footprint and sprite each becomes. */
export const SIZES = {
  avatar: { real: [0.5, 0.3, 1.7], footprint: [16, 8], sprite: [16, 32] },
  doorNorth: { real: [0.8, null, 2.0], footprint: [24, 4], sprite: [24, 40] },
  doorSide: { real: [null, 0.8, 2.0], footprint: [8, 24], sprite: [8, 40] },
  workbench: { real: [1.5, 0.6, 0.9], footprint: [48, 20], sprite: [48, 40] },
  plantingTable: { real: [1.2, 0.6, 0.9], footprint: [40, 20], sprite: [40, 40] },
  kiosk: { real: [1.2, 0.6, 1.1], footprint: [40, 20], sprite: [40, 44] },
  pedestal: { real: [0.4, 0.4, 1.0], footprint: [16, 12], sprite: [16, 32] },
  bookcase: { real: [1.2, 0.4, 2.0], footprint: [40, 12], sprite: [40, 56] },
  window: { real: [1.0, null, 0.8], footprint: null, sprite: [32, 24], sillAboveFloor: 16 },
  backWall: { real: [null, null, 2.4], sprite: [null, 48] },
  wallCap: { real: [null, 0.25, null], sprite: [8, null] },
  starterBonsai: { real: [0.12, 0.12, 0.25], sprite: [14, 18], pot: [10, 5], heroScale: HERO_SCALE },
};
