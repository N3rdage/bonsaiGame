// Draws the house rooms' placeholder tiles (no prototype art exists for
// interiors), the glazed doors and window, the house and greenhouse
// furniture, and the buildings' roofs seen from the garden.
//
// Each sheet is drawn by a module under art/interiors/ (lounge, hallway,
// study, greenhouse, doors, roof), which describes its sheets at the
// top; palette.mjs holds every shared colour and png.mjs the drawing
// primitives. Every module exports its sheets as { name, width, height,
// draw(png) }, and this writes them in a fixed order.
// Hard pixel edges, a small palette in the family of art/pixel.py's wood
// tones, and a seeded generator per frame, so a rerun reproduces the
// committed bytes.
//
// Run with `npm run art:interiors`; the output is committed.

import * as doors from './interiors/doors.mjs';
import * as greenhouse from './interiors/greenhouse.mjs';
import * as hallway from './interiors/hallway.mjs';
import * as lounge from './interiors/lounge.mjs';
import { write } from './interiors/png.mjs';
import * as roof from './interiors/roof.mjs';
import * as study from './interiors/study.mjs';

for (const sheet of [
  lounge.FLOOR,
  lounge.WALL,
  hallway.FLOOR,
  hallway.WALL,
  study.FLOOR,
  study.WALL,
  greenhouse.FLOOR,
  greenhouse.WALL,
  doors.WINDOW,
  doors.DOUBLE_DOOR,
  doors.SINGLE_DOOR,
  lounge.FIREPLACE,
  lounge.SIDE_TABLE,
  study.DESK,
  study.BOOKSHELF,
  hallway.HALL_RUNNER,
  hallway.HALL_TABLE,
  roof.ROOF,
  greenhouse.FLOOR_SHELF,
]) {
  write(sheet);
}
