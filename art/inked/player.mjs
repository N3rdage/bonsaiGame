/* eslint-disable no-console -- reports the sheet `npm run art:player` writes. */
// The player, drawn in Inked (art/inked/README.md) and written to
// public/assets/spr_player.png: a gardener about 1.7 m tall at the scale
// rule's 16 x 32 logical px, 16 frames in one horizontal strip. The frames
// run in rows of four, facing down, up, left and right (src/world/assets.ts's
// `playerFrame`), each row the walk cycle: standing (also the contact pose),
// step A, contact again, step B. A step swings the legs and the arms against
// each other. Left and right are one drawing, mirrored.
//
// The feet stand on the frame's bottom edge, which the world sets 12 logical
// px below the player's position (PLAYER_FEET in src/world/assets.ts). No
// ground shadow is drawn here: the world lays the player's drop shadow live
// (roomArt.ts's `playerShadow`), and the cut-out would make a painted one
// opaque. One page for the whole sheet on one seed, cut out of its paper so
// the figure has crisp alpha. Everything is seeded: a rerun reproduces the
// PNG byte for byte.

import { join } from 'node:path';

import { writePng } from './canvas.mjs';
import { createPage, finishCutOut } from './index.mjs';

const OUT = join(import.meta.dirname, '..', '..', 'public', 'assets', 'spr_player.png');
/** A frame, logical px. */
const W = 16;
const H = 32;
/** The facings, in the sheet's row order. */
const FACINGS = ['down', 'up', 'left', 'right'];
/** The walk cycle, in frame order: the swing of each pose (step A forward on the near side, step B back). */
const SWING = [0, 1, 0, -1];
/** The sheet's seed, written out. */
const SEED = 0x5f16;

/** Ink widths, art px: the body's outline, the limbs' and the small marks (eyes, collar). */
const BODY = 2.4;
const LIMB = 2.1;
const MARK = 1.7;
/** Hatching on the shadow side, finer than a room's to suit a 16 px figure. */
const HATCH = { spacing: 1.1, width: 1.2 };

const page = createPage(W * FACINGS.length * SWING.length, H, { seed: SEED, origin: [0, 0] });
const { k } = page;

/**
 * The drawing calls for one frame at column `ox`, in frame-local logical px;
 * `mirror` flips x, so a right-facing frame is the left-facing one turned.
 */
function pen(ox, mirror) {
  const X = (x) => ox + (mirror ? W - x : x);
  const P = (pts) => pts.map(([x, y]) => [X(x), y]);
  const form = (pts, wash, opts = {}) => {
    k.shape(P(pts), wash, opts);
    if (opts.shade) k.hatchIn(P(opts.shade), HATCH);
  };
  const rect = (x, y, w, h) => [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
  /** A limb from `a` to `b`, `w` wide: a quad round the bone. */
  const limb = ([ax, ay], [bx, by], w, wash, opts = {}) => {
    const len = Math.hypot(bx - ax, by - ay);
    const n = [(-(by - ay) / len) * (w / 2), ((bx - ax) / len) * (w / 2)];
    form(
      [
        [ax + n[0], ay + n[1]],
        [bx + n[0], by + n[1]],
        [bx - n[0], by - n[1]],
        [ax - n[0], ay - n[1]],
      ],
      wash,
      { width: LIMB, ...opts },
    );
  };
  const blob = ([cx, cy], rx, ry, wash, opts = {}) => k.blob(X(cx), cy, rx, ry, wash, opts);
  const mark = (pts) => k.line(P(pts), MARK);
  return { form, rect, limb, blob, mark };
}

/** Boots: dark leather, washed as the hair's brown; the toe points along `toe` (-1 left, 0 square on). */
function boot(d, [fx, fy], toe) {
  const back = toe === 0 ? 1.7 : toe < 0 ? 1.1 : 2.1;
  const front = toe === 0 ? 1.7 : toe < 0 ? 2.1 : 1.1;
  d.form(d.rect(fx - front, fy - 0.7, back + front, 1.6), 'hair', { width: LIMB, wear: false });
}

/** Facing down (`back` false) or up (`back` true): the figure square on, legs and arms swinging in depth. */
function squareOn(d, swing, back) {
  // A leg stepping towards the viewer lands low; the other lifts at the knee. Up, the sides swap.
  const s = back ? -swing : swing;
  const footL = [6.3, 30.4 + (s > 0 ? 0.3 : s < 0 ? -1.4 : 0)];
  const footR = [9.7, 30.4 + (s < 0 ? 0.3 : s > 0 ? -1.4 : 0)];
  d.limb([6.4, 20.4], footL, 3, 'trousers');
  d.limb([9.6, 20.4], footR, 3, 'trousers');
  boot(d, footL, 0);
  boot(d, footR, 0);
  d.form(d.rect(4.7, 18.6, 6.6, 3.4), 'trousers');
  d.form(
    [
      [4.2, 10.4],
      [5.4, 9.2],
      [10.6, 9.2],
      [11.8, 10.4],
      [11.4, 19.6],
      [4.6, 19.6],
    ],
    'shirt',
    {
      width: BODY,
      shade: [
        [9.9, 9.6],
        [11.5, 10.5],
        [11.2, 19.4],
        [9.9, 19.4],
      ],
    },
  );
  if (!back)
    d.mark([
      [6.9, 9.5],
      [8, 11],
      [9.1, 9.5],
    ]);
  // Each arm swings against its own side's leg.
  const handL = [3.5, 17 - 0.8 * s];
  const handR = [12.5, 17 + 0.8 * s];
  d.limb([4.8, 10.6], handL, 2.2, 'shirt');
  d.limb([11.2, 10.6], handR, 2.2, 'shirt');
  d.blob(handL, 1.1, 1.1, 'skin', { width: LIMB });
  d.blob(handR, 1.1, 1.1, 'skin', { width: LIMB });
  if (back) {
    d.blob([8, 5.8], 3.3, 3.7, 'hair', { width: BODY });
    d.mark([
      [7.2, 3.4],
      [7.9, 5.6],
      [7.6, 7.8],
    ]);
    return;
  }
  d.blob([8, 5.8], 3.3, 3.7, 'skin', { width: BODY });
  d.form(
    [
      [4.5, 6.4],
      [4.6, 4],
      [5.8, 2.4],
      [8, 1.7],
      [10.2, 2.4],
      [11.4, 4],
      [11.5, 6.4],
      [10.6, 5],
      [9, 4.6],
      [7.6, 5.2],
      [6.2, 4.7],
      [5.3, 5.4],
    ],
    'hair',
    { width: LIMB },
  );
  d.mark([
    [6.8, 6.7],
    [6.8, 7.4],
  ]);
  d.mark([
    [9.2, 6.7],
    [9.2, 7.4],
  ]);
}

/** Facing left (mirrored for right): in profile, the near limbs swinging forward on step A, the far ones back. */
function profile(d, s) {
  const near = { foot: [7.6 - 2.8 * s, 30.4], hand: [8 - 2.6 * s, 17 - 0.4 * Math.abs(s)] };
  const far = {
    foot: [8.4 + 2.8 * s, 30.4 - 0.3 * Math.abs(s)],
    hand: [8 + 2.6 * s, 17 - 0.4 * Math.abs(s)],
  };
  if (s !== 0) {
    d.limb([8.4, 10.8], far.hand, 2.1, 'shirt', { hatching: true });
    d.blob(far.hand, 1, 1, 'skin', { width: LIMB });
  }
  d.limb([8.4, 20.4], far.foot, 2.8, 'trousers', { hatching: true });
  boot(d, far.foot, -1);
  d.limb([7.8, 20.4], near.foot, 2.8, 'trousers');
  boot(d, near.foot, -1);
  d.form(d.rect(5.8, 18.6, 4.6, 3.2), 'trousers');
  d.form(
    [
      [5.6, 10.4],
      [6.6, 9.2],
      [9.6, 9.2],
      [10.6, 10.6],
      [10.4, 19.6],
      [5.8, 19.6],
    ],
    'shirt',
    {
      width: BODY,
      shade: [
        [9, 9.6],
        [10.4, 10.7],
        [10.2, 19.4],
        [9, 19.4],
      ],
    },
  );
  d.blob([7.6, 5.8], 3.1, 3.7, 'skin', { width: BODY });
  d.form(
    [
      [5, 4.6],
      [5.6, 2.8],
      [7.4, 1.8],
      [9.6, 2.2],
      [10.9, 3.8],
      [11, 6.6],
      [10.2, 8.6],
      [9, 9],
      [8.6, 6.4],
      [7.6, 5],
      [6.2, 4.8],
    ],
    'hair',
    { width: LIMB },
  );
  d.mark([
    [5.7, 6.3],
    [5.7, 7],
  ]);
  d.mark([
    [4.6, 6.5],
    [4.1, 7.4],
    [4.7, 7.6],
  ]);
  d.limb([8, 10.8], near.hand, 2.2, 'shirt');
  d.blob(near.hand, 1.1, 1.1, 'skin', { width: LIMB });
}

FACINGS.forEach((facing, row) => {
  SWING.forEach((swing, step) => {
    const d = pen((row * SWING.length + step) * W, facing === 'right');
    if (facing === 'down' || facing === 'up') squareOn(d, swing, facing === 'up');
    else profile(d, swing);
  });
});

const canvas = finishCutOut(page);
writePng(OUT, canvas);
console.log(`public/assets/spr_player.png  ${String(canvas.width)}x${String(canvas.height)}`);
