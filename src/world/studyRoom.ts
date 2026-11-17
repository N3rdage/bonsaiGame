/**
 * The study, as pure data: new content (the prototype had no interiors), plan
 * B3's 4.5 x 4.5 m study (docs/site-plan/README.md), an indoor display room
 * east of the hallway. An inset ring of solid walls on the shed's canvas round
 * a 9 x 9 tile floor, one window in its top wall, a door to the hallway in the
 * left wall 1 m from its north end, glazed double doors out to the garden in
 * the bottom wall, and a desk and a low bookcase against the top wall, each
 * carrying a display spot.
 */

import { SHEETS } from './assets';
import {
  SHED_ROOM,
  displaySpot,
  fromPrototype,
  furnitureWalls,
  ringWalls,
  type Furniture,
  type Rect,
  type Room,
} from './shedRoom';

/** The 144x144 floor (4.5 x 4.5 m), x 160..304 and y 64..208, grown by the 16 px wall band. */
export const STUDY_BOUNDS: Rect = { x: 144, y: 48, w: 176, h: 176 };

/** spr_desk's 64x32 prototype px, halved: in the top-left corner, against both walls. */
export const DESK: Furniture = { sheet: SHEETS.desk, x: 160, y: 64, w: 32, h: 16, solid: true };

/** Three bays of spr_bookshelf (32x32 prototype px, halved) in the top-right corner, against both walls. */
export const BOOKSHELF: Furniture = {
  sheet: SHEETS.bookshelf,
  x: 256,
  y: 64,
  w: 48,
  h: 16,
  solid: true,
};

const FURNITURE = [DESK, BOOKSHELF];

export const STUDY_ROOM: Room = {
  key: 'study',
  width: fromPrototype(960),
  height: fromPrototype(540),
  bounds: STUDY_BOUNDS,
  // Between the desk and the bookcase.
  windows: [{ x: 208, w: 32 }],
  edgeMargin: SHED_ROOM.edgeMargin,
  // Where the hallway's study door lands, 26 px right of this room's door.
  playerStart: { x: 178, y: 96 },
  walls: [...ringWalls(STUDY_BOUNDS), ...furnitureWalls(FURNITURE)],
  furniture: FURNITURE,
  props: [
    // On the desk top, prototype rows 0..16 of the sprite: a walk straight up
    // from the hallway door's landing stops against the desk at (178, 81) on
    // the 1.25 px step grid, 6.3 px from the spot's centre (176, 75).
    displaySpot('pedestal_1', 'study_desk', DESK, 70),
    // On the bookcase's top board, prototype rows 0..3, over its right-hand
    // bay: a walk into the right wall and up stops against it at (303, 81),
    // 11 px from the spot's centre (296, 72.5).
    displaySpot('pedestal_2', 'study_bookshelf', BOOKSHELF, 65, 288, 16),
    // Plan B3 row 8: the left wall's band 1 m from its north end, seen from the side, back to
    // beside the hallway's study door.
    {
      key: 'door_hallway',
      label: 'Door',
      prompt: 'To Hallway',
      x: 152,
      y: 96,
      w: 16,
      h: 16,
      wall: 'W',
      target: { room: 'hallway', door: 'door_study' },
      sheet: SHEETS.doorSideW,
    },
    // Plan B3 row 9: glazed double doors to the garden in the bottom wall's band, centred 2.25 m
    // along (x 232), 1.5 m (48 px, the tile grid's nearest to the plan's 1.6 m) wide. The garden's
    // study door lands straight above them.
    {
      key: 'door_garden',
      label: 'Door',
      prompt: 'To Garden',
      x: 232,
      y: 216,
      w: 48,
      h: 16,
      wall: 'S',
      target: { room: 'garden', door: 'door_study' },
      sheet: SHEETS.doorGlass,
    },
  ],
  // A deep wine-brown behind the ring, to suit the red parquet.
  floor: 0x2a1618,
};
