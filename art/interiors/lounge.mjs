// The lounge's sheets.
//
// spr_floor_lounge.png: three 32x32 frames of warm carpet, a diamond weave
// that repeats every 8 px so tiles meet seamlessly, each frame with its own
// scatter of flecks. spr_wall_lounge.png: one 32x32 frame of striped
// wallpaper over a wooden skirting board.
// spr_fireplace.png (64x48, a stone surround under a wooden mantel, a fire in
// its box, a hearth) and spr_side_table.png (32x32, a small table with a lower
// shelf), each one frame at its exact size, transparent where the floor shows
// through.

import { skirting } from './common.mjs';
import {
  CARPET,
  CARPET_DARK,
  CARPET_LIGHT,
  FLAME,
  FLAME_LIGHT,
  PAPER,
  PAPER_FLECK,
  PAPER_STRIPE,
  SOOT,
  STONE,
  STONE_DARK,
  STONE_LIGHT,
  WOOD_DARK,
  WOOD_LIGHT,
  WOOD_MID,
} from './palette.mjs';
import { SIZE, fill, seeded, setPixel } from './png.mjs';

/** One carpet frame at column offset `ox`: the weave, then `frame`'s flecks. */
function carpet(png, ox, frame) {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const d = (Math.abs((x % 8) - 4) + Math.abs((y % 8) - 4)) % 8;
      setPixel(png, ox + x, y, d === 4 ? CARPET_DARK : CARPET);
    }
  }
  const rng = seeded(500 + frame);
  for (let i = 0; i < 14; i += 1) {
    const x = Math.floor(rng() * SIZE);
    const y = Math.floor(rng() * SIZE);
    setPixel(png, ox + x, y, rng() < 0.5 ? CARPET_LIGHT : CARPET_DARK);
  }
}

/** The wall: wallpaper striped every 8 px with a few flecks, a skirting board on the bottom 6 rows. */
function wall(png) {
  const rng = seeded(600);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      setPixel(png, x, y, x % 8 < 2 ? PAPER_STRIPE : PAPER);
    }
  }
  for (let i = 0; i < 10; i += 1) {
    setPixel(png, Math.floor(rng() * SIZE), Math.floor(rng() * 25), PAPER_FLECK);
  }
  skirting(png);
}

/**
 * The lounge fireplace, 64x48: a wooden mantel shelf across rows 0..5 (a
 * displayed tree stands on it), a surround of staggered 12x6 stone blocks
 * with an arched sooty firebox, logs and a seeded fire, and a stone hearth on
 * rows 42..47. The surround's outer columns are transparent, so the floor
 * shows beside it.
 */
function fireplace(png) {
  fill(png, 0, 0, 63, 0, WOOD_LIGHT);
  fill(png, 0, 1, 63, 3, WOOD_MID);
  fill(png, 0, 4, 63, 5, WOOD_DARK);
  for (let y = 6; y < 42; y += 1) {
    const row = Math.floor((y - 6) / 6);
    for (let x = 4; x < 60; x += 1) {
      const bx = (x - 4 + (row % 2) * 6) % 12;
      let c = STONE;
      if ((y - 6) % 6 === 5 || bx === 11) c = STONE_DARK;
      else if ((y - 6) % 6 === 0 || bx === 0) c = STONE_LIGHT;
      setPixel(png, x, y, c);
    }
  }
  for (let y = 16; y < 42; y += 1) {
    for (let x = 18; x < 46; x += 1) {
      if (y > 17 || (x > 19 && x < 44)) setPixel(png, x, y, SOOT);
    }
  }
  const rng = seeded(1100);
  for (let x = 22; x < 42; x += 1) {
    const h = 3 + Math.floor(rng() * 5) + (x > 26 && x < 37 ? 5 : 0);
    for (let y = 38 - h; y < 39; y += 1) setPixel(png, x, y, y > 38 - h / 2 ? FLAME_LIGHT : FLAME);
  }
  fill(png, 22, 39, 41, 39, WOOD_MID);
  fill(png, 22, 40, 41, 40, WOOD_DARK);
  fill(png, 0, 42, 63, 42, STONE_LIGHT);
  fill(png, 0, 43, 63, 46, STONE);
  fill(png, 0, 47, 63, 47, STONE_DARK);
  for (const x of [15, 31, 47]) fill(png, x, 43, x, 46, STONE_DARK);
}

/** The lounge side table, 32x32: a top on rows 2..11 with rounded corners, two legs and a lower shelf. */
function sideTable(png) {
  fill(png, 4, 2, 27, 2, WOOD_LIGHT);
  fill(png, 2, 3, 29, 9, WOOD_MID);
  fill(png, 3, 10, 28, 10, WOOD_DARK);
  fill(png, 4, 11, 27, 11, WOOD_DARK);
  fill(png, 5, 12, 6, 29, WOOD_DARK);
  fill(png, 25, 12, 26, 29, WOOD_DARK);
  fill(png, 7, 21, 24, 22, WOOD_MID);
  fill(png, 7, 23, 24, 23, WOOD_DARK);
}

export const FLOOR = {
  name: 'spr_floor_lounge',
  width: SIZE * 3,
  height: SIZE,
  draw(png) {
    for (let frame = 0; frame < 3; frame += 1) carpet(png, frame * SIZE, frame);
  },
};

export const WALL = { name: 'spr_wall_lounge', width: SIZE, height: SIZE, draw: wall };

export const FIREPLACE = { name: 'spr_fireplace', width: 64, height: 48, draw: fireplace };

export const SIDE_TABLE = { name: 'spr_side_table', width: 32, height: 32, draw: sideTable };
