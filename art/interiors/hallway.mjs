// The hallway's sheets.
//
// spr_floor_hallway.png: three frames of dark floorboards, 8 px planks with
// staggered joints, a green runner stripe across the middle of each tile so
// the tiles of a row join into one long horizontal runner.
// spr_wall_hallway.png: plain plaster over a dado rail and a skirting board.
// spr_runner.png (416x48, a fringed wine runner) and spr_hall_table.png
// (32x24, a console table), each one frame at its exact size, transparent
// where the floor shows through.

import { skirting } from './common.mjs';
import {
  BOARD,
  BOARD_DARK,
  BOARD_LIGHT,
  PLASTER,
  PLASTER_FLECK,
  RUNNER,
  RUNNER_EDGE,
  WINE,
  WINE_DARK,
  WOOD_DARK,
  WOOD_LIGHT,
  WOOD_MID,
} from './palette.mjs';
import { SIZE, fill, seeded, setPixel } from './png.mjs';

/**
 * One hallway floor frame at column offset `ox`: horizontal 8 px planks, each
 * with a dark seam on its last row and a joint at a per-plank column, then a
 * green runner across rows 8..23 with light edges, then `frame`'s grain.
 */
function boards(png, ox, frame) {
  const joints = [5, 21, 13, 29];
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const plank = Math.floor(y / 8);
      let c = BOARD;
      if (y % 8 === 7 || x === joints[plank]) c = BOARD_DARK;
      if (y >= 8 && y < 24) c = y === 8 || y === 23 ? RUNNER_EDGE : RUNNER;
      setPixel(png, ox + x, y, c);
    }
  }
  const rng = seeded(700 + frame);
  for (let i = 0; i < 10; i += 1) {
    const x = Math.floor(rng() * SIZE);
    const y = rng() < 0.5 ? Math.floor(rng() * 7) : 24 + Math.floor(rng() * 7);
    setPixel(png, ox + x, y, rng() < 0.5 ? BOARD_LIGHT : BOARD_DARK);
  }
}

/** The hallway wall: plaster with a few flecks, a dado rail at rows 14..16, the skirting board. */
function plaster(png) {
  const rng = seeded(800);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) setPixel(png, x, y, PLASTER);
  }
  for (let i = 0; i < 12; i += 1) {
    setPixel(png, Math.floor(rng() * SIZE), Math.floor(rng() * 25), PLASTER_FLECK);
  }
  for (let x = 0; x < SIZE; x += 1) {
    setPixel(png, x, 14, WOOD_LIGHT);
    setPixel(png, x, 15, WOOD_MID);
    setPixel(png, x, 16, WOOD_DARK);
  }
  skirting(png);
}

/**
 * The hallway runner, 416x48: a wine body on rows 2..45 with a 3 px border
 * and a diamond lattice every 16 px, and a thread fringe at each end.
 */
function runner(png) {
  for (let y = 2; y < 46; y += 1) {
    for (let x = 6; x < 410; x += 1) {
      const border = y < 5 || y > 42 || x < 9 || x > 406;
      const d = Math.abs(((x - 9) % 16) - 8) + Math.abs((y % 16) - 8);
      let c = WINE;
      if (border) c = RUNNER_EDGE;
      else if (d === 8) c = WINE_DARK;
      else if (d === 0) c = RUNNER_EDGE;
      setPixel(png, x, y, c);
    }
  }
  for (let y = 6; y < 42; y += 2) {
    fill(png, 0, y, 5, y, RUNNER_EDGE);
    fill(png, 410, y, 415, y, RUNNER_EDGE);
  }
}

/** The hallway's console table, 32x24: a top on rows 0..7, an apron with a drawer, two legs. */
function hallTable(png) {
  fill(png, 1, 0, 30, 0, WOOD_LIGHT);
  fill(png, 1, 1, 30, 6, WOOD_MID);
  fill(png, 1, 7, 30, 7, WOOD_DARK);
  fill(png, 2, 8, 29, 10, WOOD_MID);
  fill(png, 10, 9, 21, 9, WOOD_DARK);
  fill(png, 15, 10, 16, 10, WOOD_LIGHT);
  fill(png, 2, 11, 29, 11, WOOD_DARK);
  fill(png, 3, 12, 4, 23, WOOD_DARK);
  fill(png, 27, 12, 28, 23, WOOD_DARK);
}

export const FLOOR = {
  name: 'spr_floor_hallway',
  width: SIZE * 3,
  height: SIZE,
  draw(png) {
    for (let frame = 0; frame < 3; frame += 1) boards(png, frame * SIZE, frame);
  },
};

export const WALL = { name: 'spr_wall_hallway', width: SIZE, height: SIZE, draw: plaster };

export const HALL_RUNNER = { name: 'spr_runner', width: 416, height: 48, draw: runner };

export const HALL_TABLE = { name: 'spr_hall_table', width: 32, height: 24, draw: hallTable };
