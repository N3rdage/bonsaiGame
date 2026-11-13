// The drawing primitives every interiors module shares: the tile size, a
// seeded generator, pixel and rectangle fills, and `write`, which draws one
// sheet into a fresh PNG and saves it to public/assets/.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';

const { PNG } = pngjs;

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'assets');
export const SIZE = 32;

/** mulberry32: a small seeded generator, uniform in [0, 1). */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function setPixel(png, x, y, [r, g, b]) {
  const i = (y * png.width + x) * 4;
  png.data[i] = r;
  png.data[i + 1] = g;
  png.data[i + 2] = b;
  png.data[i + 3] = 255;
}

/** Fills columns x0..x1 of rows y0..y1, inclusive, with `c`. */
export function fill(png, x0, y0, x1, y1, c) {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) setPixel(png, x, y, c);
  }
}

/** Draws `sheet` ({ name, width, height, draw(png) }) into a new PNG and writes it to public/assets/<name>.png. */
export function write({ name, width, height, draw }) {
  const png = new PNG({ width, height });
  draw(png);
  writeFileSync(join(OUT, `${name}.png`), PNG.sync.write(png));
  console.log(`${name}.png  ${String(png.width)}x${String(png.height)}`);
}
