// Draws the greenhouse's placeholder tiles (no prototype art exists for
// interiors), the house's glazed and side-on doors, and the floor shelf.
//
// Each sheet is drawn by a module under art/interiors/ (greenhouse, doors),
// which describes its sheets at the top; palette.mjs holds every shared
// colour and png.mjs the drawing primitives. Every module exports its sheets
// as { name, width, height, draw(png) }, and this writes them in a fixed
// order.
// Hard pixel edges, a small palette in the family of art/pixel.py's wood
// tones, and a seeded generator per frame, so a rerun reproduces the
// committed bytes.
//
// Run with `npm run art:interiors`; the output is committed.

import * as doors from './interiors/doors.mjs';
import * as greenhouse from './interiors/greenhouse.mjs';
import { write } from './interiors/png.mjs';

for (const sheet of [
  greenhouse.FLOOR,
  greenhouse.WALL,
  doors.DOUBLE_DOOR,
  doors.SINGLE_DOOR,
  doors.SIDE_DOOR_W,
  doors.SIDE_DOOR_E,
  greenhouse.FLOOR_SHELF,
]) {
  write(sheet);
}
