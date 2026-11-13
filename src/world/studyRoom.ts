/**
 * The study, as pure data: new content (the prototype had no interiors), an
 * indoor display room at the end of the hallway. A small room (an inset ring
 * of solid walls on the shed's canvas, narrower than the shed), one window in
 * its top wall, a door to the hallway in the left wall on the row y 190, glazed
 * double doors out to the garden in the bottom wall, and a desk and a low
 * bookcase against the top wall, each carrying a display spot.
 */

import { SHEETS } from './assets';
import {
  SHED_ROOM,
  displaySpot,
  fromPrototype,
  furnitureWalls,
  prop,
  ringWalls,
  type Furniture,
  type Rect,
  type Room,
} from './shedRoom';

/** 224x128, x 128..352 and y 96..224, centred on the canvas's x 240 and smaller than a phone's zoomed view (240x135). */
export const STUDY_BOUNDS: Rect = { x: 128, y: 96, w: 224, h: 128 };

/** spr_desk's 64x32 prototype px, halved: in the top-left corner, against both walls. */
export const DESK: Furniture = { sheet: SHEETS.desk, x: 144, y: 112, w: 32, h: 16, solid: true };

/** Three bays of spr_bookshelf (32x32 prototype px, halved) in the top-right corner, right of the window. */
export const BOOKSHELF: Furniture = {
  sheet: SHEETS.bookshelf,
  x: 288,
  y: 112,
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
  windows: [{ x: 224, w: 32 }],
  edgeMargin: SHED_ROOM.edgeMargin,
  // Where the hallway's study door lands, 26 px right of this room's door.
  playerStart: { x: 162, y: 190 },
  walls: [...ringWalls(STUDY_BOUNDS), ...furnitureWalls(FURNITURE)],
  furniture: FURNITURE,
  props: [
    // On the desk top, prototype rows 0..16 of the sprite: a walk into the
    // left wall from the landing and then up stops against the desk at
    // (144.5, 128.75) on the 1.25 px step grid, 16.5 px from the spot's centre (160, 123).
    displaySpot('pedestal_1', 'study_desk', DESK, 118),
    // On the bookcase's top board, prototype rows 0..3, over its right-hand
    // bay: a walk into the right wall and up stops against it at (335.75, 128.75),
    // 11.3 px from the spot's centre (328, 120.5).
    displaySpot('pedestal_2', 'study_bookshelf', BOOKSHELF, 113, 320, 16),
    // The left wall's band, prototype top-left (256, 364), back to beside the hallway's study door.
    {
      ...prop('door_hallway', 'Door', 'To Hallway', 256 + 16, 364 + 16, 16, 16),
      wall: 'W',
      target: { room: 'hallway', door: 'door_study' },
    },
    // Glazed double doors to the garden in the bottom wall's band, x 304..336, just left of the
    // corner tile. A walk into the right wall and down stops at (335.75, 207.5) on the 1.25 px
    // step grid, 17.9 px from the doors' centre; the garden's study door lands left of it.
    {
      ...prop('door_garden', 'Door', 'To Garden', 640, 432, 32, 16),
      wall: 'S',
      target: { room: 'garden', door: 'door_study' },
      sheet: SHEETS.doorGlass,
    },
  ],
  // A deep wine-brown behind the ring, to suit the red parquet.
  floor: 0x2a1618,
};
