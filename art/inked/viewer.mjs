/* eslint-disable no-console -- reports each texture `npm run art:viewer` writes. */
// The 3D viewer's two textures, drawn in Inked (art/inked/README.md) and
// written beside the viewer that imports them:
//   src/viewer/foliage.png  a leaf cluster cut out of its paper, crisp alpha
//                           for the foliage pass's alpha test
//   src/viewer/bark.png     bark with ink grain, repeated mirrored along and
//                           around every trunk, branch and wire tube
// Both are washed near neutral (`leaf`, `bark` in style.mjs) because the
// viewer tints them with each species' colours. 32 logical px square, so
// 128 art px. Everything is seeded: a rerun reproduces the PNGs byte for byte.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { writePng } from '../proposal/canvas.mjs';
import { createPage, finish, finishCutOut } from './index.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'viewer');
const SIZE = 32;

/** One seed per texture, written out so adding a texture never moves another's. */
const SEEDS = {
  foliage: 0x7e1f,
  bark: 0xb3a4,
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

for (const [name, draw] of [
  ['foliage', foliage],
  ['bark', bark],
]) {
  const canvas = draw();
  writePng(join(OUT, `${name}.png`), canvas);
  console.log(`src/viewer/${name}.png  ${String(canvas.width)}x${String(canvas.height)}`);
}
