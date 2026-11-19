// The greenhouse interior, drawn in Inked (art/inked/README.md) at the scale
// rule's heights and written to public/assets/, sizes in logical px:
//   spr_floor_greenhouse  3 variants of a 16 x 16 tile of stone paving, a
//                         0.5 m flag whole or split in two, a neutral grey,
//                         wash pooled in the joints, scattered by the floor's hash
//                         (src/world/assets.ts's `floorFrame`)
//   spr_greenhouse_wall   3 variants of the back wall's face, 16 x 48 (2.4 m),
//                         its bottom edge on the floor line: the glass house
//                         seen from inside, the garden's spr_greenhouse_face
//                         from its other side
// The side and south walls are the garden's frame rails, spr_greenhouse_cap
// and spr_greenhouse_cap_v (garden.mjs): the top of the same white frame,
// seen from above inside as out. The door is the garden's glazed leaf,
// spr_door_glazed.
//
// A repeated tile has three variants, each on its own page and seed, joined
// into one strip. Every page has its own seed in SEEDS, written out, and its
// origin where its run starts in the greenhouse. Everything is seeded: a
// rerun reproduces the PNGs byte for byte.

import { JOINT, MARK, OUTLINE, SEAM, rect, seg, variants, writeSheets } from './house.mjs';
import { createPage, finish } from './index.mjs';

/** One seed per page, written out so adding a page never moves another's. */
const SEEDS = {
  floor: [0x8e00, 0x8e01, 0x8e02],
  wall: [0x8e10, 0x8e11, 0x8e12],
};

/**
 * A joint between slabs from (x0, y0) to (x1, y1): the wash pooled in it as a
 * thin shadow, then its ink.
 */
function joint(k, x0, y0, x1, y1) {
  const across = x0 === x1 ? rect(x0 - 0.4, y0, 0.8, y1 - y0) : rect(x0, y0 - 0.4, x1 - x0, 0.8);
  k.shape(across, 'shadow', { edges: false, paper: false, wear: false });
  seg(k, x0, y0, x1, y1, JOINT);
}

// The paving: a 0.5 m flag to a tile, its joints drawn at its bottom and its
// right, as the study's parquet's. The flags are glazed twice, a warm
// `terracotta` underwash under `metal`'s cool blue-grey, so they land a
// neutral grey darker than the glass and the frame. Per variant: a joint splitting the flag into two
// smaller slabs (from (x0, y0) to (x1, y1), or none), so the scattered tiles
// lay an irregular paving rather than a grid; one variant has a crack across
// a slab and one moss in a joint (a blob of `foliage` at its x, y).
const PAVING_VARIANTS = [
  { split: null, crack: [3, 2.4, 6, 7], moss: [] },
  { split: [-1, 9.5, 15.75, 9.5], crack: null, moss: [[15.75, 9.5]] },
  { split: [6.5, -1, 6.5, 15.75], crack: null, moss: [] },
];

function pavingTile(i) {
  const page = createPage(16, 16, { seed: SEEDS.floor[i], origin: [160, 80] });
  const { k } = page;
  const v = PAVING_VARIANTS[i];
  k.box(-1, -1, 18, 18, 'terracotta', { edges: false, wear: false });
  k.box(-1, -1, 18, 18, 'metal', { edges: false, paper: false, wear: false });
  joint(k, -1, 15.75, 17, 15.75);
  joint(k, 15.75, -1, 15.75, 17);
  if (v.split) joint(k, ...v.split);
  if (v.crack) {
    const [x0, y0, x1, y1] = v.crack;
    k.line(
      [
        [x0, y0],
        [(x0 + x1) / 2 + 0.6, (y0 + y1) / 2],
        [x1, y1],
      ],
      1,
    );
  }
  for (const [mx, my] of v.moss)
    k.blob(mx, my, 1.4, 0.7, 'foliage', { bump: 0.3, lobes: 4, width: 1 });
  return finish(page);
}

// The back wall's face from inside, as garden.mjs's greenhouseFace is from
// outside: the white eaves rail (y 0.6..3.6), glass between bars 8 px apart
// and a rail across the middle (y 18), and the brick dwarf wall 0.55 m high
// at the foot under its stone sill (y 35.4..37.2), its foot on the floor line.
// Through the lower panes the garden shows green, the `outside` wash rising
// to a hedge line; the upper panes are pale glass, left calm. The dwarf
// wall's bricks are thin courses with no hatching. Per variant: the hedge
// line's bumps, and on one variant in three a shrub over it and a glint.
const WALL_VARIANTS = [
  { hedge: [27, 25.4, 26.6, 24.8], crown: [11, 22.6, 3.4, 3], glints: [[2, 12]] },
  { hedge: [25.6, 26.8, 25, 26.2], crown: null, glints: [] },
  { hedge: [26.4, 25, 27.2, 25.8], crown: null, glints: [] },
];

function wallTile(i) {
  const page = createPage(16, 48, { seed: SEEDS.wall[i], origin: [160, 32] });
  const { k } = page;
  const v = WALL_VARIANTS[i];
  k.box(-1, 3.6, 18, 32.4, 'glass', { edges: false });
  const [h0, h1, h2, h3] = v.hedge;
  const hedge = [
    [-1, h0],
    [3, h1],
    [7, h2 - 0.6],
    [10, h2],
    [13.6, h3],
    [17, h0],
    [17, 36],
    [-1, 36],
  ];
  k.shape(hedge, 'outside', { edges: false, paper: false, wear: false });
  k.line(hedge.slice(0, 6), 1);
  if (v.crown) {
    const [cx, cy, rx, ry] = v.crown;
    k.blob(cx, cy, rx, ry, 'outside', { bump: 0.3, lobes: 5, width: 1.2 });
  }
  for (const [x, y] of v.glints) {
    seg(k, x, y, x + 3, y - 4, 0.8);
  }
  for (const x of [-0.8, 7.2]) k.box(x, 3.6, 1.6, 32.4, 'paint', { width: MARK });
  k.box(-1, 18, 18, 1.4, 'paint', { width: MARK });
  k.box(-1, 0.6, 18, 3, 'paint', { edges: false });
  seg(k, -1, 0.6, 17, 0.6, OUTLINE);
  seg(k, -1, 3.6, 17, 3.6, OUTLINE);
  k.box(-1, 36, 18, 12, 'terracotta', { edges: false, wear: false });
  for (const y of [39, 42, 45]) seg(k, -1, y, 17, y, 0.8);
  for (const [y, xs] of [
    [36, [3, 11]],
    [39, [7, 15]],
    [42, [3, 11]],
    [45, [7, 15]],
  ])
    for (const x of xs) seg(k, x, y, x, y + 3, 0.8);
  k.box(-1, 35.4, 18, 1.8, 'stone', { width: SEAM });
  seg(k, -1, 47.6, 17, 47.6, OUTLINE);
  return finish(page);
}

writeSheets([
  ['spr_floor_greenhouse', () => variants(pavingTile)],
  ['spr_greenhouse_wall', () => variants(wallTile)],
]);
