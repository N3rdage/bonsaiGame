// The study's sheets.
//
// spr_floor_study.png: three frames of deep-red herringbone parquet that
// repeats every 16 px. spr_wall_study.png: dark wooden panelling, a raised
// panel per half tile, over a skirting board.
// spr_desk.png (64x32, drawers on the left, papers on the right) and
// spr_bookshelf.png (32x32, one bay of a low bookcase that repeats along a
// run), each one frame at its exact size, transparent where the floor shows
// through.

import { skirting } from './common.mjs';
import {
  BOARD_LIGHT,
  BOOKS,
  PANEL,
  PANEL_DARK,
  PANEL_LIGHT,
  PAPER_FLECK,
  PAPER_STRIPE,
  PARQUET,
  PARQUET_DARK,
  PARQUET_LIGHT,
  WOOD_DARK,
  WOOD_LIGHT,
  WOOD_MID,
} from './palette.mjs';
import { SIZE, fill, seeded, setPixel } from './png.mjs';

/**
 * One study floor frame at column offset `ox`: herringbone parquet, 2x8 px
 * blocks alternating direction every 4 px in a 16 px repeat, a dark edge on
 * each block's last row or column, then `frame`'s lighter grain.
 */
function parquet(png, ox, frame) {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const u = (x + y) % 16;
      const v = (x - y + 32) % 16;
      const along = Math.floor(u / 4) % 2 === 0;
      const edge = along ? v % 8 === 7 : u % 4 === 3;
      setPixel(png, ox + x, y, edge ? PARQUET_DARK : PARQUET);
    }
  }
  const rng = seeded(900 + frame);
  for (let i = 0; i < 12; i += 1) {
    const x = Math.floor(rng() * SIZE);
    const y = Math.floor(rng() * SIZE);
    setPixel(png, ox + x, y, PARQUET_LIGHT);
  }
}

/** The study wall: dark panelling, a raised panel in each 16 px half, the skirting board. */
function panelling(png) {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const px = x % 16;
      let c = PANEL;
      if (y >= 3 && y <= 22 && px >= 3 && px <= 12) {
        if (y === 3 || px === 3) c = PANEL_DARK;
        else if (y === 22 || px === 12) c = PANEL_LIGHT;
      }
      if (px === 15) c = PANEL_DARK;
      setPixel(png, x, y, c);
    }
  }
  skirting(png);
}

/**
 * The study desk, 64x32: a planked top on rows 0..16 with papers on its right
 * (the middle stays clear for a displayed tree), its front edge, then a
 * drawer pedestal on the left, a dark kneehole and a leg on the right.
 */
function desk(png) {
  fill(png, 0, 0, 63, 0, WOOD_LIGHT);
  fill(png, 0, 1, 63, 16, WOOD_MID);
  for (const y of [6, 12]) fill(png, 0, y, 63, y, BOARD_LIGHT);
  fill(png, 44, 3, 57, 12, PAPER_FLECK);
  for (const y of [5, 7, 9]) fill(png, 46, y, 55, y, PAPER_STRIPE);
  fill(png, 0, 17, 63, 19, WOOD_DARK);
  fill(png, 1, 20, 20, 30, WOOD_MID);
  fill(png, 1, 20, 1, 30, WOOD_DARK);
  fill(png, 20, 20, 20, 30, WOOD_DARK);
  fill(png, 2, 25, 19, 25, WOOD_DARK);
  for (const y of [22, 28]) fill(png, 10, y, 11, y, WOOD_LIGHT);
  fill(png, 21, 20, 56, 30, PANEL_DARK);
  fill(png, 57, 20, 62, 30, WOOD_MID);
  fill(png, 57, 20, 57, 30, WOOD_DARK);
  fill(png, 62, 20, 62, 30, WOOD_DARK);
  fill(png, 1, 31, 62, 31, WOOD_DARK);
}

/** One row of books standing on row `bottom` across x 2..29, seeded widths, heights and colours. */
function books(png, rng, top, bottom) {
  for (let x = 2; x < 30;) {
    const w = 2 + Math.floor(rng() * 3);
    const h = bottom - top - Math.floor(rng() * 4);
    const c = BOOKS[Math.floor(rng() * BOOKS.length)];
    if (rng() > 0.1) fill(png, x, bottom - h + 1, Math.min(x + w - 1, 29), bottom, c);
    x += w;
  }
}

/**
 * One bay of the study's low bookcase, 32x32, repeated along its run: a top
 * board on rows 0..3 (a displayed tree stands on it), dark sides, and two
 * shelves of seeded books against a dark back.
 */
function bookshelf(png) {
  fill(png, 0, 0, 31, 0, WOOD_LIGHT);
  fill(png, 0, 1, 31, 2, WOOD_MID);
  fill(png, 0, 3, 31, 3, WOOD_DARK);
  fill(png, 2, 4, 29, 29, PANEL_DARK);
  const rng = seeded(1200);
  books(png, rng, 6, 16);
  fill(png, 2, 17, 29, 18, WOOD_MID);
  fill(png, 2, 19, 29, 19, WOOD_DARK);
  books(png, rng, 20, 29);
  for (const x of [0, 31]) fill(png, x, 4, x, 31, WOOD_DARK);
  for (const x of [1, 30]) fill(png, x, 4, x, 31, WOOD_MID);
  fill(png, 2, 30, 29, 30, WOOD_MID);
  fill(png, 2, 31, 29, 31, WOOD_DARK);
}

export const FLOOR = {
  name: 'spr_floor_study',
  width: SIZE * 3,
  height: SIZE,
  draw(png) {
    for (let frame = 0; frame < 3; frame += 1) parquet(png, frame * SIZE, frame);
  },
};

export const WALL = { name: 'spr_wall_study', width: SIZE, height: SIZE, draw: panelling };

export const DESK = { name: 'spr_desk', width: 64, height: 32, draw: desk };

export const BOOKSHELF = { name: 'spr_bookshelf', width: 32, height: 32, draw: bookshelf };
