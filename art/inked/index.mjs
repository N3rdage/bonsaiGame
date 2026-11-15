// The Inked sprite generator's entry point: what every sheet generator
// imports. A sheet is one page: `createPage` gives the page and its kit, the
// sheet draws with the kit, `finish` turns the page into an RGBA canvas at
// PER_LOGICAL art px per logical px. See art/inked/README.md.
//   paper.mjs   the shared paper grain and the noise it is made of
//   stroke.mjs  the rasteriser: polygons, pen strokes, hatching, downsampling
//   wash.mjs    pooled, bleeding watercolour washes
//   kit.mjs     the drawing vocabulary: shape, box, blob, line, shadows, wear
//   style.mjs   the palette and the knobs (STYLE, PROPOSAL_STYLE)

import { seeded } from '../interiors/png.mjs';
import { kit } from './kit.mjs';
import { createInk, toCanvas } from './stroke.mjs';
import { CUT_OUT_TOLERANCE, INK, PAPER, PER_LOGICAL, STYLE, SUPERSAMPLE } from './style.mjs';

export {
  INK,
  PAPER,
  PER_LOGICAL,
  PROPOSAL_STYLE,
  STYLE,
  SURROUND,
  WASHES,
  palette,
} from './style.mjs';

/**
 * A page `width` x `height` logical px with its kit. `seed` is the sheet's own
 * (every sheet a different one, so no two share their wobble or their wear),
 * `style` the knobs and `origin` the sheet's top-left in world logical px,
 * where the paper grain is sampled.
 */
export function createPage(width, height, { seed, style = STYLE, origin = [0, 0] }) {
  const ink = createInk(width, height, {
    perLogical: PER_LOGICAL,
    ss: SUPERSAMPLE,
    paper: PAPER,
    style,
    seed,
    origin,
  });
  return { ink, k: kit(ink, seeded(seed)) };
}

/** The finished page as an RGBA canvas, grain laid. */
export const finish = (page) => toCanvas(page.ink);

/**
 * The finished page as a cut-out sprite: every pixel of paper that reaches
 * the page's edge through other paper turns fully transparent, everything
 * else stays fully opaque. Paper inside an outline stays, so a form keeps
 * its highlights; the alpha is crisp, for an alpha test. A cut pixel takes
 * the ink's colour, so filtering at the sprite's edge darkens it into its
 * outline instead of fringing it with paper.
 */
export function finishCutOut(page) {
  const canvas = finish(page);
  const { width, height, data } = canvas;
  const isPaper = (p) =>
    Math.hypot(data[p * 4] - PAPER[0], data[p * 4 + 1] - PAPER[1], data[p * 4 + 2] - PAPER[2]) <=
    CUT_OUT_TOLERANCE;
  const seen = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x += 1) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y += 1) stack.push(y * width, y * width + width - 1);
  while (stack.length > 0) {
    const p = stack.pop();
    if (seen[p] || !isPaper(p)) continue;
    seen[p] = 1;
    data.set([...INK, 0], p * 4);
    const x = p % width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (p >= width) stack.push(p - width);
    if (p < width * (height - 1)) stack.push(p + width);
  }
  return canvas;
}
