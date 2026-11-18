/* eslint-disable no-console -- reports each sheet `npm run art:garden` writes. */
// The back garden and the buildings seen from it, drawn in Inked
// (art/inked/README.md) at the scale rule's heights and written to
// public/assets/. Sizes in logical px:
//   spr_floor_garden     3 variants of a 16 x 16 lawn tile, scattered by the
//                        floor's hash (src/world/assets.ts's `floorFrame`)
//   spr_fence            3 variants of the fence's face seen front-on, 16 x 16:
//                        a 0.75 m paling fence fills the band, standing on its
//                        bottom edge
//   spr_fence_v          3 variants of a north-south fence in three-quarter
//                        view, 16 x 16: the palings' tops, a line down the band
//   spr_fence_corner     the ring's corners, 16 x 16, 4 frames: NW, NE, SW, SE
//   spr_gate             the side gate's leaf between its posts, 16 x 16, cut out
//   spr_source_plant     the three source plants, 24 x 32, cut out, one frame
//                        per species (juniper, maple, pine), each standing on
//                        its frame's bottom edge
//   spr_shed_face        3 variants of the shed's south face, weatherboards,
//                        16 x 48 (2.4 m), its bottom edge on the footprint's
//   spr_shed_roof        3 variants of its corrugated iron roof, 16 x 16
//   spr_house_face       3 variants of the house's rendered back face, 16 x 48
//   spr_house_roof       3 variants of its tiled roof, 16 x 16
//   spr_house_cap_v      3 variants of its east wall's 8 px cap, 8 x 16, the
//                        wall along the passage being edge-on
//   spr_house_window     the kitchen window, 40 x 24, cut out
//   spr_greenhouse_roof  3 variants of the glass roof over its frame, 16 x 16
//   spr_greenhouse_face  3 variants of its south face, glass over a dwarf wall, 16 x 48
//   spr_greenhouse_cap   3 variants of the frame rail on its north edge, 16 x 8
//   spr_greenhouse_cap_v 3 variants of the rails on its east and west edges, 8 x 16
//   spr_door_glazed      one glazed leaf front-on, 24 x 40, cut out: the study's
//                        garden door, and the greenhouse's door seen from the
//                        garden and from inside
//
// A repeated tile has three variants, each on its own page and seed, joined
// into one strip. Every page has its own seed in SEEDS, written out, and its
// origin where it lands in the garden (a tile's where its run starts).
// Everything is seeded: a rerun reproduces the PNGs byte for byte.

import { join } from 'node:path';

import { joinStrip, writePng } from './canvas.mjs';
import { createPage, finish, finishCutOut } from './index.mjs';

const OUT = join(import.meta.dirname, '..', '..', 'public', 'assets');

/** One seed per page, written out so adding a page never moves another's. */
const SEEDS = {
  lawn: [0x6a00, 0x6a01, 0x6a02],
  fence: [0x6a10, 0x6a11, 0x6a12],
  fenceV: [0x6a20, 0x6a21, 0x6a22],
  corner: [0x6a30, 0x6a31, 0x6a32, 0x6a33],
  gate: 0x6a40,
  sourcePlant: [0x6a50, 0x6a51, 0x6a52],
  shedFace: [0x6a60, 0x6a61, 0x6a62],
  shedRoof: [0x6a70, 0x6a71, 0x6a72],
  houseFace: [0x6a80, 0x6a81, 0x6a82],
  houseRoof: [0x6a90, 0x6a91, 0x6a92],
  houseCapV: [0x6aa0, 0x6aa1, 0x6aa2],
  houseWindow: 0x6ab0,
  greenhouseRoof: [0x6ac0, 0x6ac1, 0x6ac2],
  greenhouseFace: [0x6ad0, 0x6ad1, 0x6ad2],
  greenhouseCap: [0x6ae0, 0x6ae1, 0x6ae2],
  greenhouseCapV: [0x6af0, 0x6af1, 0x6af2],
  doorGlazed: 0x6b00,
};

/** Ink widths, art px: an outline, a tile's seams, a small mark, a blade of grass. */
const OUTLINE = 2.6;
const SEAM = 1.8;
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

/** A tuft of three blades rising from (x, y). */
const tuft = (k, x, y) => {
  seg(k, x, y, x - 0.8, y - 2, BLADE);
  seg(k, x + 0.6, y, x + 0.7, y - 2.6, BLADE);
  seg(k, x + 1.2, y, x + 2, y - 1.8, BLADE);
};

/** The lawn under a tile: the `outside` wash edge to edge, its rim pooled off the page. */
const lawn = (k) => k.box(-1, -1, 18, 18, 'outside', { edges: false });

// The lawn: the wash, a darker pool where the pigment settled, a few tufts and
// single blades. Per variant: the pool (centre, radii, lobes), the tufts and
// the blades.
const LAWN_VARIANTS = [
  {
    pool: [10, 5, 4.5, 2.6, 3],
    tufts: [
      [3, 6],
      [11, 13],
    ],
    blades: [
      [7, 10],
      [14, 3],
    ],
  },
  {
    pool: [5, 11, 3.6, 3, 2],
    tufts: [[9, 5]],
    blades: [
      [2, 3],
      [12, 10],
      [6, 15],
    ],
  },
  {
    pool: [12, 12, 3, 2.2, 4],
    tufts: [
      [4, 9],
      [13, 4],
    ],
    blades: [[9, 14]],
  },
];

function lawnTile(i) {
  const page = createPage(16, 16, { seed: SEEDS.lawn[i], origin: [32, 288] });
  const { k } = page;
  const v = LAWN_VARIANTS[i];
  lawn(k);
  const [px, py, rx, ry, lobes] = v.pool;
  k.shape(oval(px, py, rx, ry, lobes, i), 'outside', { edges: false, paper: false });
  for (const [x, y] of v.tufts) tuft(k, x, y);
  for (const [x, y] of v.blades) seg(k, x, y, x + 0.5, y - 1.8, BLADE);
  return finish(page);
}

/**
 * Palings 4 px wide from x `from` to `to`, their pointed tops at y `top` (one
 * per paling, 1 to 2 px down), standing on the tile's bottom edge.
 */
function palings(k, from, to, tops) {
  for (let x = from, n = 0; x < to; x += 4, n += 1) {
    const top = tops[n % tops.length];
    k.shape(
      [
        [x + 0.3, top + 0.9],
        [x + 2, top],
        [x + 3.7, top + 0.9],
        [x + 3.7, 15.7],
        [x + 0.3, 15.7],
      ],
      'wood',
      { width: SEAM },
    );
  }
}

/** The two rails across the palings from x `from` to `to`, a nail in each paling. */
function rails(k, from, to) {
  for (const y of [4.5, 11]) {
    k.box(from, y, to - from, 1.8, 'top', { width: MARK, wear: false });
    for (let x = from + 2; x < to; x += 4) seg(k, x, y + 0.7, x + 0.2, y + 1, MARK);
  }
}

// The fence's face, front-on: palings on two rails, the ground's shadow
// hatched along its foot. Per variant: the palings' tops.
const FENCE_TOPS = [
  [1, 1.6, 1.2, 1.9],
  [1.8, 1.1, 1.5, 1],
  [1.3, 1.9, 1, 1.5],
];

function fenceTile(i) {
  const page = createPage(16, 16, { seed: SEEDS.fence[i], origin: [208, 496] });
  const { k } = page;
  lawn(k);
  palings(k, 0, 16, FENCE_TOPS[i]);
  rails(k, -1, 17);
  k.hatchIn(rect(-1, 14, 18, 2), FINE);
  return finish(page);
}

// A north-south fence in three-quarter view: the palings' tops, a 4 px strip
// down the middle of the band, each paling's top a seam across it, and the
// fence's shadow on the lawn east of it. Per variant: where the seams fall
// and, in one, a post.
const FENCE_V_VARIANTS = [
  { seams: [2.5, 6.5, 10.5, 14.5], post: null },
  { seams: [0.5, 4.5, 8.5, 12.5], post: 6 },
  { seams: [3.5, 7.5, 11.5, 15.5], post: null },
];

/** The fence's strip down x 6..10 from y `y0` to `y1`, its seams across it. */
function fenceStrip(k, y0, y1, seams) {
  k.hatchIn(rect(10, y0, 2.4, y1 - y0), FINE);
  k.box(6, y0, 4, y1 - y0, 'wood', { edges: false, wear: false });
  seg(k, 6, y0, 6, y1, OUTLINE);
  seg(k, 10, y0, 10, y1, OUTLINE);
  for (const y of seams) if (y > y0 && y < y1) seg(k, 6, y, 10, y, MARK);
}

function fenceVTile(i) {
  const page = createPage(16, 16, { seed: SEEDS.fenceV[i], origin: [448, 256] });
  const { k } = page;
  const v = FENCE_V_VARIANTS[i];
  lawn(k);
  fenceStrip(k, -1, 17, v.seams);
  if (v.post !== null) k.box(5, v.post, 6, 4, 'top', { width: SEAM });
  return finish(page);
}

// The corners: the fence's face along the row's half of the tile, the
// column's strip from the corner post to the tile's edge, and the corner post
// over both. Frames NW, NE, SW, SE: whether the row runs east (west corners)
// and the column south (north corners).
const CORNERS = [
  { east: true, south: true, origin: [0, 0] },
  { east: false, south: true, origin: [448, 0] },
  { east: true, south: false, origin: [0, 496] },
  { east: false, south: false, origin: [448, 496] },
];

function cornerTile(i) {
  const { east, south, origin } = CORNERS[i];
  const page = createPage(16, 16, { seed: SEEDS.corner[i], origin });
  const { k } = page;
  lawn(k);
  if (south) fenceStrip(k, 8, 17, [12.5]);
  else fenceStrip(k, -1, 8, [2.5]);
  const [from, to] = east ? [8, 16] : [0, 8];
  palings(k, from, to, FENCE_TOPS[i % 3]);
  rails(k, east ? 8 : -1, east ? 17 : 8);
  k.hatchIn(rect(from, 14, 8, 2), FINE);
  k.box(5.2, 0.4, 5.6, 15.3, 'top', { width: OUTLINE, hatching: rect(9, 0.4, 1.8, 15.3) });
  seg(k, 5.2, 2, 10.8, 2, MARK);
  return finish(page);
}

// The side gate: a ledged and braced leaf of boards between two posts, a
// brass latch, as tall as the fence, cut out.
function gate() {
  const page = createPage(16, 16, { seed: SEEDS.gate, origin: [424, 0] });
  const { k } = page;
  k.box(3, 1.4, 10, 14.3, 'wood');
  for (const x of [5.5, 8, 10.5]) seg(k, x, 1.6, x, 15.5, MARK);
  for (const y of [3.4, 11.4]) k.box(3.3, y, 9.4, 1.9, 'wood', { width: SEAM });
  seg(k, 4, 11.3, 12, 5.3, SEAM);
  k.blob(11.3, 8.3, 0.9, 0.9, 'brass', { width: MARK });
  for (const x of [0.3, 13.1]) k.box(x, 0.3, 2.6, 15.4, 'top', { width: SEAM });
  return finishCutOut(page);
}

// The source plants, each growing out of a mound of soil on the frame's
// bottom edge: an upright juniper, a small maple with a round crown and a
// pine with its foliage in tiered pads.
function soilMound(k) {
  k.blob(12, 29.6, 8.5, 2.2, 'soil', { width: SEAM });
}

function trunk(k, x0, y0, x1, y1, w) {
  k.shape(
    [
      [x0 - w, y0],
      [x0 + w, y0],
      [x1 + w * 0.5, y1],
      [x1 - w * 0.5, y1],
    ],
    'wood',
    { width: SEAM, wear: false },
  );
}

const PLANTS = [
  // Juniper: three upright flames of foliage from one short trunk.
  (k) => {
    trunk(k, 12, 29, 12, 22, 1.2);
    k.blob(8, 21, 3.8, 6.5, 'foliage', { bump: 0.2, lobes: 7, hatching: FINE, width: SEAM });
    k.blob(16.2, 19.5, 3.8, 7.5, 'foliage', { bump: 0.2, lobes: 7, hatching: FINE, width: SEAM });
    k.blob(12, 14, 4.6, 11, 'foliage', { bump: 0.25, lobes: 9, width: SEAM });
    k.hatchIn(oval(13.6, 16, 2.2, 7), FINE);
  },
  // Maple: a slender trunk forking into a round, lobed crown.
  (k) => {
    trunk(k, 12, 29, 12.6, 12, 1.4);
    seg(k, 12.4, 17, 8, 12, SEAM);
    k.blob(12.4, 10.5, 8, 6.5, 'foliage', { bump: 0.25, lobes: 9, hatching: FINE, width: SEAM });
    k.blob(7, 14.5, 4, 3, 'foliage', { bump: 0.3, lobes: 5, width: SEAM });
  },
  // Pine: a leaning trunk carrying three flat pads, the lowest widest.
  (k) => {
    trunk(k, 11, 29, 13, 5, 1.3);
    k.blob(16, 21, 6.5, 2.8, 'foliage', { bump: 0.25, lobes: 8, hatching: FINE, width: SEAM });
    k.blob(8, 14.5, 6, 2.6, 'foliage', { bump: 0.25, lobes: 8, hatching: FINE, width: SEAM });
    k.blob(13.4, 6.5, 5, 3, 'foliage', { bump: 0.25, lobes: 7, hatching: FINE, width: SEAM });
  },
];

function sourcePlant(i) {
  const page = createPage(24, 32, { seed: SEEDS.sourcePlant[i], origin: [68 + i * 32, 452] });
  const { k } = page;
  PLANTS[i](k);
  soilMound(k);
  return finishCutOut(page);
}

// The shed's south face: a gutter along the eaves (y 0.6..4.2), weatherboards
// 4 px deep down to a soil line at the foot, each board's lower edge throwing
// a thin shadow on the board below, and the bottom metre's grime. Per variant:
// a butt joint, a knot and a split.
const SHED_FACE_VARIANTS = [
  { joint: [11, 2], knot: [5, 22], split: [12, 33, 4] },
  { joint: [4, 6], knot: [11, 14], split: [3, 26, 5] },
  { joint: [8, 9], knot: [3, 37], split: [10, 17, 4] },
];

function shedFace(i) {
  const page = createPage(16, 48, { seed: SEEDS.shedFace[i], origin: [0, 208] });
  const { k } = page;
  const v = SHED_FACE_VARIANTS[i];
  k.box(-1, 4.2, 18, 41, 'wood', { edges: false, wear: false });
  k.hatchIn(rect(-1, 36, 18, 9), { spacing: 2, width: 1.1 });
  for (let y = 8.2; y < 45; y += 4) {
    k.hatchIn(rect(-1, y, 18, 0.9), FINE);
    seg(k, -1, y, 17, y);
  }
  const [jx, jRow] = v.joint;
  seg(k, jx, 4.2 + jRow * 4, jx, 8.2 + jRow * 4, MARK);
  const [kx, ky] = v.knot;
  k.blob(kx, ky, 1.2, 0.7, 'wood', { width: MARK });
  const [sx, sy, len] = v.split;
  seg(k, sx, sy, sx + len, sy + 0.3, MARK);
  k.box(-1, 0.6, 18, 3.6, 'metal', { edges: false, hatching: rect(-1, 2.6, 18, 1.6) });
  seg(k, -1, 0.6, 17, 0.6, OUTLINE);
  seg(k, -1, 4.2, 17, 4.2, OUTLINE);
  k.box(-1, 45, 18, 3, 'soil', { edges: false });
  seg(k, -1, 45, 17, 45, OUTLINE);
  return finish(page);
}

// The shed's roof: corrugated iron, its ridges running down the slope, a lap
// where one sheet overlaps the next with its row of screws, and, on one
// in three, a rust stain. Per variant: the lap's height and the stain.
const SHED_ROOF_VARIANTS = [
  { lap: 5, stain: null },
  { lap: 12, stain: [4, 4, 1.8, 2.4] },
  { lap: 1.5, stain: null },
];

function shedRoof(i) {
  const page = createPage(16, 16, { seed: SEEDS.shedRoof[i], origin: [0, 144] });
  const { k } = page;
  const v = SHED_ROOF_VARIANTS[i];
  k.box(-1, -1, 18, 18, 'metal', { edges: false });
  if (v.stain) {
    const [cx, cy, rx, ry] = v.stain;
    k.shape(oval(cx, cy, rx, ry, 2, i), 'soil', { edges: false, paper: false });
  }
  for (let x = 1; x < 16; x += 2) seg(k, x, -1, x, 17, 1);
  for (let x = 2; x < 16; x += 4) k.hatchIn(rect(x - 1, -1, 1, 18), { spacing: 1.4, width: 1 });
  seg(k, -1, v.lap, 17, v.lap, SEAM);
  for (const x of [2, 6, 10, 14]) seg(k, x, v.lap + 1, x + 0.2, v.lap + 1.3, MARK);
  return finish(page);
}

// The house's back face: a gutter along the eaves, rendered wall down to a
// stone plinth, the bottom metre's grime, and the render's own marks. Per
// variant: a hairline crack and two trowel marks.
const HOUSE_FACE_VARIANTS = [
  {
    crack: [
      [4, 14],
      [5.5, 18],
      [4.6, 22],
    ],
    trowel: [
      [9, 28],
      [2, 9],
    ],
  },
  {
    crack: [
      [12, 30],
      [10.6, 34],
      [11.4, 38],
    ],
    trowel: [
      [4, 20],
      [11, 11],
    ],
  },
  {
    crack: [
      [8, 7],
      [9.2, 10],
    ],
    trowel: [
      [12, 24],
      [3, 32],
    ],
  },
];

function houseFace(i) {
  const page = createPage(16, 48, { seed: SEEDS.houseFace[i], origin: [160, 96] });
  const { k } = page;
  const v = HOUSE_FACE_VARIANTS[i];
  k.box(-1, 4, 18, 39, 'render', { edges: false });
  k.hatchIn(rect(-1, 35, 18, 8), { spacing: 2.2, width: 1 });
  k.line(v.crack, MARK);
  for (const [x, y] of v.trowel) seg(k, x, y, x + 3, y - 0.4, 1);
  k.box(-1, 0.6, 18, 3.4, 'metal', { edges: false, hatching: rect(-1, 2.6, 18, 1.4) });
  seg(k, -1, 0.6, 17, 0.6, OUTLINE);
  seg(k, -1, 4, 17, 4, OUTLINE);
  k.box(-1, 43, 18, 5, 'stone', { edges: false });
  seg(k, -1, 43, 17, 43, OUTLINE);
  seg(k, -1, 47.6, 17, 47.6, OUTLINE);
  return finish(page);
}

// The house's roof: courses of clay tiles 4 px deep, each course's foot
// shadowed, the joints staggered course to course. Per variant: where the
// joints start, a cracked tile and a patch of moss.
const HOUSE_ROOF_VARIANTS = [
  { stagger: 0, crack: [5, 1], moss: [12, 10, 2.2, 1.2] },
  { stagger: 4, crack: [13, 2], moss: [3, 3, 1.8, 1] },
  { stagger: 2, crack: [9, 3], moss: [7, 14, 2.6, 1.1] },
];

function houseRoof(i) {
  const page = createPage(16, 16, { seed: SEEDS.houseRoof[i], origin: [0, 0] });
  const { k } = page;
  const v = HOUSE_ROOF_VARIANTS[i];
  k.box(-1, -1, 18, 18, 'tile', { edges: false });
  const [mx, my, mrx, mry] = v.moss;
  k.shape(oval(mx, my, mrx, mry, 3, i), 'foliage', { edges: false, paper: false });
  for (let row = 0; row < 4; row += 1) {
    const y = row * 4;
    k.hatchIn(rect(-1, y + 2.6, 18, 0.9), FINE);
    seg(k, -1, y + 3.5, 17, y + 3.5);
    for (let x = (v.stagger + row * 4) % 8; x < 16; x += 8)
      seg(k, x + 0.3, y, x + 0.3, y + 3.5, MARK);
  }
  const [cx, cRow] = v.crack;
  seg(k, cx, cRow * 4 + 0.4, cx + 1.4, cRow * 4 + 2.8, 1.1);
  return finish(page);
}

// A wall's cap seen from above: a beam with both edges inked, a butt joint,
// `wash` its material and `hatching` its shade. `vertical` turns the 16 x 8
// tile into an 8 x 16 one.
function capTile({ seed, origin, vertical, wash, hatching, joint }) {
  const [w, h] = vertical ? [8, 16] : [16, 8];
  const page = createPage(w, h, { seed, origin });
  const { k } = page;
  const P = (pts) => (vertical ? pts.map(([a, b]) => [b, a]) : pts);
  k.shape(P(rect(-1, 0.6, 18, 6.8)), wash, { edges: false, hatching });
  for (const across of [0.6, 7.4])
    k.line(
      P([
        [-1, across],
        [17, across],
      ]),
      OUTLINE,
    );
  k.line(
    P([
      [joint, 0.8],
      [joint, 7.2],
    ]),
    SEAM,
  );
  return finish(page);
}

const CAP_JOINTS = [6, 12, 3];

// The kitchen window in the house's back face: two casements of glass in a
// wooden frame over a stone sill.
function houseWindow() {
  const page = createPage(40, 24, { seed: SEEDS.houseWindow, origin: [204, 100] });
  const { k } = page;
  k.box(1, 1, 38, 19, 'wood');
  for (const x of [3.5, 21]) {
    k.box(x, 3.5, 15.5, 14.5, 'glass', { width: SEAM, hatching: rect(x + 9, 3.5, 6.5, 14.5) });
    seg(k, x, 10.75, x + 15.5, 10.75);
    seg(k, x + 2.5, 15, x + 6, 6, 1);
  }
  k.box(0, 19.6, 40, 3.8, 'stone');
  return finishCutOut(page);
}

// The greenhouse's roof: glass in a white frame, its bars 8 px apart down the
// slope, the light catching the panes. Per variant: the highlights, a pane's
// lap, and a leaf or the plants below showing through.
const GREENHOUSE_ROOF_VARIANTS = [
  { glints: [[2, 12]], lap: 6, below: [12, 11, 2.6, 2], leaf: null },
  { glints: [[10, 6]], lap: null, below: null, leaf: [4, 9] },
  {
    glints: [
      [3, 5],
      [11, 14],
    ],
    lap: 11,
    below: [4, 4, 2.2, 1.6],
    leaf: null,
  },
];

function greenhouseRoof(i) {
  const page = createPage(16, 16, { seed: SEEDS.greenhouseRoof[i], origin: [256, 304] });
  const { k } = page;
  const v = GREENHOUSE_ROOF_VARIANTS[i];
  k.box(-1, -1, 18, 18, 'glass', { edges: false });
  if (v.below) {
    const [bx, by, brx, bry] = v.below;
    k.shape(oval(bx, by, brx, bry, 4, i), 'foliage', { edges: false, paper: false });
  }
  for (const [x, y] of v.glints) {
    seg(k, x, y, x + 3, y - 3, 1);
    seg(k, x + 1.2, y + 0.8, x + 3.4, y - 1.4, 1);
  }
  if (v.lap !== null) {
    seg(k, 1, v.lap, 7, v.lap, 1);
    seg(k, 9, v.lap, 15, v.lap, 1);
  }
  if (v.leaf) k.blob(v.leaf[0], v.leaf[1], 1.4, 0.8, 'foliage', { width: MARK });
  for (const x of [-0.8, 7.2]) k.box(x, -1, 1.6, 18, 'paint', { width: MARK });
  return finish(page);
}

// The greenhouse's south face: a white rail along the eaves, glass between
// bars 8 px apart and a rail across the middle, plants on the staging inside
// showing through, the light on the panes, and a brick dwarf wall 0.55 m high
// at the foot. Per variant: the plants and the highlights.
const GREENHOUSE_FACE_VARIANTS = [
  { plants: [[4, 31, 3, 3]], glints: [[10, 14]] },
  {
    plants: [
      [12, 32, 3.4, 2.6],
      [5, 32.4, 2, 2],
    ],
    glints: [[2, 10]],
  },
  { plants: [], glints: [[9, 26]] },
];

function greenhouseFace(i) {
  const page = createPage(16, 48, { seed: SEEDS.greenhouseFace[i], origin: [256, 368] });
  const { k } = page;
  const v = GREENHOUSE_FACE_VARIANTS[i];
  k.box(-1, 3.6, 18, 32.4, 'glass', { edges: false });
  k.box(-1, 30, 18, 6, 'wood', { edges: false, wear: false });
  seg(k, -1, 30, 17, 30, MARK);
  for (const [x, y, rx, ry] of v.plants)
    k.blob(x, y - ry, rx, ry, 'foliage', { bump: 0.3, lobes: 6, width: MARK });
  for (const [x, y] of v.glints) {
    seg(k, x, y, x + 3, y - 4, 1);
    seg(k, x + 1.4, y + 1, x + 3.6, y - 2, 1);
  }
  for (const x of [-0.8, 7.2]) k.box(x, 3.6, 1.6, 32.4, 'paint', { width: MARK });
  k.box(-1, 18, 18, 1.4, 'paint', { width: MARK });
  k.box(-1, 0.6, 18, 3, 'paint', { edges: false, hatching: rect(-1, 2.4, 18, 1.2) });
  seg(k, -1, 0.6, 17, 0.6, OUTLINE);
  seg(k, -1, 3.6, 17, 3.6, OUTLINE);
  k.box(-1, 36, 18, 12, 'terracotta', { edges: false, wear: false });
  k.hatchIn(rect(-1, 41, 18, 7), { spacing: 2.2, width: 1 });
  for (const y of [39, 42, 45]) seg(k, -1, y, 17, y, 1);
  for (const [y, xs] of [
    [36, [3, 11]],
    [39, [7, 15]],
    [42, [3, 11]],
    [45, [7, 15]],
  ])
    for (const x of xs) seg(k, x, y, x, y + 3, 1);
  k.box(-1, 35.4, 18, 1.8, 'stone', { width: SEAM });
  seg(k, -1, 47.6, 17, 47.6, OUTLINE);
  return finish(page);
}

// One glazed leaf front-on in its frame: a large pane split by glazing bars
// over a solid kick panel, a brass handle, its bottom on the footprint's edge.
function glazedDoor() {
  const page = createPage(24, 40, { seed: SEEDS.doorGlazed, origin: [332, 104] });
  const { k } = page;
  k.box(0.8, 0.8, 22.4, 39, 'wood');
  k.box(3, 3, 18, 36.6, 'top');
  k.box(5, 5, 14, 21, 'glass', { width: SEAM, hatching: rect(13, 5, 6, 21) });
  seg(k, 12, 5, 12, 26);
  for (const y of [12, 19]) seg(k, 5, y, 19, y);
  seg(k, 6.5, 10, 9.5, 6.5, 1);
  k.box(5, 29, 14, 8.5, 'wood', { width: SEAM });
  k.blob(18.6, 27.6, 1.1, 1.1, 'brass', { width: MARK });
  return finishCutOut(page);
}

const strip = (n, draw) => () => joinStrip(Array.from({ length: n }, (_, i) => draw(i)));

const SHEETS = [
  ['spr_floor_garden', strip(3, lawnTile)],
  ['spr_fence', strip(3, fenceTile)],
  ['spr_fence_v', strip(3, fenceVTile)],
  ['spr_fence_corner', strip(4, cornerTile)],
  ['spr_gate', gate],
  ['spr_source_plant', strip(3, sourcePlant)],
  ['spr_shed_face', strip(3, shedFace)],
  ['spr_shed_roof', strip(3, shedRoof)],
  ['spr_house_face', strip(3, houseFace)],
  ['spr_house_roof', strip(3, houseRoof)],
  [
    'spr_house_cap_v',
    strip(3, (i) =>
      capTile({
        seed: SEEDS.houseCapV[i],
        origin: [408, 0],
        vertical: true,
        wash: 'cap',
        hatching: 'shadow',
        joint: CAP_JOINTS[i],
      }),
    ),
  ],
  ['spr_house_window', houseWindow],
  ['spr_greenhouse_roof', strip(3, greenhouseRoof)],
  ['spr_greenhouse_face', strip(3, greenhouseFace)],
  [
    'spr_greenhouse_cap',
    strip(3, (i) =>
      capTile({
        seed: SEEDS.greenhouseCap[i],
        origin: [256, 304],
        vertical: false,
        wash: 'paint',
        hatching: rect(-1, 5, 18, 2.4),
        joint: CAP_JOINTS[i],
      }),
    ),
  ],
  [
    'spr_greenhouse_cap_v',
    strip(3, (i) =>
      capTile({
        seed: SEEDS.greenhouseCapV[i],
        origin: [256, 304],
        vertical: true,
        wash: 'paint',
        hatching: rect(5, -1, 2.4, 18),
        joint: CAP_JOINTS[i],
      }),
    ),
  ],
  ['spr_door_glazed', glazedDoor],
];

for (const [name, draw] of SHEETS) {
  const canvas = draw();
  writePng(join(OUT, `${name}.png`), canvas);
  console.log(`public/assets/${name}.png  ${String(canvas.width)}x${String(canvas.height)}`);
}
