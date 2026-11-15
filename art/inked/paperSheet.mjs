/* eslint-disable no-console -- reports the sheet `npm run art:paper` writes. */
// The Inked rooms' paper (art/inked/README.md), written to
// public/assets/spr_paper.png: a blank page, nothing drawn on it, so it is the
// paper colour with the shared grain laid by `finish`. 64 logical px square,
// which is 256 art px, exactly one GRAIN_PERIOD (paper.mjs): the grain tiles
// every 256 art px, so the sheet's right edge continues into its left and its
// bottom into its top, and the world lays it from (0, 0) in 64 px steps with
// no seam. Its origin is (0, 0), the start of a period, so each tile is the
// grain the world position it lands on samples. Nothing in it is random: a
// rerun reproduces the PNG byte for byte.

import { join } from 'node:path';

import { writePng } from './canvas.mjs';
import { createPage, finish } from './index.mjs';

const OUT = join(import.meta.dirname, '..', '..', 'public', 'assets', 'spr_paper.png');
/** One grain period, in logical px. */
const SIZE = 64;
/** The page's seed, written out; a blank page draws nothing, so it moves no pixel. */
const SEED = 0x9a9e;

const canvas = finish(createPage(SIZE, SIZE, { seed: SEED, origin: [0, 0] }));
writePng(OUT, canvas);
console.log(`public/assets/spr_paper.png  ${String(canvas.width)}x${String(canvas.height)}`);
