/* eslint-disable no-console -- reports each sheet a house generator writes. */
// Drawing the house's generators share, the three rooms' (lounge.mjs,
// hallway.mjs, study.mjs) and the doors' (doors.mjs), and the greenhouse's
// (greenhouse.mjs) and its placeables' (placeables.mjs): the ink widths, a face
// tile's cornice and skirting, the 8 px cap of a plastered wall, a window on
// the face with daylight washed into its panes, and the loop that writes a
// generator's sheets. Each generator's own drawing stays in its file; this
// holds only what they draw alike.

import { join } from 'node:path';

import { joinStrip, writePng } from './canvas.mjs';
import { createPage, finish } from './index.mjs';

const OUT = join(import.meta.dirname, '..', '..', 'public', 'assets');

/** Ink widths, art px: an outline, a tile's seams, a small mark. */
export const OUTLINE = 2.6;
export const SEAM = 1.8;
export const MARK = 1.5;
/** Hatching for small forms, finer than the kit's default. */
export const FINE = { spacing: 1.2, width: 1.2 };

export const rect = (x, y, w, h) => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** One straight ink line from (x0, y0) to (x1, y1). */
export const seg = (k, x0, y0, x1, y1, width = SEAM) =>
  k.line(
    [
      [x0, y0],
      [x1, y1],
    ],
    width,
  );

/**
 * A 16 x 48 face tile's two bands: the painted cornice where the wall meets
 * the ceiling (y 0..3.5) and the painted skirting on the floor line (y 43..48),
 * its foot shaded. Drawn after the wall between them.
 */
export function faceBands(k) {
  k.box(-1, -1, 18, 4.5, 'paint', { edges: false });
  seg(k, -1, 1.8, 17, 1.8, MARK);
  seg(k, -1, 3.5, 17, 3.5, OUTLINE);
  k.box(-1, 43, 18, 5, 'paint', { edges: false });
  k.hatchIn(rect(-1, 46, 18, 1.6), FINE);
  seg(k, -1, 43, 17, 43, OUTLINE);
  seg(k, -1, 47.6, 17, 47.6, OUTLINE);
}

/**
 * A house wall's 8 px cap: the top of a 25 cm plastered wall seen from above,
 * both edges inked, its far half hatched, and a hairline crack in the plaster
 * at `crack` along it. `vertical` gives the side walls' 8 x 16 tile, else the
 * south wall's 16 x 8; `origin` is where the run starts in the room.
 */
export function capTile(seed, vertical, origin, crack) {
  const [w, h] = vertical ? [8, 16] : [16, 8];
  const page = createPage(w, h, { seed, origin });
  const { k } = page;
  const P = (pts) => (vertical ? pts.map(([a, b]) => [b, a]) : pts);
  k.shape(P(rect(-1, 0.6, 18, 6.8)), 'render', { edges: false, hatching: P(rect(-1, 4.4, 18, 3)) });
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
      [crack, 1.4],
      [crack + 0.8, 3.4],
      [crack + 0.4, 5],
    ]),
    1,
  );
  return finish(page);
}

/**
 * A window on the face, 24 px tall: a painted frame from `x0` for `w` across
 * (y 1..20.5), two casements of two panes each with the far side of each
 * pane hatched, daylight washed across the glass in a slanting band, and a
 * painted sill (y 19.6..23.4) running past the frame. The room draws its
 * curtains or blind over it.
 */
export function faceWindow(k, x0, w) {
  k.box(x0, 1, w, 19.5, 'paint');
  const pw = (w - 6) / 2;
  for (const px of [x0 + 2.5, x0 + 3.5 + pw]) {
    k.box(px, 3.5, pw, 15, 'glass', {
      width: SEAM,
      hatching: rect(px + pw * 0.62, 3.5, pw * 0.38, 15),
    });
    seg(k, px, 11, px + pw, 11);
  }
  k.shape(
    [
      [x0 + 3, 16],
      [x0 + w * 0.55, 3.8],
      [x0 + w * 0.8, 3.8],
      [x0 + w * 0.3, 18],
    ],
    'lamp',
    { edges: false, paper: false, wear: false },
  );
  k.box(x0 - 1.5, 19.6, w + 3, 3.8, 'paint');
}

/** Three variants drawn by `tile(i)`, each on its own page, joined into one strip. */
export const variants = (tile) => joinStrip([0, 1, 2].map(tile));

/** Writes each `[name, draw]` sheet to public/assets/<name>.png and reports it. */
export function writeSheets(sheets) {
  for (const [name, draw] of sheets) {
    const canvas = draw();
    writePng(join(OUT, `${name}.png`), canvas);
    console.log(`public/assets/${name}.png  ${String(canvas.width)}x${String(canvas.height)}`);
  }
}
