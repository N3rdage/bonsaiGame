/**
 * The lounge, as pure data: new content (the prototype had no interiors), an
 * indoor display room through the shed's top door. It reuses the shed's
 * conventions (the same canvas, an inset ring of solid walls framed by the
 * dark background) in a shape of its own, wider and lower than the shed, with
 * two windows in its top wall, a door drawn on the bottom wall back to the
 * shed, one in the right wall on to the hallway, and a fireplace and a side
 * table carrying the two display spots that were the shed's pedestals (saves
 * from before version 4 move the shed's displayed trees onto them).
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

/**
 * 384x128, x 48..432 and y 96..224: its bottom wall is the shed's row, so the
 * shed door's square stays at x 240, and it is no taller than a phone's
 * zoomed view (135), which shows its whole height.
 */
export const LOUNGE_BOUNDS: Rect = { x: 48, y: 96, w: 384, h: 128 };

/** spr_fireplace's 64x48 prototype px, halved: against the top wall, centred between the windows on x 240. */
export const FIREPLACE: Furniture = {
  sheet: SHEETS.fireplace,
  x: 224,
  y: 112,
  w: 32,
  h: 24,
  solid: true,
};

/** spr_side_table's 32x32 prototype px, halved: in the top-right corner, against both walls. */
export const SIDE_TABLE: Furniture = {
  sheet: SHEETS.sideTable,
  x: 400,
  y: 112,
  w: 16,
  h: 16,
  solid: true,
};

const FURNITURE = [FIREPLACE, SIDE_TABLE];

export const LOUNGE_ROOM: Room = {
  key: 'lounge',
  width: fromPrototype(960),
  height: fromPrototype(540),
  bounds: LOUNGE_BOUNDS,
  windows: [
    { x: 144, w: 32 },
    { x: 304, w: 32 },
  ],
  edgeMargin: SHED_ROOM.edgeMargin,
  // Where the shed's lounge door lands, 26 px above this room's door.
  playerStart: { x: 240, y: 190 },
  walls: [...ringWalls(LOUNGE_BOUNDS), ...furnitureWalls(FURNITURE)],
  furniture: FURNITURE,
  props: [
    // On the mantel, whose shelf's top face is the sprite's prototype rows
    // 0..3: a walk straight up from the door's landing stops against the
    // fireplace at y 136.25 on the 1.25 px step grid, 11.25 px below the
    // spot's centre (240, 125).
    displaySpot('pedestal_1', 'lounge_mantel', FIREPLACE, 114),
    // On the table top, prototype rows 2..11: a walk into the right wall and
    // then up stops against the table at (415, 128.75) or (415.5, 128.75),
    // within 10 px of the spot's centre (408, 122).
    displaySpot('pedestal_2', 'lounge_side_table', SIDE_TABLE, 116),
    // The shed garden door's square in the bottom wall, back to 26 px below the shed's lounge door.
    {
      ...prop('door', 'Door', 'Back to Shed', 464 + 16, 416 + 16, 16, 16),
      target: { room: 'shed', x: 240, y: 82 },
    },
    // In the right wall (prototype top-left (832, 364)) on the row y 190, to 26 px right of the hallway's lounge door.
    {
      ...prop('door_hallway', 'Door', 'To Hallway', 832 + 16, 364 + 16, 16, 16),
      target: { room: 'hallway', x: 114, y: 190 },
    },
  ],
  // A warm dark plum-brown behind the ring, a shade redder than the shed's 0x241e18 to suit the carpet.
  floor: 0x2a1c1a,
};
