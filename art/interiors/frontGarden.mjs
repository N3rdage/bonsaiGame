// The front garden's sheets.
//
// spr_road.png (64x192): one 2 m slice of the 3 m road, tiled along it: dark
// asphalt with seeded grit, a 40 px dash of the centre line, a gutter and a
// stone kerb along the foot, its joints 32 px apart.
// spr_fence_low.png: the low front fence along the kerb, white pickets on two
// rails in the tile's lower half, transparent above so the lawn shows.
// spr_drive.png: the drive's block paving, 16x8 blocks in staggered courses.
// spr_bed.png: a flower bed, dark soil with two round shrubs and a few flowers.
// spr_roller_door.png (154x32, the garage's 2.4 m door): grey slats under a
// housing, between two dark guides, a handle at the foot.
// spr_gate.png: the side gate, a ledged and braced board gate between two
// posts, a brass latch; drawn over the passage's fence on both sides.

import {
  BRASS,
  BRASS_DARK,
  MOSS,
  MOSS_DARK,
  STONE,
  STONE_DARK,
  STONE_LIGHT,
  WHITEWASH,
  WHITEWASH_DARK,
  WOOD_DARK,
  WOOD_LIGHT,
  WOOD_MID,
} from './palette.mjs';
import { SIZE, fill, seeded, setPixel } from './png.mjs';

const ASPHALT = [58, 60, 62];
const ASPHALT_DARK = [44, 46, 48];
const ASPHALT_LIGHT = [74, 76, 78];
const LINE = [214, 210, 190];
const BLOCK = [120, 104, 92];
const BLOCK_DARK = [90, 76, 66];
const BLOCK_LIGHT = [146, 128, 112];
const SOIL = [84, 60, 42];
const SOIL_DARK = [62, 44, 30];
const SHRUB_LIGHT = [110, 146, 78];
const FLOWERS = [
  [226, 120, 140],
  [240, 210, 110],
  [200, 170, 230],
];
const SLAT = [128, 134, 130];
const SLAT_DARK = [96, 102, 100];
const SLAT_LIGHT = [156, 162, 158];

/** The road's width and height, prototype px: 2 m along it, 3 m across, the kerb's 12 rows at the foot. */
const ROAD_W = 64;
const ROAD_H = 192;
const KERB = 12;

/**
 * Asphalt over the whole slice with seeded light and dark grit, a 40 px dash
 * of the centre line on four rows midway down the asphalt, a dark gutter on
 * the two rows above the kerb, and the kerb: a lit top row, stone, a dark foot
 * and a joint every 32 px.
 */
function road(png) {
  const kerbTop = ROAD_H - KERB;
  fill(png, 0, 0, ROAD_W - 1, kerbTop - 1, ASPHALT);
  const rng = seeded(1500);
  for (let i = 0; i < 160; i += 1) {
    const x = Math.floor(rng() * ROAD_W);
    const y = Math.floor(rng() * (kerbTop - 2));
    setPixel(png, x, y, rng() < 0.5 ? ASPHALT_LIGHT : ASPHALT_DARK);
  }
  const mid = Math.floor(kerbTop / 2);
  fill(png, 12, mid - 2, 51, mid + 1, LINE);
  fill(png, 0, kerbTop - 2, ROAD_W - 1, kerbTop - 1, ASPHALT_DARK);
  for (let y = kerbTop; y < ROAD_H; y += 1) {
    for (let x = 0; x < ROAD_W; x += 1) {
      let c = STONE;
      if (y === kerbTop) c = STONE_LIGHT;
      else if (y >= ROAD_H - 2 || x % 32 === 31) c = STONE_DARK;
      setPixel(png, x, y, c);
    }
  }
}

/**
 * Four whitewashed pickets 4 px wide, 8 px apart, from row 14 to the foot,
 * each with a pointed top and a shaded right column, on rails at rows 19..20
 * and 27..28 that run the tile's width so the tiles join.
 */
function lowFence(png) {
  for (const y of [19, 27]) {
    fill(png, 0, y, SIZE - 1, y, WOOD_LIGHT);
    fill(png, 0, y + 1, SIZE - 1, y + 1, WOOD_MID);
  }
  for (let px = 2; px < SIZE; px += 8) {
    setPixel(png, px + 1, 13, WHITEWASH);
    setPixel(png, px + 2, 13, WHITEWASH);
    fill(png, px, 14, px + 2, SIZE - 2, WHITEWASH);
    fill(png, px + 3, 14, px + 3, SIZE - 2, WHITEWASH_DARK);
    fill(png, px, SIZE - 1, px + 3, SIZE - 1, WHITEWASH_DARK);
  }
}

/** Block paving: 16x8 blocks, each course staggered 8 px, a dark joint on each block's last row and column, a lit first row, seeded flecks. */
function drive(png) {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const bx = (x + (Math.floor(y / 8) % 2) * 8) % 16;
      let c = BLOCK;
      if (y % 8 === 7 || bx === 15) c = BLOCK_DARK;
      else if (y % 8 === 0) c = BLOCK_LIGHT;
      setPixel(png, x, y, c);
    }
  }
  const rng = seeded(1600);
  for (let i = 0; i < 8; i += 1) {
    setPixel(png, Math.floor(rng() * SIZE), Math.floor(rng() * SIZE), BLOCK_DARK);
  }
}

/** Soil with seeded clods, two round shrubs (dark rim, lit top-left) and a few seeded flowers on them. */
function bed(png) {
  fill(png, 0, 0, SIZE - 1, SIZE - 1, SOIL);
  const rng = seeded(1700);
  for (let i = 0; i < 20; i += 1) {
    setPixel(png, Math.floor(rng() * SIZE), Math.floor(rng() * SIZE), SOIL_DARK);
  }
  for (const [cx, cy] of [
    [8, 15],
    [24, 17],
  ]) {
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > 7) continue;
        let c = MOSS;
        if (d > 6) c = MOSS_DARK;
        else if (x < cx - 1 && y < cy - 1) c = SHRUB_LIGHT;
        setPixel(png, x, y, c);
      }
    }
    for (let i = 0; i < 4; i += 1) {
      const fx = cx - 4 + Math.floor(rng() * 9);
      const fy = cy - 4 + Math.floor(rng() * 9);
      setPixel(png, fx, fy, FLOWERS[Math.floor(rng() * FLOWERS.length)]);
    }
  }
}

/** The roller door's width, prototype px. */
const ROLLER_W = 154;

/** Dark guides on the outer 3 columns, a housing on rows 0..4, slats 3 px deep (lit, mid, dark) below it, and a handle at the foot's centre. */
function rollerDoor(png) {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < ROLLER_W; x += 1) {
      let c = y === 4 ? SLAT_DARK : SLAT;
      if (y > 4) c = [SLAT_LIGHT, SLAT, SLAT_DARK][(y - 5) % 3];
      if (x < 3 || x >= ROLLER_W - 3) c = STONE_DARK;
      setPixel(png, x, y, c);
    }
  }
  const hx = ROLLER_W / 2;
  fill(png, hx - 4, SIZE - 4, hx + 3, SIZE - 3, STONE_DARK);
}

/**
 * Two posts on the outer columns, vertical boards between them with dark
 * seams, two ledges across at rows 7..9 and 24..26 and a brace climbing
 * between them, and a brass latch by the right post. The top row is left
 * transparent, so the fence behind shows above the gate.
 */
function gate(png) {
  for (let y = 1; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let c = (x - 4) % 6 === 5 ? WOOD_DARK : WOOD_MID;
      if (x < 4 || x >= SIZE - 4) c = x === 0 || x === SIZE - 1 ? WOOD_DARK : WOOD_LIGHT;
      setPixel(png, x, y, c);
    }
  }
  for (const y of [7, 24]) {
    fill(png, 4, y, SIZE - 5, y, WOOD_LIGHT);
    fill(png, 4, y + 1, SIZE - 5, y + 2, WOOD_MID);
    fill(png, 4, y + 2, SIZE - 5, y + 2, WOOD_DARK);
  }
  for (let y = 10; y < 24; y += 1) {
    const x = 4 + Math.floor(((24 - y) * (SIZE - 9)) / 14);
    fill(png, x, y, Math.min(x + 2, SIZE - 5), y, WOOD_LIGHT);
  }
  fill(png, SIZE - 7, 14, SIZE - 5, 15, BRASS);
  setPixel(png, SIZE - 7, 16, BRASS_DARK);
}

export const ROAD = { name: 'spr_road', width: ROAD_W, height: ROAD_H, draw: road };
export const FENCE_LOW = { name: 'spr_fence_low', width: SIZE, height: SIZE, draw: lowFence };
export const DRIVE = { name: 'spr_drive', width: SIZE, height: SIZE, draw: drive };
export const BED = { name: 'spr_bed', width: SIZE, height: SIZE, draw: bed };
export const ROLLER_DOOR = {
  name: 'spr_roller_door',
  width: ROLLER_W,
  height: SIZE,
  draw: rollerDoor,
};
export const GATE = { name: 'spr_gate', width: SIZE, height: SIZE, draw: gate };
