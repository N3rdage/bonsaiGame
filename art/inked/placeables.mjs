// The furniture the player places in the greenhouse, drawn in Inked
// (art/inked/README.md) at the scale rule's heights and written to
// public/assets/, sizes in logical px, both cut out:
//   spr_pedestal     16 x 28: a 0.6 m wooden stand on a 16 x 16 footprint,
//                    12.8 px of front face (rounded to 12) under a 16 px top
//   spr_floor_shelf  32 x 24: a 0.4 m low wooden shelf on a 32 x 16
//                    footprint, two spots side by side, 8.5 px of front face
//                    (rounded to 8) under a 16 px top
// Each stands on its frame's bottom edge, where the world anchors it on its
// footprint's bottom edge (src/world/roomArt.ts). A displayed tree stands on
// its spot's top edge, the footprint's top, 16 px above the frame's bottom:
// the pedestal's at y 12 and the shelf's at y 8, both on the top face, which
// is kept clear for it.
//
// Every page has its own seed in SEEDS, written out, and its origin where it
// stands in the greenhouse's browser test. Everything is seeded: a rerun
// reproduces the PNGs byte for byte.

import { MARK, SEAM, rect, seg, writeSheets } from './house.mjs';
import { createPage, finishCutOut } from './index.mjs';

/** One seed per page, written out so adding a page never moves another's. */
const SEEDS = {
  pedestal: 0x8f00,
  floorShelf: 0x8f01,
};

// The pedestal: a square top board (y 0..16) with its grain, its edge
// (y 15.6..18), then a post narrower than the top over a wider foot, the
// shadow under the top hatched on the post.
function pedestal() {
  const page = createPage(16, 28, { seed: SEEDS.pedestal, origin: [240, 116] });
  const { k } = page;
  k.box(1.4, 25, 13.2, 2.6, 'wood', { width: SEAM });
  k.box(3.6, 18, 8.8, 7.2, 'wood', { width: SEAM, hatching: rect(3.6, 18, 8.8, 2.4) });
  seg(k, 8, 19, 8, 24.6, MARK);
  k.box(0.6, 0.8, 14.8, 15, 'top');
  seg(k, 3, 5, 10, 5.3, 1);
  seg(k, 6, 9.6, 13, 9.4, 1);
  k.box(0.6, 15.6, 14.8, 2.6, 'wood', { width: SEAM });
  return finishCutOut(page);
}

// The floor shelf: a top of two boards (y 0..16) running east-west, its edge
// (y 15.6..18.2), and under it legs at the ends and the middle with a bottom
// board in the shade between them.
function floorShelf() {
  const page = createPage(32, 24, { seed: SEEDS.floorShelf, origin: [288, 120] });
  const { k } = page;
  k.box(1.6, 18.2, 28.8, 5.2, 'shadow', { edges: false, hatching: 'shadow', wear: false });
  k.box(2.4, 20.4, 27.2, 2.2, 'wood', { width: MARK });
  for (const x of [0.8, 14.8, 28.8]) k.box(x, 17.6, 2.4, 6, 'wood', { width: SEAM });
  k.box(0.6, 0.8, 30.8, 15, 'top');
  seg(k, 0.8, 8.4, 31.2, 8.4, MARK);
  seg(k, 4, 4.4, 12, 4.6, 1);
  seg(k, 19, 12.2, 27, 12, 1);
  k.box(0.6, 15.6, 30.8, 2.6, 'wood', { width: SEAM });
  return finishCutOut(page);
}

writeSheets([
  ['spr_pedestal', pedestal],
  ['spr_floor_shelf', floorShelf],
]);
