// Draws the lounge's placeholder tiles (no prototype art exists for interiors).
//
// spr_floor_lounge.png: three 32x32 frames of warm carpet, a diamond weave
// that repeats every 8 px so tiles meet seamlessly, each frame with its own
// scatter of flecks. spr_wall_lounge.png: one 32x32 frame of striped
// wallpaper over a wooden skirting board. Hard pixel edges, a small palette
// in the family of art/pixel.py's wood tones, and a seeded generator, so a
// rerun reproduces the committed bytes.
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
  for (let x = 0; x < SIZE; x += 1) {
    setPixel(png, x, 26, WOOD_LIGHT);
    for (let y = 27; y < 31; y += 1) setPixel(png, x, y, WOOD_MID);
    setPixel(png, x, 31, WOOD_DARK);
  }
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
