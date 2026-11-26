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
//   spr_sofa            28 x 80 (0.875 x 1.875 x 0.9 m), its back against the
//                       west wall, its seat facing east, cut out
//   spr_armchair        24 x 44 (0.75 x 0.75 x 0.9 m), its back to the east,
//                       cut out
//   spr_coffee_table    20 x 40 (0.625 x 1.0 x 0.4 m), cut out
//   spr_counter         the kitchen counter along the south wall, 96 x 40
//                       (3.0 x 0.6 x 0.9 m), cut out
//   spr_counter_v       its run up the east wall, 20 x 60 (0.6 x 1.9 x 0.9 m),
//                       its worktop alone, its south end joined to the south
//                       run, cut out
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
  JOINT,
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
  sofa: 0x7a64,
  armchair: 0x7a65,
  coffeeTable: 0x7a66,
};

// The carpet: one calm plane of short pile. On one variant in three, a worn
// patch where feet cross it, faintly hatched.
const CARPET_WORN = [[8, 4, 5, 3], null, null];

function carpetTile(i) {
  const page = createPage(16, 16, { seed: SEEDS.floor[i], origin: [160, 64] });
  const { k } = page;
  const worn = CARPET_WORN[i];
  k.box(-1, -1, 18, 18, 'carpet', { edges: false });
  if (worn) {
    const [wx, wy, ww, wh] = worn;
    k.hatchIn(rect(wx, wy, ww, wh), { spacing: 2.4, width: 0.8 });
  }
  return finish(page);
}

// The kitchen floor: four 25 cm quarry tiles to a tile, their grout drawn at
// the bottom and right of each (x and y 7.75, 15.75), so a tile owns its lower
// and right joints, thin. Per variant: one tile fired darker, and on one
// variant in three a chipped corner.
const KITCHEN_VARIANTS = [
  { dark: [0, 8], chip: [7.75, 7.75] },
  { dark: [8, 0], chip: null },
  { dark: [8, 8], chip: null },
];

function kitchenTile(i) {
  const page = createPage(16, 16, { seed: SEEDS.kitchen[i], origin: [336, 128] });
  const { k } = page;
  const v = KITCHEN_VARIANTS[i];
  k.box(-1, -1, 18, 18, 'tile', { edges: false });
  const [dx, dy] = v.dark;
  k.box(dx + 0.4, dy + 0.4, 7, 7, 'tile', { edges: false, paper: false, wear: false });
  for (const at of [7.75, 15.75]) {
    seg(k, -1, at, 17, at, JOINT);
    seg(k, at, -1, at, 17, JOINT);
  }
  if (v.chip) {
    const [cx, cy] = v.chip;
    k.line(
      [
        [cx - 2, cy - 0.4],
        [cx - 1.2, cy - 1.4],
        [cx - 0.3, cy - 2],
      ],
      1,
    );
  }
  return finish(page);
}

// The back wall's face: plain wallpaper with a fine pinstripe every 8 px, left
// calm. Per variant: the stripes' wobble, from the page's seed.

function wallTile(i) {
  const page = createPage(16, 48, { seed: SEEDS.wall[i], origin: [160, 16] });
  const { k } = page;
  k.box(-1, 3.5, 18, 40, 'wallpaper', { edges: false });
  for (const x of [3.5, 11.5]) seg(k, x, 4, x, 43, 0.8);
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
// dark boards running east-west, a carriage clock and a candlestick at its
// back and the moulded front edge; its front (y 24..44) a stone surround
// darkened by soot (a second layer, of `shadow`) round an arched firebox in
// shadow, logs on a grate and their flames, the room's accent.
function fireplace() {
  const page = createPage(32, 44, { seed: SEEDS.fireplace, origin: [224, 44] });
  const { k } = page;
  darkStone(k, rect(1, 24, 30, 19.6));
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
    'brass',
    { width: MARK, wear: false },
  );
  k.shape(
    [
      [13.6, 39],
      [15, 35.8],
      [16.4, 33.8],
      [17.6, 36.4],
      [18.6, 39],
    ],
    'lamp',
    { edges: false, paper: false, wear: false },
  );
  k.blob(16.2, 37.6, 1.4, 1.6, 'terracotta', { width: 1.1 });
  k.blob(13.6, 39.6, 3, 1.1, 'wood', { width: MARK });
  k.blob(18.6, 39.4, 3, 1.1, 'wood', { width: MARK });
  k.box(0.6, 1, 30.8, 21, 'wood');
  for (const y of [8, 15]) seg(k, 0.8, y, 31.2, y, JOINT);
  k.box(3, 2.4, 5, 4.2, 'brass', { width: MARK });
  k.blob(5.5, 4.4, 1.3, 1.3, 'cream', { width: 1 });
  k.blob(27, 5.4, 1.5, 1, 'brass', { width: MARK });
  k.box(26.4, 1.2, 1.2, 4, 'cream', { width: 1, wear: false });
  k.box(0, 21.6, 32, 3, 'top');
  return finishCutOut(page);
}

// The side table, 0.5 m square and 0.4 m high: a planked top (y 0..16), an
// apron, two legs seen and the space under it in shadow.
function sideTable() {
  const page = createPage(16, 24, { seed: SEEDS.sideTable, origin: [160, 56] });
  const { k } = page;
  k.box(3, 18, 10, 5.4, 'shadow', { edges: false, hatching: 'shadow', wear: false });
  for (const x of [1.2, 12.6]) k.box(x, 16, 2.2, 7.6, 'wood', { width: SEAM });
  k.box(0.8, 0.8, 14.4, 15, 'wood');
  for (const y of [5.8, 10.8]) seg(k, 1, y, 15, y, JOINT);
  k.box(0.8, 15.6, 14.4, 2.6, 'wood', { width: SEAM });
  return finishCutOut(page);
}

// The sofa, 0.875 x 1.875 x 0.9 m, its back (x 0..8) along the west wall and
// its seat facing east: its top face (y 0..60) the back's top and two seat
// cushions between an arm at each end; its front (y 60..80) the south end seen
// from the room, the back's end beside the lower arm, on four short feet.
function sofa() {
  const page = createPage(28, 80, { seed: SEEDS.sofa, origin: [176, 78] });
  const { k } = page;
  for (const x of [1.4, 24.4]) k.box(x, 76.4, 2.2, 3.4, 'wood', { width: JOINT });
  k.box(0.6, 0.6, 26.8, 66, 'sofa');
  k.box(0.6, 0.6, 8, 66, 'sofa', { width: SEAM, hatching: rect(0.6, 0.6, 8, 66) });
  for (const y of [5.4, 31.4]) k.box(9.4, y, 17.2, 24.2, 'sofa', { width: SEAM });
  k.box(9.4, 0.6, 17.2, 4.4, 'sofa', { width: SEAM, hatching: true });
  k.box(9.4, 56, 17.2, 4.4, 'sofa', { width: SEAM });
  k.box(0.6, 60, 26.8, 18, 'sofa', { width: SEAM });
  k.box(0.6, 60, 8, 18, 'sofa', { width: SEAM, hatching: rect(0.6, 60, 8, 18) });
  k.box(9.4, 66, 17.2, 11, 'sofa', { width: SEAM, hatching: 'shadow' });
  seg(k, 9, 66, 27, 66, MARK);
  k.box(12, 9, 4.6, 9, 'brass', { width: MARK });
  return finishCutOut(page);
}

// The armchair, 0.75 x 0.75 x 0.9 m, its back (x 17..24) to the east: its top
// face (y 0..24) the back's top and a seat cushion between two arms; its front
// (y 24..44) the south arm's end and the back's, on four short feet.
function armchair() {
  const page = createPage(24, 44, { seed: SEEDS.armchair, origin: [276, 92] });
  const { k } = page;
  for (const x of [1.2, 20.8]) k.box(x, 40.4, 2.2, 3.4, 'wood', { width: JOINT });
  k.box(0.6, 0.6, 22.8, 28, 'armchair');
  k.box(16.4, 0.6, 7, 28, 'armchair', { width: SEAM, hatching: rect(16.4, 0.6, 7, 28) });
  k.box(5.4, 5, 11.4, 18, 'armchair', { width: SEAM });
  k.box(0.6, 0.6, 15.8, 4, 'armchair', { width: SEAM, hatching: true });
  k.box(0.6, 24, 22.8, 18, 'armchair', { width: SEAM });
  k.box(16.4, 24, 7, 18, 'armchair', { width: SEAM, hatching: rect(16.4, 24, 7, 18) });
  k.box(2, 31, 12.6, 10, 'armchair', { width: SEAM, hatching: 'shadow' });
  seg(k, 1, 30, 16, 30, MARK);
  return finishCutOut(page);
}

// The coffee table, 0.625 x 1.0 x 0.4 m: a planked top (y 0..32) with a book
// and a bowl on it, an apron and four short legs, two seen, below it.
function coffeeTable() {
  const page = createPage(20, 40, { seed: SEEDS.coffeeTable, origin: [210, 104] });
  const { k } = page;
  k.box(3, 34, 14, 5.4, 'shadow', { edges: false, hatching: 'shadow', wear: false });
  for (const x of [1, 16.6]) k.box(x, 32, 2.4, 7.6, 'wood', { width: SEAM });
  k.box(0.8, 0.8, 18.4, 31, 'wood');
  for (const y of [10.5, 21]) seg(k, 1, y, 19, y, JOINT);
  k.box(0.8, 31.6, 18.4, 2.6, 'wood', { width: SEAM });
  k.box(3.4, 5, 7, 5, 'cream', { width: MARK });
  seg(k, 3.8, 6.6, 10.2, 6.6, JOINT);
  k.blob(13.6, 21.4, 3, 2.6, 'terracotta', { width: SEAM });
  return finishCutOut(page);
}

/** Stone darkened (by soot, by use) to sit below the floor: `stone` under a second layer of `shadow`, inked at `width`. */
function darkStone(k, pts, width = 2.6) {
  k.shape(pts, 'stone', { edges: false });
  k.shape(pts, 'shadow', { width, paper: false, wear: false });
}

/** A run of cupboard doors from x0 for `n` doors 16 px apart, its top at y0 and `h` tall, each with a brass knob. */
function cupboards(k, x0, n, y0, h) {
  for (let d = 0; d < n; d += 1) {
    const x = x0 + d * 16;
    k.box(x + 0.8, y0, 14.4, h, 'wood', { width: SEAM });
    k.blob(d % 2 === 0 ? x + 13 : x + 3, y0 + 2.4, 0.8, 0.8, 'brass', { width: 1 });
  }
}

// The counter along the south wall, 3.0 x 0.6 x 0.9 m: its worktop (y 0..20)
// with the kettle, a bread board and the sink with its tap, the corner where
// the east run meets it clear, all on dark stone; its front (y 20..40) a row
// of oak cupboard doors over a shadowed plinth.
function counter() {
  const page = createPage(96, 40, { seed: SEEDS.counter, origin: [336, 168] });
  const { k } = page;
  darkStone(k, rect(0.6, 1, 94.8, 19));
  k.blob(9, 9, 3.2, 3, 'metal', { width: SEAM, hatching: FINE });
  seg(k, 11.8, 7.2, 13.8, 5.6, MARK);
  k.box(18, 6, 13, 8, 'top', { width: SEAM });
  k.box(52, 4, 18, 12, 'metal', { width: SEAM, hatching: rect(52, 4, 18, 3) });
  k.blob(61, 11, 1, 0.8, 'shadow', { width: 1 });
  seg(k, 61, 2.4, 61, 6, SEAM);
  darkStone(k, rect(0, 19.6, 96, 2.6), SEAM);
  k.box(0.6, 22.2, 94.8, 17.4, 'wood', { edges: false, wear: false });
  cupboards(k, 0, 6, 22.6, 14.6);
  k.box(0.6, 37.2, 94.8, 2.4, 'shadow', { width: SEAM, hatching: 'shadow', wear: false });
  return finishCutOut(page);
}

// The counter's run up the east wall, 0.6 x 1.9 m: its worktop seen from
// above in dark stone, the footprint's depth (y 0..60), with the hob's four
// rings and a jar.
// It has no front face: its south end joins the south run, whose worktop
// covers the run's last 20 px, so the frame starts at the hallway block's
// south cap (y 128) rather than rising over it.
function counterV() {
  const page = createPage(20, 60, { seed: SEEDS.counterV, origin: [412, 128] });
  const { k } = page;
  darkStone(k, rect(0.6, 0.6, 18.8, 58.8));
  k.box(3, 6, 14, 18, 'metal', { width: SEAM });
  for (const [x, y] of [
    [6.5, 10.5],
    [13.5, 10.5],
    [6.5, 19.5],
    [13.5, 19.5],
  ])
    k.blob(x, y, 2.2, 2, 'shadow', { width: MARK });
  k.blob(10, 32, 2.4, 2.2, 'cream', { width: SEAM });
  k.box(8.6, 28.6, 2.8, 1.4, 'wood', { width: 1 });
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
  ['spr_sofa', sofa],
  ['spr_armchair', armchair],
  ['spr_coffee_table', coffeeTable],
]);
