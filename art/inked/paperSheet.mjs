/* eslint-disable no-console -- reports the sheet `npm run art:paper` writes. */
// The Inked rooms' paper (art/inked/README.md), written to
// public/assets/spr_paper.png: the page washed all over in `surroundWash`, so
// the surround outside a room's walls is dark and frames the room, with the
// shared grain laid by `finish`. The wash box runs well past the page on every
// side, unedged and unworn, so no pooled rim, bleed or off-register edge
// lands inside it. 64 logical px square, which is 256 art px, exactly one
// GRAIN_PERIOD (paper.mjs): the grain and the wash's granulation both tile
// every 256 art px, so the sheet's right edge continues into its left and its
// bottom into its top, and the world lays it from (0, 0) in 64 px steps with
// no seam. Its origin is (0, 0), the start of a period, so each tile is the
// grain the world position it lands on samples. Everything in it is seeded or
// hashed: a rerun reproduces the PNG byte for byte.

import { join } from 'node:path';

import { writePng } from './canvas.mjs';
import { createPage, finish } from './index.mjs';

const OUT = join(import.meta.dirname, '..', '..', 'public', 'assets', 'spr_paper.png');
/** One grain period, in logical px. */
const SIZE = 64;
/** The page's seed, written out. */
const SEED = 0x9a9e;
/** How far the wash box runs past the page on each side, logical px. */
const OVERSIZE = 16;

const page = createPage(SIZE, SIZE, { seed: SEED, origin: [0, 0] });
page.k.box(-OVERSIZE, -OVERSIZE, SIZE + 2 * OVERSIZE, SIZE + 2 * OVERSIZE, 'surroundWash', {
  edges: false,
  wear: false,
});
const canvas = finish(page);
writePng(OUT, canvas);
console.log(`public/assets/spr_paper.png  ${String(canvas.width)}x${String(canvas.height)}`);
