// The study, drawn in Inked (art/inked/README.md) at the scale rule's heights
// and written to public/assets/, sizes in logical px:
//   spr_floor_study     3 variants of a 16 x 16 tile of basket-weave parquet,
//                       scattered by the floor's hash (src/world/assets.ts's
//                       `floorFrame`)
//   spr_wall_study      3 variants of the back wall's face, paper over a rail
//                       and raised painted panels, 16 x 48 (2.4 m), its bottom
//                       edge on the floor line
//   spr_study_cap       3 variants of the south wall's 8 px cap, 16 wide
//   spr_study_cap_v     3 variants of the side walls' 8 px cap, 16 tall
//   spr_study_window    a window on the face under a half-drawn blind, 32 x 24,
//                       cut out
//   spr_desk            32 x 32 (1.0 x 0.5 x 0.75 m), cut out
//   spr_bookshelf       the low bookcase, 48 x 28 (1.5 x 0.5 x 0.6 m), three
//                       bays of books under its top, cut out
// Furniture draws as its front face (real height x 21.33 px/m) over its
// footprint's depth, each standing on the frame's bottom edge, where the world
// anchors it on its footprint's bottom edge (src/world/roomArt.ts).
//
// A repeated tile has three variants, each on its own page and seed, joined
// into one strip. Every page has its own seed in SEEDS, written out, and its
// origin where it lands in the study (a tile's where its run starts).
// Everything is seeded: a rerun reproduces the PNGs byte for byte.

import {
  JOINT,
  MARK,
  OUTLINE,
  SEAM,
  capTile,
  faceBands,
  faceWindow,
  seg,
  variants,
  writeSheets,
} from './house.mjs';
import { createPage, finish, finishCutOut } from './index.mjs';

/** One seed per page, written out so adding a page never moves another's. */
const SEEDS = {
  floor: [0x7c00, 0x7c01, 0x7c02],
  wall: [0x7c10, 0x7c11, 0x7c12],
  cap: [0x7c20, 0x7c21, 0x7c22],
  capV: [0x7c30, 0x7c31, 0x7c32],
  window: 0x7c40,
  desk: 0x7c50,
  bookshelf: 0x7c51,
};

// The parquet: four 8 px squares to a tile, each two blocks wide, the
// blocks east-west in the top-left and bottom-right squares and north-south
// in the others, so the weave runs on across tiles. Each square's edge is
// drawn at its bottom and right; every line is thin, the blocks' finest, so
// the floor stays calm. On one variant in three, a block's grain streak.
const PARQUET_GRAIN = [[2, 3.4, 4], null, null];

function parquetTile(i) {
  const page = createPage(16, 16, { seed: SEEDS.floor[i], origin: [160, 64] });
  const { k } = page;
  const grain = PARQUET_GRAIN[i];
  k.box(-1, -1, 18, 18, 'parquet', { edges: false });
  for (const [qx, qy] of [
    [0, 0],
    [8, 8],
  ]) {
    seg(k, qx, qy + 3.9, qx + 7.75, qy + 3.9, 0.6);
  }
  for (const [qx, qy] of [
    [8, 0],
    [0, 8],
  ]) {
    seg(k, qx + 3.9, qy, qx + 3.9, qy + 7.75, 0.6);
  }
  for (const at of [7.75, 15.75]) {
    seg(k, -1, at, 17, at, JOINT);
    seg(k, at, -1, at, 17, JOINT);
  }
  if (grain) {
    const [gx, gy, len] = grain;
    seg(k, gx, gy, gx + len, gy + 0.2, 0.6);
  }
  return finish(page);
}

// The back wall's face: plain paper (y 3.5..22), a wooden rail (y 22..24.5)
// and painted panelling below, one raised panel to a tile. On one variant in
// three, a nail hole left in the paper.
const WALL_VARIANTS = [{ hole: [5, 14] }, { hole: null }, { hole: null }];

function wallTile(i) {
  const page = createPage(16, 48, { seed: SEEDS.wall[i], origin: [160, 16] });
  const { k } = page;
  const v = WALL_VARIANTS[i];
  k.box(-1, 3.5, 18, 19, 'studyPaper', { edges: false });
  if (v.hole) k.blob(v.hole[0], v.hole[1], 0.5, 0.5, 'shadow', { width: 1 });
  k.box(-1, 24.5, 18, 18.5, 'paint', { edges: false });
  k.box(2.4, 27, 11.2, 13.6, 'paint', { width: JOINT });
  seg(k, 15.5, 24.5, 15.5, 43, JOINT);
  k.box(-1, 22, 18, 2.5, 'wood', { edges: false, wear: false });
  seg(k, -1, 22, 17, 22, OUTLINE);
  seg(k, -1, 24.5, 17, 24.5, OUTLINE);
  faceBands(k);
  return finish(page);
}

/** Where each cap variant's crack runs, along its 16 px. */
const CAP_CRACKS = [12, 6, 3];

// The window: the face's window with a cream roller blind half down over it,
// its lath and cord.
function studyWindow() {
  const page = createPage(32, 24, { seed: SEEDS.window, origin: [208, 20] });
  const { k } = page;
  faceWindow(k, 3, 26);
  k.box(4.6, 2.6, 22.8, 6.4, 'cream', { width: SEAM, wear: false });
  k.box(4.2, 8.6, 23.6, 1.4, 'wood', { width: MARK });
  seg(k, 16, 10, 16, 14, 1);
  k.blob(16, 14.6, 0.7, 0.7, 'brass', { width: 1 });
  return finishCutOut(page);
}

// The desk, 1.0 x 0.5 m and 0.75 m high: its top (y 0..16) with a lamp at the
// back left, a sheaf of papers and an ink bottle to the right, the middle
// front clear for a tree; its front (y 16..32) two pedestals of drawers
// either side of the kneehole in shadow.
function desk() {
  const page = createPage(32, 32, { seed: SEEDS.desk, origin: [160, 48] });
  const { k } = page;
  k.box(11, 18, 10, 13.6, 'shadow', { edges: false, hatching: 'shadow', wear: false });
  for (const x of [1, 21]) {
    k.box(x, 18, 10, 13.6, 'wood');
    for (const y of [22.6, 27.2]) seg(k, x + 0.4, y, x + 9.6, y, MARK);
    for (const y of [20.3, 24.9, 29.4]) k.blob(x + 5, y, 0.7, 0.6, 'brass', { width: 1 });
  }
  k.box(0.6, 0.8, 30.8, 15.4, 'wood');
  seg(k, 0.8, 8.4, 31.2, 8.4, JOINT);
  k.blob(5, 6.4, 2.2, 1.2, 'brass', { width: MARK });
  seg(k, 5, 5.4, 5.4, 3.6, MARK);
  k.shape(
    [
      [3, 1.2],
      [7.6, 1.2],
      [8.6, 4],
      [2, 4],
    ],
    'lamp',
    { width: MARK, wear: false },
  );
  k.box(21.5, 2.4, 7, 5.4, 'cream', { width: MARK, wear: false });
  for (const y of [4, 5.6]) seg(k, 22.6, y, 27.2, y, 1);
  k.blob(27.6, 11, 1.2, 1.2, 'shirt', { width: MARK });
  k.box(0.6, 16, 30.8, 2.4, 'top', { width: SEAM });
  return finishCutOut(page);
}

/** The books in a bay: each its left x, width, height above the shelf and wash, the shelf at y 26.6. */
const BAYS = [
  [
    [2.4, 2.2, 7.6, 'rug'],
    [4.6, 1.8, 8.2, 'shirt'],
    [6.4, 2.4, 7, 'foliage'],
    [8.8, 1.8, 8, 'cream'],
    [11, 2.8, 6.4, 'brass'],
  ],
  [
    [17.6, 2.4, 8, 'foliage'],
    [20, 1.8, 7.4, 'rug'],
    [21.8, 2, 8.4, 'cream'],
    [24.4, 2.6, 7, 'shirt'],
    [27, 1.8, 7.8, 'rug'],
  ],
  [
    [33.6, 2, 7.6, 'shirt'],
    [35.6, 2.6, 8.2, 'brass'],
    [38.2, 1.8, 7.2, 'rug'],
    [40, 2.2, 8, 'foliage'],
    [43.2, 2.2, 6.6, 'cream'],
  ],
];

// The low bookcase, 1.5 x 0.5 m and 0.6 m high: its top (y 0..16), a stack
// of books lying on its left bay and its right bay clear for a tree; its
// front (y 16..28) the carcass round three bays of books.
function bookshelf() {
  const page = createPage(48, 28, { seed: SEEDS.bookshelf, origin: [256, 52] });
  const { k } = page;
  k.box(0.6, 16, 46.8, 11.6, 'wood');
  for (const x0 of [2, 17, 33]) {
    k.box(x0, 17.8, 13, 8.8, 'shadow', { width: MARK, hatching: 'shadow', wear: false });
  }
  for (const bay of BAYS) {
    for (const [x, w, h, wash] of bay) k.box(x, 26.6 - h, w, h, wash, { width: 1.2, wear: false });
  }
  k.box(0.6, 0.8, 46.8, 15.4, 'wood');
  seg(k, 0.8, 8.4, 47.2, 8.4, JOINT);
  k.box(4, 7, 10, 2.6, 'rug', { width: MARK, wear: false });
  k.box(4.8, 4.6, 8.6, 2.4, 'shirt', { width: MARK, wear: false });
  k.box(0, 15.6, 48, 2.2, 'top', { width: SEAM });
  return finishCutOut(page);
}

writeSheets([
  ['spr_floor_study', () => variants(parquetTile)],
  ['spr_wall_study', () => variants(wallTile)],
  ['spr_study_cap', () => variants((i) => capTile(SEEDS.cap[i], false, [152, 208], CAP_CRACKS[i]))],
  [
    'spr_study_cap_v',
    () => variants((i) => capTile(SEEDS.capV[i], true, [152, 16], CAP_CRACKS[i])),
  ],
  ['spr_study_window', studyWindow],
  ['spr_desk', desk],
  ['spr_bookshelf', bookshelf],
]);
