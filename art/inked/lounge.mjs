// The lounge-kitchen, drawn in Inked (art/inked/README.md) at the scale
// rule's heights and written to public/assets/, sizes in logical px:
//   spr_floor_lounge    3 variants of a 16 x 16 carpet tile, scattered by the
//                       floor's hash (src/world/assets.ts's `floorFrame`)
//   spr_floor_kitchen   3 variants of a 16 x 16 tile of four quarry tiles,
//                       laid over the kitchen's floor
//   spr_wall_lounge     3 variants of the back wall's face, striped wallpaper
//                       between a cornice and a skirting, 16 x 48 (2.4 m), its
//                       bottom edge on the floor line
//   spr_lounge_cap      3 variants of the south wall's 8 px cap, 16 wide, the
//                       hallway block's south edge too
//   spr_lounge_cap_v    3 variants of the side walls' 8 px cap, 16 tall, the
//                       hallway block's west edge too
//   spr_lounge_window   a window on the face between curtains, 32 x 24, cut out
//   spr_fireplace       32 x 44 (1.0 x 0.75 x 0.9 m), the mantel shelf its top
//                       face, the surround and the fire its front, cut out
//   spr_side_table      16 x 24 (0.5 x 0.5 x 0.4 m), cut out
//   spr_counter         the kitchen counter along the south wall, 96 x 40
//                       (3.0 x 0.6 x 0.9 m), cut out
//   spr_counter_v       its run up the east wall, 20 x 80 (0.6 x 1.9 x 0.9 m),
//                       seen from above, its front hidden behind the south
//                       run's top, cut out
// Furniture draws as its front face (real height x 21.33 px/m) over its
// footprint's depth, each standing on the frame's bottom edge, where the world
// anchors it on its footprint's bottom edge (src/world/roomArt.ts).
//
// A repeated tile has three variants, each on its own page and seed, joined
// into one strip. Every page has its own seed in SEEDS, written out, and its
// origin where it lands in the lounge (a tile's where its run starts).
// Everything is seeded: a rerun reproduces the PNGs byte for byte.

import {
  FINE,
  MARK,
  SEAM,
  capTile,
  faceBands,
  faceWindow,
  rect,
  seg,
  variants,
  writeSheets,
} from './house.mjs';
import { createPage, finish, finishCutOut } from './index.mjs';

/** One seed per page, written out so adding a page never moves another's. */
const SEEDS = {
  floor: [0x7a00, 0x7a01, 0x7a02],
  kitchen: [0x7a10, 0x7a11, 0x7a12],
  wall: [0x7a20, 0x7a21, 0x7a22],
  cap: [0x7a30, 0x7a31, 0x7a32],
  capV: [0x7a40, 0x7a41, 0x7a42],
  window: 0x7a50,
  fireplace: 0x7a60,
  sideTable: 0x7a61,
  counter: 0x7a62,
  counterV: 0x7a63,
};

// The carpet: a short pile, its tufts as small ticks on a loose grid, and per
// variant a worn patch where feet cross it and a fleck of something dropped.
const CARPET_VARIANTS = [
  { offset: 0, worn: [3, 9, 7, 4], fleck: [12, 3] },
  { offset: 2, worn: [8, 2, 6, 5], fleck: [4, 13] },
  { offset: 1, worn: [1, 1, 5, 3], fleck: [10, 11] },
];

function carpetTile(i) {
  const page = createPage(16, 16, { seed: SEEDS.floor[i], origin: [160, 64] });
  const { k } = page;
  const v = CARPET_VARIANTS[i];
  k.box(-1, -1, 18, 18, 'carpet', { edges: false });
  for (let y = 1.5; y < 16; y += 4) {
    for (let x = ((y + v.offset) % 4) + 0.5; x < 16; x += 4) seg(k, x, y, x + 0.5, y + 0.9, 1);
  }
  const [wx, wy, ww, wh] = v.worn;
  k.hatchIn(rect(wx, wy, ww, wh), { spacing: 2.2, width: 1 });
  const [fx, fy] = v.fleck;
  k.blob(fx, fy, 0.6, 0.5, 'shadow', { width: 1 });
  return finish(page);
}

// The kitchen floor: four 25 cm quarry tiles to a tile, their grout drawn at
// the bottom and right of each (x and y 7.75, 15.75), so a tile owns its lower
// and right joints. Per variant: one tile fired darker and a chipped corner.
const KITCHEN_VARIANTS = [
  { dark: [0, 8], chip: [7.75, 7.75] },
  { dark: [8, 0], chip: [15.75, 7.75] },
  { dark: [8, 8], chip: [7.75, 15.75] },
];

function kitchenTile(i) {
  const page = createPage(16, 16, { seed: SEEDS.kitchen[i], origin: [336, 128] });
  const { k } = page;
  const v = KITCHEN_VARIANTS[i];
  k.box(-1, -1, 18, 18, 'tile', { edges: false });
  const [dx, dy] = v.dark;
  k.box(dx + 0.4, dy + 0.4, 7, 7, 'tile', { edges: false, paper: false, wear: false });
  for (const at of [7.75, 15.75]) {
    seg(k, -1, at, 17, at);
    seg(k, at, -1, at, 17);
  }
  const [cx, cy] = v.chip;
  k.line(
    [
      [cx - 2, cy - 0.4],
      [cx - 1.2, cy - 1.4],
      [cx - 0.3, cy - 2],
    ],
    1,
  );
  return finish(page);
}

// The back wall's face: wallpaper with a pinstripe pair every 8 px and a
// small sprig between the pairs, the picture rail's shadow under the cornice.
// Per variant: where the sprigs fall and a faded patch where a frame hung.
const WALL_VARIANTS = [
  { sprigs: [10, 26], faded: [2, 16, 5, 7] },
  { sprigs: [18, 34], faded: null },
  { sprigs: [14, 30], faded: [9, 22, 5, 8] },
];

function wallTile(i) {
  const page = createPage(16, 48, { seed: SEEDS.wall[i], origin: [160, 16] });
  const { k } = page;
  const v = WALL_VARIANTS[i];
  k.box(-1, 3.5, 18, 40, 'wallpaper', { edges: false });
  if (v.faded) {
    const [fx, fy, fw, fh] = v.faded;
    k.box(fx, fy, fw, fh, 'cream', { edges: false, paper: false, wear: false });
  }
  for (const x of [3, 11]) {
    seg(k, x, 4, x, 43, 1.2);
    seg(k, x + 1.4, 4, x + 1.4, 43, 1);
  }
  for (const [n, y] of v.sprigs.entries()) {
    const x = n % 2 === 0 ? 7.8 : 15.8;
    k.blob(x, y, 0.9, 1.3, 'rug', { width: 1.1 });
    seg(k, x, y + 1.3, x - 0.2, y + 3, 1);
  }
  k.hatchIn(rect(-1, 3.6, 18, 1.8), FINE);
  faceBands(k);
  return finish(page);
}

/** Where each cap variant's crack runs, along its 16 px. */
const CAP_CRACKS = [4, 11, 8];

// The window: the face's window between two curtains drawn back, under a pelmet.
function loungeWindow() {
  const page = createPage(32, 24, { seed: SEEDS.window, origin: [176, 20] });
  const { k } = page;
  faceWindow(k, 6, 20);
  for (const [x0, x1, fold] of [
    [0.6, 7.6, 3.6],
    [24.4, 31.4, 28.4],
  ]) {
    k.shape(
      [
        [x0, 2],
        [x1, 2],
        [x1 - 1.4, 12],
        [x1 + 0.4, 22.6],
        [x0, 22.6],
      ],
      'rug',
      { hatching: rect(x0, 2, 2.4, 20.6) },
    );
    seg(k, fold, 3, fold - 0.4, 22, MARK);
  }
  k.box(0, 0.4, 32, 2.6, 'wood', { width: SEAM });
  return finishCutOut(page);
}

// The fireplace, 1.0 x 0.75 x 0.9 m: its top face (y 0..24) the mantel shelf,
// boards running east-west, a carriage clock and a candlestick at its back
// and the moulded front edge; its front (y 24..44) a stone surround round an
// arched firebox in shadow, logs on a grate and their flames.
function fireplace() {
  const page = createPage(32, 44, { seed: SEEDS.fireplace, origin: [224, 44] });
  const { k } = page;
  k.box(1, 24, 30, 19.6, 'stone');
  for (const [x0, x1] of [
    [1, 9],
    [23, 31],
  ]) {
    for (const y of [30, 36.5]) seg(k, x0, y, x1, y, MARK);
    seg(k, (x0 + x1) / 2, 30, (x0 + x1) / 2, 36.5, MARK);
    seg(k, x0 + 2.5, 24.5, x0 + 2.5, 30, MARK);
    seg(k, x0 + 2.5, 36.5, x0 + 2.5, 43.6, MARK);
  }
  k.shape(
    [
      [9, 43.6],
      [9, 32],
      [11, 29.4],
      [16, 28.4],
      [21, 29.4],
      [23, 32],
      [23, 43.6],
    ],
    'shadow',
    { hatching: 'shadow', wear: false },
  );
  k.box(10.5, 40.4, 11, 1.8, 'metal', { width: MARK });
  k.shape(
    [
      [12, 39],
      [13.4, 34],
      [15, 36.6],
      [16.4, 32],
      [17.8, 36.2],
      [19.2, 34.6],
      [20, 39],
    ],
    'lamp',
    { width: MARK, wear: false },
  );
  k.blob(16.2, 37.6, 1.4, 1.6, 'terracotta', { width: 1.1 });
  k.blob(13.6, 39.6, 3, 1.1, 'wood', { width: MARK });
  k.blob(18.6, 39.4, 3, 1.1, 'wood', { width: MARK });
  k.box(0.6, 1, 30.8, 21, 'top');
  for (const y of [8, 15]) seg(k, 0.8, y, 31.2, y);
  k.box(3, 2.4, 5, 4.2, 'brass', { width: MARK });
  k.blob(5.5, 4.4, 1.3, 1.3, 'cream', { width: 1 });
  k.blob(27, 5.4, 1.5, 1, 'brass', { width: MARK });
  k.box(26.4, 1.2, 1.2, 4, 'cream', { width: 1, wear: false });
  k.box(0, 21.6, 32, 3, 'wood');
  return finishCutOut(page);
}

// The side table, 0.5 m square and 0.4 m high: a planked top (y 0..16), an
// apron, two legs seen and the space under it in shadow.
function sideTable() {
  const page = createPage(16, 24, { seed: SEEDS.sideTable, origin: [160, 56] });
  const { k } = page;
  k.box(3, 18, 10, 5.4, 'shadow', { edges: false, hatching: 'shadow', wear: false });
  for (const x of [1.2, 12.6]) k.box(x, 16, 2.2, 7.6, 'wood', { width: SEAM });
  k.box(0.8, 0.8, 14.4, 15, 'top');
  for (const y of [5.8, 10.8]) seg(k, 1, y, 15, y, MARK);
  k.box(0.8, 15.6, 14.4, 2.6, 'wood', { width: SEAM });
  return finishCutOut(page);
}

/** A run of cupboard doors from x0 for `n` doors 16 px apart, its top at y0 and `h` tall, each with a brass knob. */
function cupboards(k, x0, n, y0, h) {
  for (let d = 0; d < n; d += 1) {
    const x = x0 + d * 16;
    k.box(x + 0.8, y0, 14.4, h, 'paint', { width: SEAM });
    k.blob(d % 2 === 0 ? x + 13 : x + 3, y0 + 2.4, 0.8, 0.8, 'brass', { width: 1 });
  }
}

// The counter along the south wall, 3.0 x 0.6 x 0.9 m: its worktop (y 0..20)
// with the kettle, a bread board and the sink with its tap, the corner where
// the east run meets it clear; its front (y 20..40) a row of painted cupboard
// doors over a shadowed plinth.
function counter() {
  const page = createPage(96, 40, { seed: SEEDS.counter, origin: [336, 168] });
  const { k } = page;
  k.box(0.6, 1, 94.8, 19, 'stone');
  k.blob(9, 9, 3.2, 3, 'metal', { width: SEAM, hatching: FINE });
  seg(k, 11.8, 7.2, 13.8, 5.6, MARK);
  k.box(18, 6, 13, 8, 'top', { width: SEAM });
  k.box(52, 4, 18, 12, 'metal', { width: SEAM, hatching: rect(52, 4, 18, 3) });
  k.blob(61, 11, 1, 0.8, 'shadow', { width: 1 });
  seg(k, 61, 2.4, 61, 6, SEAM);
  k.box(0, 19.6, 96, 2.6, 'stone', { width: SEAM });
  k.box(0.6, 22.2, 94.8, 17.4, 'paint', { edges: false });
  cupboards(k, 0, 6, 22.6, 14.6);
  k.box(0.6, 37.2, 94.8, 2.4, 'shadow', { width: SEAM, hatching: 'shadow', wear: false });
  return finishCutOut(page);
}

// The counter's run up the east wall, 0.6 x 1.9 m: seen from above, its
// worktop (y 0..60) with the hob's four rings and a jar; its front (y
// 60..80), a cupboard, falls behind the south run's worktop.
function counterV() {
  const page = createPage(20, 80, { seed: SEEDS.counterV, origin: [412, 108] });
  const { k } = page;
  k.box(0.6, 0.6, 18.8, 59.6, 'stone');
  k.box(3, 16, 14, 18, 'metal', { width: SEAM });
  for (const [x, y] of [
    [6.5, 20.5],
    [13.5, 20.5],
    [6.5, 29.5],
    [13.5, 29.5],
  ])
    k.blob(x, y, 2.2, 2, 'shadow', { width: MARK });
  k.blob(10, 46, 2.4, 2.2, 'cream', { width: SEAM });
  k.box(8.6, 42.6, 2.8, 1.4, 'wood', { width: 1 });
  k.box(0, 59.6, 20, 2.6, 'stone', { width: SEAM });
  k.box(0.6, 62.2, 18.8, 17.4, 'paint', { edges: false });
  cupboards(k, 2, 1, 62.6, 14.6);
  k.box(0.6, 77.2, 18.8, 2.4, 'shadow', { width: SEAM, hatching: 'shadow', wear: false });
  return finishCutOut(page);
}

writeSheets([
  ['spr_floor_lounge', () => variants(carpetTile)],
  ['spr_floor_kitchen', () => variants(kitchenTile)],
  ['spr_wall_lounge', () => variants(wallTile)],
  [
    'spr_lounge_cap',
    () => variants((i) => capTile(SEEDS.cap[i], false, [152, 208], CAP_CRACKS[i])),
  ],
  [
    'spr_lounge_cap_v',
    () => variants((i) => capTile(SEEDS.capV[i], true, [152, 16], CAP_CRACKS[i])),
  ],
  ['spr_lounge_window', loungeWindow],
  ['spr_fireplace', fireplace],
  ['spr_side_table', sideTable],
  ['spr_counter', counter],
  ['spr_counter_v', counterV],
]);
