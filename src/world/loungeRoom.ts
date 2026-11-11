/**
 * The lounge, as pure data: new content (the prototype had no interiors), an
 * indoor display room through the shed's top door. It reuses the shed's
 * conventions (the same canvas, an inset ring of solid walls framed by the
 * dark background) in a shape of its own, wider and lower than the shed, with
 * two windows in its top wall, a door drawn on the bottom wall back to the
 * shed, one in the right wall on to the hallway, and the two display pedestals
 * that were the shed's (saves from before version 4 move the shed's displayed
 * trees onto them).
 */

import { SHED_ROOM, fromPrototype, prop, ringWalls, type Rect, type Room } from './shedRoom';

/**
 * 384x128, x 48..432 and y 96..224: its bottom wall is the shed's row, so the
 * shed door's square stays at x 240, and it is no taller than a phone's
 * zoomed view (135), which shows its whole height.
 */
export const LOUNGE_BOUNDS: Rect = { x: 48, y: 96, w: 384, h: 128 };

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
  walls: ringWalls(LOUNGE_BOUNDS),
  props: [
    // In the top corners, within reach of a player stopped by both walls
    // ((65, 112.5) or (415, 112.5) from the door's landing on the 1.25 px step
    // grid, (64.25, 112.5) or (415.5, 112.5) from the hallway's), so a walk
    // into the corner always ends with the pedestal in range.
    {
      ...prop('pedestal_1', 'Pedestal', 'Use Pedestal', 136, 256, 16, 16),
      pedestalKey: 'lounge_mantel',
    },
    {
      ...prop('pedestal_2', 'Pedestal', 'Use Pedestal', 824, 256, 16, 16),
      pedestalKey: 'lounge_side_table',
    },
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
