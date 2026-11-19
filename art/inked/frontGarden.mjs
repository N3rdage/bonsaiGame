/* eslint-disable no-console -- reports each sheet `npm run art:front-garden` writes. */
// The front garden's own sheets, drawn in Inked (art/inked/README.md) at the
// scale rule's sizes and written to public/assets/. Its lawn, side fences,
// gate, house face, roof, windows and passage fence are the back garden's
// (art/inked/garden.mjs). Sizes in logical px:
//   spr_road         3 variants of a 32 x 96 slice of the 3 m road, tiled
//                    along it: asphalt with a 1 m dash of the centre line and
//                    a 1 m kerb stone along its foot, 18 slices across the
//                    room's 576 px
//   spr_fence_low    3 variants of the low front fence, 16 x 16, cut out:
//                    0.5 m pickets on two rails standing on the tile's bottom
//                    edge, transparent above them so the lawn shows
//   spr_drive        3 variants of the drive's block paving, 16 x 16
//   spr_path         3 variants of the path's paving, one 0.5 m flag a tile, 16 x 16
//   spr_bed          3 variants of a flower bed, soil, shrubs and flowers, 16 x 16
//   spr_front_door   the house's front door front-on, a solid panelled leaf
//                    in its frame, 24 x 40, cut out
//   spr_roller_door  the garage's closed roller door, 2.4 m wide, 77 x 40, cut out
//
// A repeated tile has three variants, each on its own page and seed, joined
// into one strip. Every page has its own seed in SEEDS, written out, and its
// origin where it lands in the front garden (a tile's where its run starts).
// Everything is seeded: a rerun reproduces the PNGs byte for byte.

import { join } from 'node:path';

import { joinStrip, writePng } from './canvas.mjs';
import { createPage, finish, finishCutOut } from './index.mjs';

const OUT = join(import.meta.dirname, '..', '..', 'public', 'assets');

/** One seed per page, written out so adding a page never moves another's. */
const SEEDS = {
  road: [0x6c00, 0x6c01, 0x6c02],
  fenceLow: [0x6c10, 0x6c11, 0x6c12],
  drive: [0x6c20, 0x6c21, 0x6c22],
  path: [0x6c30, 0x6c31, 0x6c32],
  bed: [0x6c40, 0x6c41, 0x6c42],
  frontDoor: 0x6c50,
  rollerDoor: 0x6c60,
};

/** Ink widths, art px: an outline, a seam, a small mark, a blade of grass. */
const OUTLINE = 2.6;
const SEAM = 1.0;
const MARK = 1.5;
const BLADE = 1.2;
/** Hatching for small forms, finer than the kit's default. */
const FINE = { spacing: 1.2, width: 1.2 };

const rect = (x, y, w, h) => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** An uneven oval round (cx, cy): `lobes` gentle bulges, turned by `phase`, so a patch is not a perfect ellipse. */
const oval = (cx, cy, rx, ry, lobes = 3, phase = 0) =>
  Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const r = 1 + 0.14 * Math.sin(a * lobes + phase);
    return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r];
  });

/** One straight ink line from (x0, y0) to (x1, y1). */
const seg = (k, x0, y0, x1, y1, width = SEAM) =>
  k.line(
    [
      [x0, y0],
      [x1, y1],
    ],
    width,
  );

/** A tuft of three blades rising from (x, y), grass in a joint. */
const tuft = (k, x, y) => {
  seg(k, x, y, x - 0.8, y - 1.8, BLADE);
  seg(k, x + 0.6, y, x + 0.7, y - 2.2, BLADE);
  seg(k, x + 1.2, y, x + 1.9, y - 1.6, BLADE);
};

// The road: asphalt from the canvas's top to the gutter, a 1 m dash of the
// centre line (16 px, then a 16 px gap), the gutter's shadow, and a kerb
// stone 1 m long along the foot, its top lit and its face hatched. The road
// repeats every three slices, so its variants differ only quietly: in one a
// short hairline crack, and where the kerb stone's joint falls.
const ROAD_VARIANTS = [
  { crack: null, joint: 31.5 },
  {
    crack: [
      [18, 60],
      [20, 62.4],
      [19.6, 65],
    ],
    joint: 15.5,
  },
  { crack: null, joint: 31.5 },
];

/** The kerb's top edge, the gutter above it and the kerb face's foot, logical px down the slice. */
const KERB = 86;

function roadTile(i) {
  const page = createPage(32, 96, { seed: SEEDS.road[i], origin: [0, 0] });
  const { k } = page;
  const v = ROAD_VARIANTS[i];
  k.box(-1, -1, 34, KERB + 1, 'asphalt', { edges: false });
  if (v.crack) k.line(v.crack, 1);
  k.box(8, 40.5, 16, 2.6, 'paint', { width: SEAM, wear: false });
  k.shape(rect(-1, KERB - 2.4, 34, 2.4), 'asphalt', { edges: false, paper: false });
  k.box(-1, KERB, 34, 4, 'stone', { edges: false });
  k.box(-1, KERB + 4, 34, 7, 'stone', { edges: false, hatching: rect(-1, KERB + 4, 34, 7) });
  seg(k, -1, KERB, 33, KERB, OUTLINE);
  seg(k, -1, KERB + 4, 33, KERB + 4);
  seg(k, v.joint, KERB, v.joint, 96, MARK);
  return finish(page);
}

// The low front fence, 0.5 m: timber pickets 2.4 px wide on a 4 px
// pitch, pointed, on two rails, standing on the tile's bottom edge. The lawn
// is laid behind the rails so the gaps between them show it; above the top
// rail the page is cut away, so the lawn under the tile shows there. Per
// variant: the pickets' tops.
const PICKET_TOPS = [
  [5, 5.6, 5.2, 5.8],
  [5.7, 5.1, 5.5, 5],
  [5.3, 5.9, 5, 5.5],
];

function fenceLowTile(i) {
  const page = createPage(16, 16, { seed: SEEDS.fenceLow[i], origin: [0, 96] });
  const { k } = page;
  k.box(-1, 7, 18, 10, 'outside', { edges: false });
  k.shape(rect(-1, 14.6, 18, 1.4), 'outside', { edges: false, paper: false });
  for (let n = 0; n < 4; n += 1) {
    const x = n * 4 + 0.8;
    const top = PICKET_TOPS[i][n];
    k.shape(
      [
        [x, top + 1.2],
        [x + 1.2, top],
        [x + 2.4, top + 1.2],
        [x + 2.4, 15.7],
        [x, 15.7],
      ],
      'wood',
      { width: SEAM },
    );
  }
  for (const y of [8, 12.4]) k.box(-1, y, 18, 1.5, 'top', { width: SEAM, wear: false });
  return finishCutOut(page);
}

// The drive's block paving: 8 x 4 px blocks (0.25 x 0.125 m) in courses
// staggered half a block, every joint a thin seam. Per variant: where the
// courses start and, on one in three, an oil stain.
const DRIVE_VARIANTS = [
  { stagger: 0, stain: [10, 9, 3.4, 2.2] },
  { stagger: 4, stain: null },
  { stagger: 2, stain: null },
];

function driveTile(i) {
  const page = createPage(16, 16, { seed: SEEDS.drive[i], origin: [16, 96] });
  const { k } = page;
  const v = DRIVE_VARIANTS[i];
  k.box(-1, -1, 18, 18, 'stone', { edges: false });
  if (v.stain) {
    const [cx, cy, rx, ry] = v.stain;
    k.shape(oval(cx, cy, rx, ry, 3, i), 'shadow', { edges: false, paper: false });
  }
  for (let row = 0; row < 4; row += 1) {
    const y = row * 4;
    seg(k, -1, y + 4, 17, y + 4, 0.8);
    for (let x = (v.stagger + (row % 2) * 4) % 8; x < 16; x += 8) seg(k, x, y, x, y + 4, 0.8);
  }
  return finish(page);
}

// The path's paving: one square flag 0.5 m a side to a tile, its joints on
// the tile's edges. Per variant: a crack, a chipped corner or grass in a
// joint, one each.
const PATH_VARIANTS = [
  {
    crack: [
      [3, 4],
      [6, 7.4],
      [6.6, 11],
    ],
    chip: null,
    grass: null,
  },
  { crack: null, chip: [15.2, 0.8], grass: null },
  { crack: null, chip: null, grass: [2, 15.6] },
];

function pathTile(i) {
  const page = createPage(16, 16, { seed: SEEDS.path[i], origin: [320, 96] });
  const { k } = page;
  const v = PATH_VARIANTS[i];
  k.box(-1, -1, 18, 18, 'soil', { edges: false });
  k.box(0.8, 0.8, 14.4, 14.4, 'stone', { width: SEAM });
  if (v.crack) k.line(v.crack, 1);
  if (v.chip) {
    const [cx, cy] = v.chip;
    k.shape(
      [
        [cx - 2.4, cy],
        [cx, cy],
        [cx, cy + 2],
      ],
      'soil',
      { width: MARK },
    );
  }
  if (v.grass) tuft(k, v.grass[0], v.grass[1]);
  return finish(page);
}

// A flower bed: soil, a shrub or two seen from above, and a few flowers. Per
// variant: the shrubs (centre, radii) and the flowers (centre, wash).
const BED_VARIANTS = [
  {
    shrubs: [[8, 8, 5.6, 5]],
    flowers: [
      [2.4, 3, 'lamp'],
      [13.6, 13, 'rug'],
    ],
  },
  {
    shrubs: [
      [4.6, 7, 4, 3.8],
      [12, 9.4, 3.6, 3.6],
    ],
    flowers: [[9, 3, 'paint']],
  },
  {
    shrubs: [[10, 7.4, 4.6, 4.4]],
    flowers: [
      [3, 6, 'rug'],
      [4.4, 11.6, 'lamp'],
      [2, 14, 'paint'],
    ],
  },
];

function bedTile(i) {
  const page = createPage(16, 16, { seed: SEEDS.bed[i], origin: [128, 112] });
  const { k } = page;
  const v = BED_VARIANTS[i];
  k.box(-1, -1, 18, 18, 'soil', { edges: false });
  for (const [cx, cy, rx, ry] of v.shrubs)
    k.blob(cx, cy, rx, ry, 'foliage', { bump: 0.25, lobes: 7, width: SEAM });
  for (const [cx, cy, wash] of v.flowers) k.blob(cx, cy, 1.1, 1, wash, { width: SEAM });
  seg(k, -1, 15.6, 17, 15.6);
  return finish(page);
}

// The front door front-on in its timber frame: a solid leaf, painted the red
// of the roof's tiles, of four raised panels,
// the shade of the frame's reveal down its hinge side, a brass letter plate,
// knob and knocker, its bottom on the face's foot.
function frontDoor() {
  const page = createPage(24, 40, { seed: SEEDS.frontDoor, origin: [324, 184] });
  const { k } = page;
  k.box(0.8, 0.8, 22.4, 39, 'cap');
  k.box(3, 3, 18, 36.6, 'tile');
  k.hatchIn(rect(3.2, 3.2, 2.6, 36.2), FINE);
  for (const [x, y, h] of [
    [6, 5.4, 12],
    [12.8, 5.4, 12],
    [6, 23.4, 13.2],
    [12.8, 23.4, 13.2],
  ])
    k.box(x, y, 5.2, h, 'tile', { width: SEAM, hatching: rect(x + 3.6, y, 1.6, h) });
  k.box(8.6, 19.4, 6.8, 1.8, 'brass', { width: MARK });
  k.blob(18.6, 21.6, 1.1, 1.1, 'brass', { width: MARK });
  k.blob(12, 8.2, 1, 1.2, 'brass', { width: MARK });
  return finishCutOut(page);
}

/** The roller door's width, logical px: 2.4 m at 32 px a metre is 76.8, drawn as 77. */
const ROLLER_W = 77;

// The garage's roller door, closed: the housing across its head, the slats
// between two steel guides, the light catching the slats' ribs, the grime
// of the bottom metre, a bottom rail with its handle and lock.
function rollerDoor() {
  const page = createPage(ROLLER_W, 40, { seed: SEEDS.rollerDoor, origin: [17.5, 184] });
  const { k } = page;
  k.box(3.4, 5, ROLLER_W - 6.8, 34.6, 'metal', { edges: false });
  for (let y = 7.5; y < 37; y += 2.5) seg(k, 3.4, y, ROLLER_W - 3.4, y, 1);
  k.hatchIn(rect(3.4, 28, ROLLER_W - 6.8, 9), { spacing: 2.2, width: 1 });
  for (const x of [14, 46]) seg(k, x, 12, x + 5, 9.6, 1);
  seg(k, 3.4, 39.6, ROLLER_W - 3.4, 39.6, OUTLINE);
  k.box(3.4, 36.6, ROLLER_W - 6.8, 3, 'metal', { width: MARK });
  k.box(ROLLER_W / 2 - 4, 33.4, 8, 1.8, 'shadow', { width: MARK });
  k.blob(ROLLER_W / 2, 30.4, 0.9, 0.9, 'brass', { width: MARK });
  for (const x of [0.6, ROLLER_W - 3.4])
    k.box(x, 0.8, 2.8, 38.8, 'metal', { width: SEAM, hatching: 'shadow' });
  k.box(0.6, 0.8, ROLLER_W - 1.2, 4.2, 'metal', {
    width: OUTLINE,
    hatching: rect(0.6, 3.2, ROLLER_W - 1.2, 1.8),
  });
  return finishCutOut(page);
}

const strip = (n, draw) => () => joinStrip(Array.from({ length: n }, (_, i) => draw(i)));

const SHEETS = [
  ['spr_road', strip(3, roadTile)],
  ['spr_fence_low', strip(3, fenceLowTile)],
  ['spr_drive', strip(3, driveTile)],
  ['spr_path', strip(3, pathTile)],
  ['spr_bed', strip(3, bedTile)],
  ['spr_front_door', frontDoor],
  ['spr_roller_door', rollerDoor],
];

for (const [name, draw] of SHEETS) {
  const canvas = draw();
  writePng(join(OUT, `${name}.png`), canvas);
  console.log(`public/assets/${name}.png  ${String(canvas.width)}x${String(canvas.height)}`);
}
