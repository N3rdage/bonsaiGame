// The shed's outside, seen from the garden.
//
// spr_shed_exterior.png (64x112): the shed's back wall round the garden door,
// a shingled eave over spr_wall's planks, a lintel and jambs round a dark
// opening the door sprite fills, a stone sill and stone footing.

import {
  SOOT,
  STONE,
  STONE_DARK,
  STONE_LIGHT,
  WOOD_DARK,
  WOOD_LIGHT,
  WOOD_MID,
} from './palette.mjs';
import { fill, seeded, setPixel } from './png.mjs';

/** spr_wall's plank columns, 8 px a plank: a dark seam, a lit edge, the board, a highlight. */
const SHED_PLANK = [
  [70, 45, 25],
  [110, 78, 50],
  [93, 66, 42],
  [93, 66, 42],
  [93, 66, 42],
  [93, 66, 42],
  [136, 93, 59],
  [93, 66, 42],
];
const SHED_KNOT = [80, 51, 28];
const SHINGLE = [74, 62, 56];
const SHINGLE_DARK = [48, 40, 36];
const SHINGLE_LIGHT = [100, 86, 76];

/**
 * The shed's back wall round the garden door, 64x112: a shingled eave on rows
 * 0..13, spr_wall's vertical planks with seeded knots, a lintel and jambs
 * framing a dark 32x32 opening at (16, 48) where spr_door is drawn, a stone
 * sill under it, and staggered stone footing on rows 96..111.
 */
function shedExterior(png) {
  for (let y = 0; y < 12; y += 1) {
    const row = Math.floor(y / 4);
    for (let x = 0; x < 64; x += 1) {
      const bx = (x + (row % 2) * 4) % 8;
      let c = SHINGLE;
      if (y % 4 === 3 || bx === 7) c = SHINGLE_DARK;
      else if (y % 4 === 0) c = SHINGLE_LIGHT;
      setPixel(png, x, y, c);
    }
  }
  fill(png, 0, 12, 63, 12, WOOD_LIGHT);
  fill(png, 0, 13, 63, 13, WOOD_DARK);
  for (let y = 14; y < 96; y += 1) {
    for (let x = 0; x < 64; x += 1) setPixel(png, x, y, SHED_PLANK[x % 8]);
  }
  const rng = seeded(1300);
  for (let i = 0; i < 8; i += 1) {
    setPixel(png, Math.floor(rng() * 64), 16 + Math.floor(rng() * 78), SHED_KNOT);
  }
  fill(png, 10, 42, 53, 85, WOOD_MID);
  fill(png, 10, 42, 10, 85, WOOD_DARK);
  fill(png, 53, 42, 53, 85, WOOD_DARK);
  fill(png, 8, 38, 55, 38, WOOD_LIGHT);
  fill(png, 8, 39, 55, 43, WOOD_MID);
  fill(png, 8, 44, 55, 45, WOOD_DARK);
  fill(png, 16, 48, 47, 79, SOOT);
  fill(png, 12, 80, 51, 80, STONE_LIGHT);
  fill(png, 12, 81, 51, 84, STONE);
  fill(png, 12, 85, 51, 85, STONE_DARK);
  for (let y = 96; y < 112; y += 1) {
    const row = Math.floor((y - 96) / 8);
    for (let x = 0; x < 64; x += 1) {
      const bx = (x + (row % 2) * 6) % 12;
      let c = STONE;
      if ((y - 96) % 8 === 7 || bx === 11) c = STONE_DARK;
      else if ((y - 96) % 8 === 0 || bx === 0) c = STONE_LIGHT;
      setPixel(png, x, y, c);
    }
  }
}

export const SHED_EXTERIOR = {
  name: 'spr_shed_exterior',
  width: 64,
  height: 112,
  draw: shedExterior,
};
