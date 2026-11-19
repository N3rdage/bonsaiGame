/* eslint-disable no-console -- reports each texture `npm run art:viewer` writes. */
// The 3D viewer's textures, drawn in Inked (art/inked/README.md) and
// written beside the viewer that imports them:
//   src/viewer/foliage.png   a leaf cluster cut out of its paper, crisp alpha
//                            for the foliage pass's alpha test
//   src/viewer/bark.png      bark with ink grain, repeated mirrored along and
//                            around every trunk, branch and wire tube
//   src/viewer/ground.png    the round wooden slab the pot stands on, cut out,
//                            the pot's ground shadow washed into it
//   src/viewer/backdrop.png  the surround: the page washed all over in
//                            `surroundWash`, tiled behind everything
// Foliage and bark are washed near neutral (`leaf`, `bark` in style.mjs)
// because the viewer tints them with each species' colours; they are 32
// logical px square, so 128 art px. Ground and backdrop are 64 logical px, 256
// art px. Everything is seeded: a rerun reproduces the PNGs byte for byte.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { writePng } from './canvas.mjs';
import { createPage, finish, finishCutOut } from './index.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'viewer');
const SIZE = 32;

/** One seed per texture, written out so adding a texture never moves another's. */
const SEEDS = {
  foliage: 0x7e1f,
  bark: 0xb3a4,
  ground: 0x6d52,
  backdrop: 0xd0c8,
};

// The viewer shows these textures five or six times smaller than they are
// drawn (a leaf quad is some 20 px on screen), so their ink is drawn that much
// heavier than a room's, to land on screen at a room's 1.5 to 4 px.
const OUTLINE_WIDTH = 9;
const MARK_WIDTH = 5;
const HATCH = { spacing: 3.2, width: 4.5 };

/** Foliage pads: back to front, each a lobed blob, the lower ones hatched on their shadow side. */
const PADS = [
  { cx: 11, cy: 12, rx: 7, ry: 5.5, lobes: 9 },
  { cx: 21, cy: 11, rx: 6.5, ry: 5, lobes: 8 },
  { cx: 16, cy: 18, rx: 9.5, ry: 6.5, lobes: 11 },
  { cx: 9, cy: 22, rx: 5.5, ry: 4, lobes: 7, hatching: HATCH },
  { cx: 23, cy: 22, rx: 6, ry: 4, lobes: 7, hatching: HATCH },
];

/** Short leaf marks inside the upper pads, as a pen marks foliage. */
const MARKS = [
  [9, 10, 11.5, 9],
  [19.5, 9, 22, 8.5],
  [14, 17, 16.5, 16],
];

function foliage() {
  const page = createPage(SIZE, SIZE, { seed: SEEDS.foliage });
  const { k } = page;
  for (const { cx, cy, rx, ry, lobes, hatching } of PADS) {
    k.blob(cx, cy, rx, ry, 'leaf', { bump: 0.3, lobes, hatching, width: OUTLINE_WIDTH });
  }
  for (const [x0, y0, x1, y1] of MARKS) {
    k.line(
      [
        [x0, y0],
        [x1, y1],
      ],
      MARK_WIDTH,
    );
  }
  return finishCutOut(page);
}

/** Bark grain: long wobbling lines down the texture (along the tube), at these x positions. */
const GRAIN = [
  { x: 3, sway: 0.8 },
  { x: 11, sway: -1 },
  { x: 19, sway: 0.7 },
  { x: 27, sway: -0.8 },
];

/** Short splits between the grain lines: x, top y, length. */
const SPLITS = [
  [7, 4, 6],
  [15, 18, 7],
  [23, 8, 5],
  [30.5, 22, 6],
];

/** Patches of hatching in the bark's furrows. */
const FURROWS = [
  [
    [13, 5],
    [17.5, 5],
    [17.5, 12],
    [13, 12],
  ],
  [
    [21, 20],
    [25.5, 20],
    [25.5, 27],
    [21, 27],
  ],
];

function bark() {
  const page = createPage(SIZE, SIZE, { seed: SEEDS.bark });
  const { k } = page;
  k.box(-1, -1, SIZE + 2, SIZE + 2, 'bark', { edges: false });
  for (const { x, sway } of GRAIN) {
    k.line(
      [
        [x, -2],
        [x + sway, 8],
        [x - sway, 16],
        [x + sway, 24],
        [x, SIZE + 2],
      ],
      OUTLINE_WIDTH - 2,
    );
  }
  for (const [x, y, h] of SPLITS) {
    k.line(
      [
        [x, y],
        [x + 0.3, y + h],
      ],
      MARK_WIDTH,
    );
  }
  for (const furrow of FURROWS) k.hatchIn(furrow, HATCH);
  return finish(page);
}

/**
 * The slab and its shadow, logical px. `src/viewer/ground.ts` derives these
 * from the pot's geometry and the light (`groundShadowPx`), and its test pins
 * them to this table: the slab's radius `GROUND_DISC_PX` in a page
 * `GROUND_TEXTURE_SIZE` square, the pool centred where the pot's mid-height
 * falls away from the light.
 */
const GROUND = {
  size: 64,
  disc: 29,
  shadow: { cx: 29.02, cy: 33.19, r: 21.34 },
};

function ground() {
  const { size, disc, shadow } = GROUND;
  const page = createPage(size, size, { seed: SEEDS.ground });
  const { k } = page;
  k.blob(size / 2, size / 2, disc, disc, 'floor');
  k.groundShadow(shadow.cx, shadow.cy, shadow.r, shadow.r);
  return finishCutOut(page);
}

/** The backdrop: one grain period square, as `paperSheet.mjs` lays the rooms' surround. */
const BACKDROP = { size: 64, oversize: 16 };

function backdrop() {
  const { size, oversize } = BACKDROP;
  const page = createPage(size, size, { seed: SEEDS.backdrop, origin: [0, 0] });
  page.k.box(-oversize, -oversize, size + 2 * oversize, size + 2 * oversize, 'surroundWash', {
    edges: false,
    wear: false,
  });
  return finish(page);
}

for (const [name, draw] of [
  ['foliage', foliage],
  ['bark', bark],
  ['ground', ground],
  ['backdrop', backdrop],
]) {
  const canvas = draw();
  writePng(join(OUT, `${name}.png`), canvas);
  console.log(`src/viewer/${name}.png  ${String(canvas.width)}x${String(canvas.height)}`);
}
