/**
 * The lounge-kitchen, as pure data: new content (the prototype had no
 * interiors), plan B3's lounge with its open-plan kitchen as one walkable room
 * (docs/site-plan/README.md), an indoor display room through the shed's top
 * door. It reuses the shed's conventions (the same canvas, an inset ring of
 * solid walls framed by the dark background): 8.5 x 4.5 m at 1 m to 32 px,
 * the hallway's 3 x 2 m block solid in its north-east corner as the back
 * garden's house and shed footprints are, the kitchen open below that block.
 * Two windows in the lounge's top wall, a door drawn on the bottom wall back
 * to the shed, one in the block's west face on to the hallway, and a
 * fireplace and a side table against the top wall carrying the two display
 * spots that were the shed's pedestals (saves from before version 4 move the
 * shed's displayed trees onto them).
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
 * The 272x144 floor (8.5 x 4.5 m), x 160..432 and y 64..208, grown by the
 * 16 px wall band: x 144..448 and y 48..224. Its bottom wall is the shed's
 * top row, so the shed door's square stays at x 240, and it fits a phone's
 * zoomed view (384x216).
 */
export const LOUNGE_BOUNDS: Rect = { x: 144, y: 48, w: 304, h: 176 };

/**
 * The hallway's 3 x 2 m (96x64) in the floor's north-east corner, x 336..432
 * and y 64..128: a solid block of the lounge's wall, the hallway door in its
 * west face. The kitchen is the floor below it, x 336..432 and y 128..208.
 */
export const HALLWAY_BLOCK: Furniture = {
  sheet: SHEETS.wallLounge,
  x: 336,
  y: 64,
  w: 96,
  h: 64,
  solid: true,
};

/** spr_fireplace's 64x48 prototype px, halved: against the top wall, centred between the windows on x 240. */
export const FIREPLACE: Furniture = {
  sheet: SHEETS.fireplace,
  x: 224,
  y: 64,
  w: 32,
  h: 24,
  solid: true,
};

/** spr_side_table's 32x32 prototype px, halved: in the top-left corner, against both walls. */
export const SIDE_TABLE: Furniture = {
  sheet: SHEETS.sideTable,
  x: 160,
  y: 64,
  w: 16,
  h: 16,
  solid: true,
};

const FURNITURE = [HALLWAY_BLOCK, FIREPLACE, SIDE_TABLE];

export const LOUNGE_ROOM: Room = {
  key: 'lounge',
  width: fromPrototype(960),
  height: fromPrototype(540),
  bounds: LOUNGE_BOUNDS,
  windows: [
    { x: 176, w: 32 },
    { x: 288, w: 32 },
  ],
  edgeMargin: SHED_ROOM.edgeMargin,
  // Where the shed's lounge door lands, 26 px above this room's door.
  playerStart: { x: 240, y: 190 },
  walls: [...ringWalls(LOUNGE_BOUNDS), ...furnitureWalls(FURNITURE)],
  furniture: FURNITURE,
  props: [
    // On the mantel, whose shelf's top face is the sprite's prototype rows
    // 0..3: a walk straight up from the shed door's landing stops against the
    // fireplace at y 88.75 on the 1.25 px step grid, 11.75 px below the
    // spot's centre (240, 77).
    displaySpot('pedestal_1', 'lounge_mantel', FIREPLACE, 66),
    // On the table top, prototype rows 2..11: a walk into the left wall and
    // then up stops against the table at (160, 80) from the shed door's
    // landing, (160.5, 81) from the hallway door's, on the 1.25 px step
    // grid, each within 10.3 px of the spot's centre (168, 74).
    displaySpot('pedestal_2', 'lounge_side_table', SIDE_TABLE, 68),
    // Plan B3 row 3: the shed garden door's square in the bottom wall, 2.5 m along, back to
    // below the shed's lounge door.
    {
      ...prop('door', 'Door', 'Back to Shed', 464 + 16, 416 + 16, 16, 16),
      wall: 'S',
      target: { room: 'shed', door: 'door_lounge' },
    },
    // Plan B3 row 4: in the hallway block's west face, 1 m from its north end, seen from the
    // side, to beside the hallway's lounge door. It lands west of the block, facing it.
    {
      key: 'door_hallway',
      label: 'Door',
      prompt: 'To Hallway',
      x: 344,
      y: 96,
      w: 16,
      h: 16,
      wall: 'E',
      target: { room: 'hallway', door: 'door_lounge' },
      sheet: SHEETS.doorSideE,
    },
  ],
  // A warm dark plum-brown behind the ring, a shade redder than the shed's 0x241e18 to suit the carpet.
  floor: 0x2a1c1a,
};
