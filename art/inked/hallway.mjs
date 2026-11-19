// The hallway, drawn in Inked (art/inked/README.md) at the scale rule's
// heights and written to public/assets/, sizes in logical px:
//   spr_floor_hallway   3 variants of a 16 x 16 floorboard tile, the boards
//                       running north-south, scattered by the floor's hash
//                       (src/world/assets.ts's `floorFrame`)
//   spr_wall_hallway    3 variants of the back wall's face, plaster over a
//                       dado rail and tongue-and-groove panelling, 16 x 48
//                       (2.4 m), its bottom edge on the floor line
//   spr_hallway_cap     3 variants of the south wall's 8 px cap, 16 wide
//   spr_hallway_cap_v   3 variants of the side walls' 8 px cap, 16 tall
//   spr_runner          the runner along the bottom wall, 60 x 24, flat on
//                       the floor, cut out
//   spr_hall_table      the console table, 16 x 28 (0.5 x 0.375 x 0.75 m), cut out
// Furniture draws as its front face (real height x 21.33 px/m) over its
// footprint's depth, standing on the frame's bottom edge, where the world
// anchors it on its footprint's bottom edge (src/world/roomArt.ts).
//
// A repeated tile has three variants, each on its own page and seed, joined
// into one strip. Every page has its own seed in SEEDS, written out, and its
// origin where it lands in the hallway (a tile's where its run starts).
// Everything is seeded: a rerun reproduces the PNGs byte for byte.

import {
  FINE,
  JOINT,
  MARK,
  OUTLINE,
  SEAM,
  capTile,
  faceBands,
  rect,
  seg,
  variants,
  writeSheets,
} from './house.mjs';
import { createPage, finish, finishCutOut } from './index.mjs';

/** One seed per page, written out so adding a page never moves another's. */
const SEEDS = {
  floor: [0x7b00, 0x7b01, 0x7b02],
  wall: [0x7b10, 0x7b11, 0x7b12],
  cap: [0x7b20, 0x7b21, 0x7b22],
  capV: [0x7b30, 0x7b31, 0x7b32],
  runner: 0x7b40,
  hallTable: 0x7b41,
};

// The floor: four boards to a tile running north-south, each seam drawn at
// the right of its board (x 3.5, 7.5, 11.5, 15.5), thin, so a tile owns its
// right seam. Per variant: the boards' end joints (board, y) and a grain
// streak (board, y, length); on one variant in three a nail pair and a scuff
// where the front door's traffic wears it.
const FLOOR_VARIANTS = [
  {
    joints: [[1, 10]],
    grain: [
      [0, 3, 7],
      [3, 8, 6],
    ],
    nails: [[2, 2]],
    scuff: [6, 12],
  },
  {
    joints: [[3, 5]],
    grain: [[2, 1, 8]],
    nails: [],
    scuff: null,
  },
  {
    joints: [],
    grain: [
      [1, 6, 5],
      [2, 11, 4],
    ],
    nails: [],
    scuff: null,
  },
];

function floorTile(i) {
  const page = createPage(16, 16, { seed: SEEDS.floor[i], origin: [192, 144] });
  const { k } = page;
  const v = FLOOR_VARIANTS[i];
  k.box(-1, -1, 18, 18, 'floor', { edges: false });
  for (const x of [3.5, 7.5, 11.5, 15.5]) seg(k, x, -1, x, 17, JOINT);
  for (const [board, y] of v.joints) seg(k, board * 4 - 0.5, y, board * 4 + 3.5, y, JOINT);
  for (const [board, y, len] of v.grain) seg(k, board * 4 + 1.6, y, board * 4 + 1.8, y + len, 0.8);
  for (const [board, y] of v.nails) {
    seg(k, board * 4 + 1.2, y, board * 4 + 1.5, y + 0.2, MARK);
    seg(k, board * 4 + 2.4, y, board * 4 + 2.7, y + 0.2, MARK);
  }
  if (v.scuff) {
    const [sx, sy] = v.scuff;
    k.hatchIn(rect(sx - 2, sy - 1, 4, 2), FINE);
  }
  return finish(page);
}

// The back wall's face: plaster (y 3.5..27), a dado rail (y 27..29.5) and
// painted tongue-and-groove below it to the skirting, its boards 4 px wide.
// The plaster and boards stay calm: on one variant in three a hairline crack
// in the plaster.
const WALL_CRACKS = [
  [
    [5, 8],
    [6.4, 12],
    [5.6, 15],
  ],
  null,
  null,
];

function wallTile(i) {
  const page = createPage(16, 48, { seed: SEEDS.wall[i], origin: [192, 96] });
  const { k } = page;
  const crack = WALL_CRACKS[i];
  k.box(-1, 3.5, 18, 24, 'wall', { edges: false });
  if (crack) k.line(crack, 1);
  k.box(-1, 29.5, 18, 14, 'paint', { edges: false });
  for (const x of [3.5, 7.5, 11.5, 15.5]) seg(k, x, 29.5, x, 43, JOINT);
  k.box(-1, 27, 18, 2.5, 'wood', { edges: false });
  seg(k, -1, 27, 17, 27, OUTLINE);
  seg(k, -1, 29.5, 17, 29.5, OUTLINE);
  faceBands(k);
  return finish(page);
}

/** Where each cap variant's crack runs, along its 16 px. */
const CAP_CRACKS = [10, 5, 13];

// The runner, 1.9 x 0.75 m, flat on the boards: a green field inside a cream
// border band with a small lozenge pattern down its middle, fringe at both
// short ends.
function runner() {
  const page = createPage(60, 24, { seed: SEEDS.runner, origin: [200, 184] });
  const { k } = page;
  k.box(3, 1.5, 54, 21, 'runner');
  k.box(6, 4.5, 48, 15, 'cream', { width: SEAM, wear: false });
  k.box(8, 6.5, 44, 11, 'runner', { width: SEAM });
  for (let x = 12; x < 52; x += 8) {
    k.shape(
      [
        [x, 12],
        [x + 2.4, 9.6],
        [x + 4.8, 12],
        [x + 2.4, 14.4],
      ],
      'cream',
      { width: MARK, wear: false },
    );
  }
  for (let y = 3; y < 22; y += 2.5) {
    seg(k, 0.8, y, 3, y, MARK);
    seg(k, 57, y, 59.2, y, MARK);
  }
  return finishCutOut(page);
}

// The console table, 0.5 x 0.375 m and 0.75 m high: its top (y 0..12) with a
// bowl for keys, an apron with a drawer, two slender legs and the space
// under it in shadow.
function hallTable() {
  const page = createPage(16, 28, { seed: SEEDS.hallTable, origin: [266, 180] });
  const { k } = page;
  k.box(3, 16, 10, 11.4, 'shadow', { edges: false, hatching: 'shadow', wear: false });
  for (const x of [1.2, 13]) k.box(x, 14, 1.8, 13.6, 'wood', { width: SEAM });
  k.box(0.6, 0.8, 14.8, 11.4, 'wood');
  k.blob(5.4, 5.6, 2.8, 1.8, 'terracotta', { width: MARK });
  seg(k, 10.2, 4.4, 12.4, 6.2, MARK);
  k.box(0.6, 12, 14.8, 3.4, 'wood', { width: SEAM });
  seg(k, 7, 13.7, 9, 13.7, MARK);
  return finishCutOut(page);
}

writeSheets([
  ['spr_floor_hallway', () => variants(floorTile)],
  ['spr_wall_hallway', () => variants(wallTile)],
  [
    'spr_hallway_cap',
    () => variants((i) => capTile(SEEDS.cap[i], false, [184, 208], CAP_CRACKS[i])),
  ],
  [
    'spr_hallway_cap_v',
    () => variants((i) => capTile(SEEDS.capV[i], true, [184, 96], CAP_CRACKS[i])),
  ],
  ['spr_runner', runner],
  ['spr_hall_table', hallTable],
]);
