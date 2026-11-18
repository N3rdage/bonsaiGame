// Draws the greenhouse's placeholder tiles (no prototype art exists for
// interiors) and the floor shelf.
//
// Each sheet is drawn by art/interiors/greenhouse.mjs, which describes its
// sheets at the top; palette.mjs holds every shared colour and png.mjs the
// drawing primitives. The module exports its sheets as
// { name, width, height, draw(png) }, and this writes them in a fixed order.
// Hard pixel edges, a small palette in the family of art/pixel.py's wood
// tones, and a seeded generator per frame, so a rerun reproduces the
// committed bytes.
//
// Run with `npm run art:interiors`; the output is committed.

import * as greenhouse from './interiors/greenhouse.mjs';
import { write } from './interiors/png.mjs';

for (const sheet of [greenhouse.FLOOR, greenhouse.WALL, greenhouse.FLOOR_SHELF]) {
  write(sheet);
}
