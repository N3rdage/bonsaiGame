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
import { PAPER, PER_LOGICAL, STYLE, SUPERSAMPLE } from './style.mjs';

export { INK, PAPER, PER_LOGICAL, PROPOSAL_STYLE, STYLE, SURROUND, WASHES, palette } from './style.mjs';

/**
 * A page `width` x `height` logical px with its kit. `seed` is the sheet's own
 * (every sheet a different one, so no two share their wobble or their wear),
 * `style` the knobs and `origin` the sheet's top-left in world logical px,
 * where the paper grain is sampled.
 */
export function createPage(width, height, { seed, style = STYLE, origin = [0, 0] }) {
  const ink = createInk(width, height, { perLogical: PER_LOGICAL, ss: SUPERSAMPLE, paper: PAPER, style, seed, origin });
  return { ink, k: kit(ink, seeded(seed)) };
}

/** The finished page as an RGBA canvas, grain laid. */
export const finish = (page) => toCanvas(page.ink);
