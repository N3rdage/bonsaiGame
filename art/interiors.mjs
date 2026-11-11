// Draws the house rooms' placeholder tiles (no prototype art exists for
// interiors).
//
// spr_floor_lounge.png: three 32x32 frames of warm carpet, a diamond weave
// that repeats every 8 px so tiles meet seamlessly, each frame with its own
// scatter of flecks. spr_wall_lounge.png: one 32x32 frame of striped
// wallpaper over a wooden skirting board.
// spr_floor_hallway.png: three frames of dark floorboards, 8 px planks with
// staggered joints, a green runner stripe across the middle of each tile so
// the tiles of a row join into one long horizontal runner. spr_wall_hallway.png: plain plaster over a
// dado rail and a skirting board.
// spr_floor_study.png: three frames of deep-red herringbone parquet that
// repeats every 16 px. spr_wall_study.png: dark wooden panelling, a raised
// panel per half tile, over a skirting board.
// Hard pixel edges, a small palette in the family of art/pixel.py's wood
// tones, and a seeded generator per frame, so a rerun reproduces the
// committed bytes.
//
// Run with `npm run art:interiors`; the output is committed.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';

const { PNG } = pngjs;

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');
const SIZE = 32;

const CARPET = [110, 58, 48];
const CARPET_DARK = [86, 44, 38];
const CARPET_LIGHT = [140, 82, 62];
const PAPER = [150, 128, 100];
const PAPER_STRIPE = [138, 116, 90];
const PAPER_FLECK = [162, 140, 110];
const WOOD_MID = [120, 85, 55];
const WOOD_DARK = [70, 45, 25];
const WOOD_LIGHT = [160, 110, 70];
const BOARD = [74, 52, 36];
const BOARD_DARK = [52, 36, 25];
const BOARD_LIGHT = [92, 66, 46];
const RUNNER = [64, 82, 70];
const RUNNER_EDGE = [150, 128, 84];
const PLASTER = [176, 160, 132];
const PLASTER_FLECK = [164, 148, 120];
const PARQUET = [112, 40, 34];
const PARQUET_DARK = [80, 26, 24];
const PARQUET_LIGHT = [136, 56, 44];
const PANEL = [88, 58, 38];
const PANEL_DARK = [58, 37, 24];
const PANEL_LIGHT = [112, 76, 50];

/** mulberry32: a small seeded generator, uniform in [0, 1). */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setPixel(png, x, y, [r, g, b]) {
  const i = (y * png.width + x) * 4;
  png.data[i] = r;
  png.data[i + 1] = g;
  png.data[i + 2] = b;
  png.data[i + 3] = 255;
}

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

/** The skirting board on the bottom 6 rows, shared by every wall. */
function skirting(png) {
  for (let x = 0; x < SIZE; x += 1) {
    setPixel(png, x, 26, WOOD_LIGHT);
    for (let y = 27; y < 31; y += 1) setPixel(png, x, y, WOOD_MID);
    setPixel(png, x, 31, WOOD_DARK);
  }
}

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

function write(name, png) {
  writeFileSync(join(OUT, `${name}.png`), PNG.sync.write(png));
  console.log(`${name}.png  ${String(png.width)}x${String(png.height)}`);
}

const floor = new PNG({ width: SIZE * 3, height: SIZE });
for (let frame = 0; frame < 3; frame += 1) carpet(floor, frame * SIZE, frame);
write('spr_floor_lounge', floor);

const wallPng = new PNG({ width: SIZE, height: SIZE });
wall(wallPng);
write('spr_wall_lounge', wallPng);

const hallwayFloor = new PNG({ width: SIZE * 3, height: SIZE });
for (let frame = 0; frame < 3; frame += 1) boards(hallwayFloor, frame * SIZE, frame);
write('spr_floor_hallway', hallwayFloor);

const hallwayWall = new PNG({ width: SIZE, height: SIZE });
plaster(hallwayWall);
write('spr_wall_hallway', hallwayWall);

const studyFloor = new PNG({ width: SIZE * 3, height: SIZE });
for (let frame = 0; frame < 3; frame += 1) parquet(studyFloor, frame * SIZE, frame);
write('spr_floor_study', studyFloor);

const studyWall = new PNG({ width: SIZE, height: SIZE });
panelling(studyWall);
write('spr_wall_study', studyWall);
