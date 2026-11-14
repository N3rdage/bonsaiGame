// The buildings' roofs, seen from the garden.
//
// spr_roof.png (32x32): slate shingles in staggered 8x4 courses, seamless,
// which the garden tiles over the house's and the shed's footprints.

import { SIZE, seeded, setPixel } from './png.mjs';

const SHINGLE = [74, 62, 56];
const SHINGLE_DARK = [48, 40, 36];
const SHINGLE_LIGHT = [100, 86, 76];
const SHINGLE_MOSS = [70, 78, 52];

/**
 * Courses 4 px deep, each shingle 8 px wide and offset 4 px from the course
 * above: a lit top row, a dark bottom row and a dark right edge, with a few
 * seeded mossy pixels. 32 is a whole number of shingles and of course pairs,
 * so the tile repeats without a seam.
 */
function roof(png) {
  for (let y = 0; y < SIZE; y += 1) {
    const course = Math.floor(y / 4);
    for (let x = 0; x < SIZE; x += 1) {
      const bx = (x + (course % 2) * 4) % 8;
      let c = SHINGLE;
      if (y % 4 === 3 || bx === 7) c = SHINGLE_DARK;
      else if (y % 4 === 0) c = SHINGLE_LIGHT;
      setPixel(png, x, y, c);
    }
  }
  const rng = seeded(1400);
  for (let i = 0; i < 6; i += 1) {
    const x = Math.floor(rng() * SIZE);
    const y = Math.floor(rng() * (SIZE / 4)) * 4 + 1 + Math.floor(rng() * 2);
    setPixel(png, x, y, SHINGLE_MOSS);
  }
}

export const ROOF = {
  name: 'spr_roof',
  width: SIZE,
  height: SIZE,
  draw: roof,
};
