/* eslint-disable no-console -- reports each sheet `npm run art:shed` writes. */
// The shed interior, drawn in Inked (art/inked/README.md) at the scale rule's
// heights and written to public/assets/:
//   spr_floor_shed      3 variants of a 16 x 16 floorboard tile, scattered by
//                       the floor's hash (src/world/assets.ts's `floorFrame`)
//   spr_shed_wall       3 variants of the back wall's face, 16 wide and 48 tall
//                       (2.4 m), its bottom edge on the floor line
//   spr_shed_cap        3 variants of the south wall's 8 px cap, 16 wide
//   spr_shed_cap_v      3 variants of the side walls' 8 px cap, 16 tall
//   spr_shed_window     the window on the face, 32 x 24, cut out
//   spr_shed_door       the lounge door, front-on in the face, 24 x 40, cut out
//   spr_shed_door_s     the garden door in the south wall, 24 x 16, cut out: the
//                       opening in the cap with the closed leaf's top edge in
//                       it and a stone step outside, since a door in a south
//                       wall shows no face in a three-quarter view
//   spr_workbench       48 x 40 (1.5 x 0.6 x 0.9 m), cut out
//   spr_planting_table  32 x 40 (1.0 x 0.6 x 0.9 m), cut out
//   spr_shop_kiosk      24 x 56 (a 0.75 m counter 1 m high, 0.75 m deep, its sign to 1.6 m), cut out
//   spr_shelf, spr_tools, spr_watering_can, spr_pot_stack, spr_sack
//                       the decor, cut out, each standing on its frame's bottom edge
//   spr_shed_rug        the rug, 120 x 70 at SHED_RUG's rect, cut out
// Furniture draws as its front face (real height x 21.33 px/m) over its
// footprint's depth, each standing on the frame's bottom edge, where the world
// anchors it on its footprint's bottom edge (src/world/roomArt.ts).
//
// A repeated tile has three variants, each on its own page and seed, joined
// into one strip. Every page has its own seed in SEEDS, written out, and its
// origin where it lands in the shed (a tile's where its run starts).
// Everything is seeded: a rerun reproduces the PNGs byte for byte.

import { join } from 'node:path';

import { joinStrip, writePng } from './canvas.mjs';
import { createPage, finish, finishCutOut } from './index.mjs';

const OUT = join(import.meta.dirname, '..', '..', 'public', 'assets');

/** One seed per page, written out so adding a page never moves another's. */
const SEEDS = {
  floor: [0x5d00, 0x5d01, 0x5d02],
  wall: [0x5d10, 0x5d11, 0x5d12],
  cap: [0x5d20, 0x5d21, 0x5d22],
  capV: [0x5d30, 0x5d31, 0x5d32],
  window: 0x5d40,
  door: 0x5d41,
  doorS: 0x5d42,
  workbench: 0x5d50,
  plantingTable: 0x5d51,
  kiosk: 0x5d52,
  shelf: 0x5d60,
  tools: 0x5d61,
  wateringCan: 0x5d62,
  potStack: 0x5d63,
  sack: 0x5d64,
  rug: 0x5d70,
};

/** Ink widths, art px: an outline, a tile's seams, a small mark. */
const OUTLINE = 2.6;
const SEAM = 1.8;
const MARK = 1.5;
/** Hatching for small forms, finer than the kit's default. */
const FINE = { spacing: 1.2, width: 1.2 };

const rect = (x, y, w, h) => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** One straight ink line from (x0, y0) to (x1, y1). */
const seg = (k, x0, y0, x1, y1, width = SEAM) =>
  k.line(
    [
      [x0, y0],
      [x1, y1],
    ],
    width,
  );

// The floor: four boards to a tile, 12.5 cm each, running east-west. Each
// seam is drawn at the bottom of its board (y 3.5, 7.5, 11.5, 15.5), so a tile
// owns its lower seam and its upper one is the tile above's. Per variant, the
// boards' few end joints (board row, x), so the boards run long, the grain
// streaks along them (board row, x, length), and its marks: nail pairs and a
// hatched scuff of dirt.
const FLOOR_VARIANTS = [
  {
    joints: [[2, 12]],
    grain: [
      [0, 2, 7],
      [3, 6, 8],
    ],
    nails: [
      [1, 2],
      [3, 9],
    ],
    scuff: [10, 9],
  },
  {
    joints: [],
    grain: [
      [1, 8, 6],
      [2, 1, 5],
    ],
    nails: [[0, 13]],
    scuff: [4, 5],
  },
  {
    joints: [[0, 7]],
    grain: [
      [2, 9, 6],
      [3, 1, 4],
    ],
    nails: [[1, 6]],
    scuff: [12, 13],
  },
];

function floorTile(i) {
  const page = createPage(16, 16, { seed: SEEDS.floor[i], origin: [96, 64] });
  const { k } = page;
  const v = FLOOR_VARIANTS[i];
  k.box(-1, -1, 18, 18, 'floor', { edges: false });
  for (const y of [3.5, 7.5, 11.5, 15.5]) seg(k, -1, y, 17, y);
  for (const [row, x] of v.joints) seg(k, x, row * 4 - 0.5, x, row * 4 + 3.5, MARK);
  for (const [row, x, len] of v.grain) seg(k, x, row * 4 + 1.6, x + len, row * 4 + 1.8, 1);
  for (const [row, x] of v.nails) {
    seg(k, x, row * 4 + 1.2, x + 0.2, row * 4 + 1.5, MARK);
    seg(k, x, row * 4 + 2.4, x + 0.2, row * 4 + 2.7, MARK);
  }
  const [sx, sy] = v.scuff;
  k.hatchIn(rect(sx - 2, sy - 1, 4, 2), FINE);
  return finish(page);
}

// The back wall's face: a top beam (the wall's own cap) y 0..4, vertical
// planks y 4..43 with their seams at x 3.5, 7.5, 11.5, 15.5 as the floor's, a
// skirting board y 43..48 on the floor line, and the grime of the bottom
// metre hatched in. Per variant: a plank's knot, a split and a nail row.
const WALL_VARIANTS = [
  { knot: [6, 18], split: [13, 30, 6] },
  { knot: [10, 26], split: [2, 10, 5] },
  { knot: [2, 33], split: [9, 20, 7] },
];

function wallTile(i) {
  const page = createPage(16, 48, { seed: SEEDS.wall[i], origin: [96, 16] });
  const { k } = page;
  const v = WALL_VARIANTS[i];
  k.box(-1, 4, 18, 39, 'wall', { edges: false });
  k.hatchIn(rect(-1, 33, 18, 10), { spacing: 1.9, width: 1.2 });
  for (const x of [3.5, 7.5, 11.5, 15.5]) seg(k, x, 4, x, 43);
  k.box(-1, -1, 18, 5, 'cap', { edges: false, hatching: true });
  seg(k, -1, 4, 17, 4, OUTLINE);
  k.box(-1, 43, 18, 5, 'wood', { edges: false });
  seg(k, -1, 43, 17, 43, OUTLINE);
  seg(k, -1, 47.6, 17, 47.6, OUTLINE);
  const [kx, ky] = v.knot;
  k.blob(kx, ky, 0.9, 1.6, 'wood', { width: MARK });
  const [px, py, len] = v.split;
  seg(k, px, py, px + 0.3, py + len, MARK);
  for (const x of [1.5, 5.5, 9.5, 13.5]) seg(k, x, 6, x + 0.2, 6.3, MARK);
  return finish(page);
}

// The caps: the top of a 25 cm wall seen from above, a beam with both its
// edges inked and its shadow hatched, and a butt joint per variant. `along`
// is x for the south wall's 16 x 8 tile, y for a side wall's 8 x 16.
const CAP_JOINTS = [5, 11, 8];

function capTile(i, vertical) {
  const [w, h] = vertical ? [8, 16] : [16, 8];
  const seed = (vertical ? SEEDS.capV : SEEDS.cap)[i];
  const page = createPage(w, h, { seed, origin: vertical ? [88, 16] : [88, 208] });
  const { k } = page;
  const P = (pts) => (vertical ? pts.map(([a, b]) => [b, a]) : pts);
  k.shape(P(rect(-1, 0.6, 18, 6.8)), 'cap', { edges: false, hatching: 'shadow' });
  for (const across of [0.6, 7.4])
    k.line(
      P([
        [-1, across],
        [17, across],
      ]),
      OUTLINE,
    );
  const j = CAP_JOINTS[i];
  k.line(
    P([
      [j, 0.8],
      [j, 7.2],
    ]),
    SEAM,
  );
  return finish(page);
}

function shedWindow() {
  const page = createPage(32, 24, { seed: SEEDS.window, origin: [264, 20] });
  const { k } = page;
  k.box(1, 1, 30, 20, 'wood');
  for (const x of [3.5, 17]) {
    k.box(x, 3.5, 11.5, 15, 'glass', { width: SEAM, hatching: rect(x + 6, 3.5, 5.5, 15) });
    seg(k, x + 5.75, 3.5, x + 5.75, 18.5);
    seg(k, x, 11, x + 11.5, 11);
  }
  k.box(0, 20, 32, 3.4, 'top');
  return finishCutOut(page);
}

// The lounge door, front-on: a ledged and braced plank door in its frame, a
// brass knob, its bottom on the floor line.
function loungeDoor() {
  const page = createPage(24, 40, { seed: SEEDS.door, origin: [228, 24] });
  const { k } = page;
  k.box(0.8, 0.8, 22.4, 39, 'wood');
  k.box(3.2, 3.2, 17.6, 36.6, 'top');
  for (const x of [7.6, 12, 16.4]) seg(k, x, 3.4, x, 39.6);
  for (const y of [8, 22, 34]) k.box(3.6, y, 16.8, 2.4, 'wood', { width: SEAM });
  seg(k, 4.4, 33.6, 19.6, 10.6, SEAM);
  k.blob(18, 22, 1.2, 1.2, 'brass', { width: MARK });
  k.hatchIn(rect(3.4, 3.4, 3.4, 36), FINE);
  return finishCutOut(page);
}

// The garden door in the south wall: the cap's opening between two jambs with
// the closed leaf's top edge across it, and a stone step outside.
function gardenDoor() {
  const page = createPage(24, 16, { seed: SEEDS.doorS, origin: [228, 208] });
  const { k } = page;
  k.box(3, 0.8, 18, 6.6, 'floor', { width: SEAM });
  k.box(3.6, 3, 16.8, 2.2, 'wood', { width: SEAM });
  for (const x of [0.6, 20.4]) k.box(x, 0.6, 3, 6.8, 'cap', { hatching: 'shadow' });
  k.box(4, 8.6, 16, 5.4, 'stone', { width: SEAM, hatching: rect(4, 12, 16, 2) });
  return finishCutOut(page);
}

// The workbench, 1.5 x 0.6 x 0.9 m: a planked top (y 1..20) with a vice and
// a few offcuts, an apron with two drawers, four legs and a low shelf, the
// space under it in shadow.
function workbench() {
  const page = createPage(48, 40, { seed: SEEDS.workbench, origin: [101, 60] });
  const { k } = page;
  k.box(4, 22, 40, 16, 'shadow', { edges: false, hatching: 'shadow', wear: false });
  k.box(2, 22, 4, 17.4, 'wood');
  k.box(42, 22, 4, 17.4, 'wood');
  k.box(6, 31, 36, 3, 'wood', { width: SEAM });
  k.box(1, 1.5, 46, 18.5, 'top');
  for (const y of [6.5, 11, 15.5]) seg(k, 1.2, y, 46.8, y);
  k.box(1, 20, 46, 6, 'wood');
  for (const x of [8, 26]) {
    k.box(x, 21.4, 14, 3.4, 'wood', { width: SEAM });
    seg(k, x + 6, 23.1, x + 8, 23.1, MARK);
  }
  k.box(36, 3, 7, 5, 'metal', { width: SEAM, hatching: rect(39.5, 3, 3.5, 5) });
  seg(k, 39.5, 8, 39.5, 12, SEAM);
  k.box(6, 9, 12, 2.6, 'wood', { width: SEAM });
  k.box(20, 4, 6, 4, 'terracotta', { width: SEAM });
  k.box(29, 13, 9, 2.4, 'metal', { width: SEAM });
  return finishCutOut(page);
}

// The planting table, 1.0 x 0.6 x 0.9 m: a soil tray on its top with a pot
// and a seedling, legs, and the space under it in shadow with a sack of mix.
function plantingTable() {
  const page = createPage(32, 40, { seed: SEEDS.plantingTable, origin: [149, 60] });
  const { k } = page;
  k.box(4, 22, 24, 16, 'shadow', { edges: false, hatching: 'shadow', wear: false });
  k.box(2, 22, 4, 17.4, 'wood');
  k.box(26, 22, 4, 17.4, 'wood');
  k.box(1, 1.5, 30, 18.5, 'top');
  k.box(3.5, 4, 16, 12, 'soil', { width: SEAM, hatching: rect(3.5, 12, 16, 4) });
  for (const [x, y] of [
    [7, 8],
    [12, 10],
    [16, 7],
  ])
    seg(k, x, y, x + 1.2, y - 0.6, MARK);
  k.shape(
    [
      [21.5, 6],
      [29, 6],
      [28, 14],
      [22.5, 14],
    ],
    'terracotta',
    { width: SEAM },
  );
  k.blob(25.3, 4.5, 3, 2.4, 'foliage', { bump: 0.3, lobes: 5, width: SEAM });
  k.box(1, 20, 30, 6, 'wood');
  seg(k, 3, 23, 29, 23, MARK);
  return finishCutOut(page);
}

// The shop kiosk: a counter 1 m high on a 0.75 m square footprint (top y
// 12..36, front y 36..56) with a cash tin and a bell, two posts at its back
// carrying a sign board.
function kiosk() {
  const page = createPage(24, 56, { seed: SEEDS.kiosk, origin: [113, 101] });
  const { k } = page;
  for (const x of [2.5, 18.5]) k.box(x, 6, 3, 8, 'wood', { width: SEAM });
  k.box(1, 0.8, 22, 8.4, 'cream', { wear: false });
  for (const [x0, x1] of [
    [4, 9],
    [10.5, 15],
    [16.5, 20],
  ]) {
    seg(k, x0, 3.6, x1, 3.4, MARK);
    seg(k, x0 + 0.5, 6.2, x1 - 0.5, 6, MARK);
  }
  k.box(1, 12.5, 22, 24, 'top');
  k.box(3.5, 16, 9, 6, 'metal', { width: SEAM, hatching: rect(3.5, 19.5, 9, 2.5) });
  k.blob(17.5, 26, 2.2, 1.6, 'brass', { width: SEAM });
  k.box(1, 36, 22, 19.4, 'wood');
  for (const x of [6.5, 12, 17.5]) seg(k, x, 37, x, 55);
  k.hatchIn(rect(1.4, 36.4, 5, 18.6), FINE);
  return finishCutOut(page);
}

// The decor, each cut out and standing on its frame's bottom edge.

/** The shelf, a low two-tier rack 0.75 m wide, 0.25 m deep and 0.6 m high, with pots on it. */
function shelf() {
  const page = createPage(24, 20, { seed: SEEDS.shelf, origin: [208, 67] });
  const { k } = page;
  k.box(1, 6, 22, 13.4, 'shadow', { edges: false, hatching: 'shadow', wear: false });
  for (const x of [1, 20.5]) k.box(x, 1, 2.5, 18.4, 'wood', { width: SEAM });
  for (const y of [1, 10, 17]) k.box(1, y, 22, 2.2, 'top', { width: SEAM });
  // Pots standing on the two boards (their tops at y 10 and 17): x, height, width.
  for (const [x, base, h, w] of [
    [5, 10, 5, 4],
    [11, 10, 4, 3],
    [15.5, 10, 5.5, 4],
    [6, 17, 4.5, 5],
    [13.5, 17, 4, 4],
  ]) {
    k.shape(
      [
        [x, base - h],
        [x + w, base - h],
        [x + w - 0.6, base],
        [x + 0.6, base],
      ],
      'terracotta',
      { width: MARK },
    );
  }
  return finishCutOut(page);
}

/** A spade and a rake stood on end, about 1.5 m tall. */
function tools() {
  const page = createPage(12, 32, { seed: SEEDS.tools, origin: [100, 144] });
  const { k } = page;
  const handle = (ax, ay, bx, by) =>
    k.shape(
      [
        [ax - 0.7, ay],
        [ax + 0.7, ay],
        [bx + 0.7, by],
        [bx - 0.7, by],
      ],
      'wood',
      { width: MARK },
    );
  handle(8.2, 4, 8.8, 31);
  k.box(4.2, 1.6, 8.6, 2.2, 'metal', { width: MARK });
  for (const x of [5, 7, 9, 11.4]) seg(k, x, 3.8, x, 5.4, MARK);
  handle(3.8, 4.5, 4.2, 24);
  k.box(2, 2.4, 4, 2.2, 'wood', { width: MARK });
  k.shape(
    [
      [1.4, 23],
      [6.6, 23],
      [6.4, 29.6],
      [4, 31.2],
      [1.6, 29.6],
    ],
    'metal',
    { width: SEAM, hatching: rect(4, 23, 2.6, 8) },
  );
  return finishCutOut(page);
}

/** A galvanised watering can, 0.45 m long and 0.3 m high, its rose to the right. */
function wateringCan() {
  const page = createPage(16, 12, { seed: SEEDS.wateringCan, origin: [345, 116] });
  const { k } = page;
  k.shape(
    [
      [9.6, 6],
      [14.6, 1.6],
      [15.4, 2.6],
      [11, 8],
    ],
    'metal',
    { width: MARK },
  );
  k.box(1.6, 4, 9, 7.4, 'metal', { width: SEAM, hatching: rect(7.6, 4, 3, 7.4) });
  k.blob(6.1, 4, 4.5, 1.4, 'metal', { width: SEAM });
  k.line(
    [
      [2.6, 3.6],
      [4.6, 0.8],
      [8, 0.8],
      [9.8, 3.6],
    ],
    SEAM,
  );
  return finishCutOut(page);
}

/** Three terracotta pots nested in a stack, 0.3 m across and 0.6 m tall. */
function potStack() {
  const page = createPage(12, 20, { seed: SEEDS.potStack, origin: [347, 174] });
  const { k } = page;
  for (const y of [13, 7, 1]) {
    k.shape(
      [
        [0.8, y],
        [11.2, y],
        [10, y + 6.4],
        [2, y + 6.4],
      ],
      'terracotta',
      { width: SEAM, hatching: rect(7.6, y + 2, 2.6, 4.4) },
    );
    k.box(0.6, y, 10.8, 2, 'terracotta', { width: MARK, wear: false });
  }
  return finishCutOut(page);
}

/** A slumped hessian sack of potting mix, tied at the neck, 0.5 m wide and 0.6 m tall. */
function sack() {
  const page = createPage(16, 20, { seed: SEEDS.sack, origin: [142, 172] });
  const { k } = page;
  k.shape(
    [
      [5.6, 4.4],
      [10.4, 4.4],
      [13.8, 9],
      [15, 16],
      [13.6, 19.4],
      [2.4, 19.4],
      [1, 16],
      [2.2, 9],
    ],
    'cream',
    { hatching: rect(10.6, 9, 4, 10) },
  );
  k.shape(
    [
      [5, 0.8],
      [11, 0.8],
      [10.2, 4.6],
      [5.8, 4.6],
    ],
    'cream',
    { width: SEAM },
  );
  seg(k, 5.2, 4.6, 10.8, 4.6, OUTLINE);
  k.box(5, 10.5, 6, 4.5, 'soil', { width: MARK, wear: false });
  return finishCutOut(page);
}

// The rug at SHED_RUG's rect, 120 x 70: a faded red field inside a cream
// border band and a red edge, fringe at its short ends.
function rug() {
  const page = createPage(120, 70, { seed: SEEDS.rug, origin: [180, 110] });
  const { k } = page;
  k.box(3, 1, 114, 68, 'rug');
  k.box(7, 5, 106, 60, 'cream', { width: SEAM, wear: false });
  k.box(10, 8, 100, 54, 'rug', { width: SEAM });
  k.box(14, 12, 92, 46, null, { width: MARK, paper: false, wear: false });
  for (let y = 3; y < 68; y += 2.5) {
    seg(k, 0.8, y, 3, y, MARK);
    seg(k, 117, y, 119.2, y, MARK);
  }
  return finishCutOut(page);
}

const SHEETS = [
  ['spr_floor_shed', () => joinStrip([0, 1, 2].map(floorTile))],
  ['spr_shed_wall', () => joinStrip([0, 1, 2].map(wallTile))],
  ['spr_shed_cap', () => joinStrip([0, 1, 2].map((i) => capTile(i, false)))],
  ['spr_shed_cap_v', () => joinStrip([0, 1, 2].map((i) => capTile(i, true)))],
  ['spr_shed_window', shedWindow],
  ['spr_shed_door', loungeDoor],
  ['spr_shed_door_s', gardenDoor],
  ['spr_workbench', workbench],
  ['spr_planting_table', plantingTable],
  ['spr_shop_kiosk', kiosk],
  ['spr_shelf', shelf],
  ['spr_tools', tools],
  ['spr_watering_can', wateringCan],
  ['spr_pot_stack', potStack],
  ['spr_sack', sack],
  ['spr_shed_rug', rug],
];

for (const [name, draw] of SHEETS) {
  const canvas = draw();
  writePng(join(OUT, `${name}.png`), canvas);
  console.log(`public/assets/${name}.png  ${String(canvas.width)}x${String(canvas.height)}`);
}
