/**
 * The hallway, as pure data: new content (the prototype had no interiors), the
 * house's hub between the lounge and the study. A corridor: the shed's width
 * and canvas but only 64 px tall, a ring of solid walls round a two-tile floor
 * with the dark background above and below, no windows and no display spots,
 * a runner down it and a console table, neither of which stops the player,
 * and a door in each side wall. Both doors sit on the row y 190, as do the
 * doors they lead to, so every walk through the house is a straight walk along
 * that row into the wall the door is in.
 */

import { SHEETS } from './assets';
import {
  SHED_ROOM,
  fromPrototype,
  prop,
  ringWalls,
  type Furniture,
  type Rect,
  type Room,
} from './shedRoom';

/** 320x64, the shed's x 80..400 and y 160..224: wall bands at 160 and 208, the floor y 176..208 round the row y 190, on the tile grid. */
export const HALLWAY_BOUNDS: Rect = { x: 80, y: 160, w: 320, h: 64 };

/** spr_runner's 416x48 prototype px, halved: over both of the floor's green stripes (y 180..188 and 196..204). */
export const RUNNER: Furniture = {
  sheet: SHEETS.runner,
  x: 128,
  y: 180,
  w: 208,
  h: 24,
  solid: false,
};

/** spr_hall_table's 32x24 prototype px, halved: against the top wall past the runner's end, above the row y 190. */
export const HALL_TABLE: Furniture = {
  sheet: SHEETS.hallTable,
  x: 344,
  y: 176,
  w: 16,
  h: 12,
  solid: false,
};

export const HALLWAY_ROOM: Room = {
  key: 'hallway',
  width: fromPrototype(960),
  height: fromPrototype(540),
  bounds: HALLWAY_BOUNDS,
  windows: [],
  edgeMargin: SHED_ROOM.edgeMargin,
  // Where the lounge's hallway door lands, 26 px right of this room's lounge door.
  playerStart: { x: 114, y: 190 },
  walls: ringWalls(HALLWAY_BOUNDS),
  furniture: [RUNNER, HALL_TABLE],
  props: [
    // The left wall's band, prototype top-left (160, 364), back to 26 px left of the lounge's hallway door.
    {
      ...prop('door_lounge', 'Door', 'To Lounge', 160 + 16, 364 + 16, 16, 16),
      target: { room: 'lounge', x: 398, y: 190 },
    },
    // The right wall's band, prototype top-left (768, 364), to 26 px right of the study's door.
    {
      ...prop('door_study', 'Door', 'To Study', 768 + 16, 364 + 16, 16, 16),
      target: { room: 'study', x: 162, y: 190 },
    },
  ],
  // A dark warm umber behind the ring, between the shed's 0x241e18 and the lounge's 0x2a1c1a.
  floor: 0x261c16,
};
