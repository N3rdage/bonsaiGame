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
// spr_window.png: one 32x32 frame, a four-pane window with a sill, transparent
// round it so it can be drawn over any room's top wall.
// The house furniture, each one frame at its exact size, transparent where the
// floor shows through: spr_fireplace.png (64x48, a stone surround under a
// wooden mantel, a fire in its box, a hearth) and spr_side_table.png (32x32, a
// small table with a lower shelf) for the lounge; spr_desk.png (64x32, drawers
// on the left, papers on the right) and spr_bookshelf.png (32x32, one bay of a
// low bookcase that repeats along a run) for the study; spr_runner.png
// (416x48, a fringed wine runner) and spr_hall_table.png (32x24, a console
// table) for the hallway.
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
const GLASS = [104, 136, 146];
const GLASS_LIGHT = [150, 182, 184];
const GLASS_DARK = [78, 104, 116];
const STONE = [128, 118, 106];
const STONE_DARK = [92, 84, 76];
const STONE_LIGHT = [156, 146, 132];
const SOOT = [28, 22, 20];
const FLAME = [226, 120, 40];
const FLAME_LIGHT = [250, 200, 90];
const BOOKS = [
  [120, 40, 34],
  [52, 78, 62],
  [58, 64, 104],
  [150, 120, 70],
  [96, 58, 80],
];
const WINE = [104, 30, 36];
const WINE_DARK = [76, 20, 26];

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

/**
 * The window, drawn over a top wall tile: transparent round it, so the room's
 * own wall (and its skirting board) shows at the edges. A dark-edged wooden
 * frame, four panes of glass split by a mullion and a transom, lighter towards
 * the top with a diagonal glint, and a sill across the bottom.
 */
function windowPane(png) {
  for (let y = 2; y <= 21; y += 1) {
    for (let x = 3; x <= 28; x += 1) {
      let c = WOOD_MID;
      if (x === 3 || x === 28 || y === 2) c = WOOD_DARK;
      else if (x >= 6 && x <= 25 && y >= 5 && y <= 21 && x !== 15 && x !== 16 && y !== 12 && y !== 13) {
        c = y < 9 ? GLASS_LIGHT : GLASS;
        if ((x + y) % 11 === 0 || (x + y) % 11 === 1) c = GLASS_LIGHT;
        if (y >= 19) c = GLASS_DARK;
      }
      setPixel(png, x, y, c);
    }
  }
  const rng = seeded(1000);
  for (let i = 0; i < 6; i += 1) {
    setPixel(png, 6 + Math.floor(rng() * 9), 14 + Math.floor(rng() * 5), GLASS_LIGHT);
  }
  for (let x = 2; x <= 29; x += 1) {
    setPixel(png, x, 22, WOOD_LIGHT);
    setPixel(png, x, 23, WOOD_DARK);
  }
}

/** Fills columns x0..x1 of rows y0..y1, inclusive, with `c`. */
function fill(png, x0, y0, x1, y1, c) {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) setPixel(png, x, y, c);
  }
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
  for (let x = 2; x < 30; ) {
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

const windowPng = new PNG({ width: SIZE, height: SIZE });
windowPane(windowPng);
write('spr_window', windowPng);

for (const [name, draw, width, height] of [
  ['spr_fireplace', fireplace, 64, 48],
  ['spr_side_table', sideTable, 32, 32],
  ['spr_desk', desk, 64, 32],
  ['spr_bookshelf', bookshelf, 32, 32],
  ['spr_runner', runner, 416, 48],
  ['spr_hall_table', hallTable, 32, 24],
]) {
  const png = new PNG({ width, height });
  draw(png);
  write(name, png);
}
