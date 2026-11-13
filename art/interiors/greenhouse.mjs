// The greenhouse's sheets.
//
// spr_floor_greenhouse.png: three frames of grey paving, 16x16 stones in rows
// staggered by 8 px, each frame with its own scatter of moss flecks.
// spr_wall_glass.png: one frame of the greenhouse's glass, four pale panes in
// a whitewashed frame with a diagonal highlight, drawn on every side.
// spr_floor_shelf.png (64x32): the greenhouse's placeable floor shelf, a low
// wooden shelf of two slots (a displayed tree stands on each half of its top
// board), a divider between them, seeded grain on the boards and three legs.

import {
  MOSS,
  MOSS_DARK,
  PANE,
  PANE_LIGHT,
  PANEL_DARK,
  PAVING,
  PAVING_DARK,
  PAVING_LIGHT,
  WHITEWASH,
  WHITEWASH_DARK,
  WOOD_DARK,
  WOOD_LIGHT,
  WOOD_MID,
} from './palette.mjs';
import { SIZE, fill, seeded, setPixel } from './png.mjs';

/**
 * One greenhouse floor frame at column offset `ox`: 16x16 paving stones, each
 * row of stones staggered 8 px, a dark joint on each stone's last row and
 * column and a lit first row, then `frame`'s moss flecks, mostly in the joints.
 */
function paving(png, ox, frame) {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const sx = (x + Math.floor(y / 16) * 8) % 16;
      let c = PAVING;
      if (y % 16 === 15 || sx === 15) c = PAVING_DARK;
      else if (y % 16 === 0) c = PAVING_LIGHT;
      setPixel(png, ox + x, y, c);
    }
  }
  const rng = seeded(1400 + frame);
  for (let i = 0; i < 12; i += 1) {
    const x = Math.floor(rng() * SIZE);
    const y = rng() < 0.6 ? 15 + 16 * Math.floor(rng() * 2) : Math.floor(rng() * SIZE);
    setPixel(png, ox + x, y, rng() < 0.5 ? MOSS : MOSS_DARK);
  }
}

/**
 * The greenhouse's glass wall, 32x32: a whitewashed frame 2 px wide round the
 * tile with a glazing bar across the middle each way, four pale panes inside,
 * a diagonal highlight across them, and a whitewashed sill on the bottom 4 rows.
 */
function glassWall(png) {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const bar = x < 2 || x > 29 || y < 2 || x === 15 || x === 16 || y === 14 || y === 15;
      let c = PANE;
      if (y >= 28) c = y === 28 ? WHITEWASH_DARK : WHITEWASH;
      else if (bar) c = x === 1 || x === 16 || y === 15 || y === 1 ? WHITEWASH_DARK : WHITEWASH;
      else if ((x + y) % 14 === 0 || (x + y) % 14 === 1) c = PANE_LIGHT;
      setPixel(png, x, y, c);
    }
  }
}

/**
 * The floor shelf, 64x32: a top board on rows 0..5 (a tree stands on each
 * 32 px half), its front edge, a lower board on rows 20..23 against a dark
 * back, a divider between the two slots, three legs, and seeded grain.
 */
function floorShelf(png) {
  fill(png, 1, 0, 62, 0, WOOD_LIGHT);
  fill(png, 0, 1, 63, 5, WOOD_MID);
  fill(png, 0, 6, 63, 7, WOOD_DARK);
  fill(png, 3, 8, 60, 19, PANEL_DARK);
  fill(png, 1, 20, 62, 20, WOOD_LIGHT);
  fill(png, 1, 21, 62, 22, WOOD_MID);
  fill(png, 1, 23, 62, 23, WOOD_DARK);
  for (const x of [0, 31, 60]) {
    fill(png, x, 8, x + 3, 30, WOOD_MID);
    fill(png, x, 8, x, 30, WOOD_LIGHT);
    fill(png, x + 3, 8, x + 3, 30, WOOD_DARK);
    fill(png, x, 31, x + 3, 31, WOOD_DARK);
  }
  const rng = seeded(1500);
  for (let i = 0; i < 12; i += 1) {
    const x = 1 + Math.floor(rng() * 62);
    if (rng() < 0.6)
      setPixel(png, x, 1 + Math.floor(rng() * 5), rng() < 0.5 ? WOOD_LIGHT : WOOD_DARK);
    else setPixel(png, x, 21 + Math.floor(rng() * 2), WOOD_LIGHT);
  }
}

export const FLOOR = {
  name: 'spr_floor_greenhouse',
  width: SIZE * 3,
  height: SIZE,
  draw(png) {
    for (let frame = 0; frame < 3; frame += 1) paving(png, frame * SIZE, frame);
  },
};

export const WALL = { name: 'spr_wall_glass', width: SIZE, height: SIZE, draw: glassWall };

export const FLOOR_SHELF = { name: 'spr_floor_shelf', width: 64, height: 32, draw: floorShelf };
