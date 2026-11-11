/**
 * The lounge, as pure data: new content (the prototype had no interiors), an
 * indoor display room through the shed's top door. It reuses the shed's
 * conventions: the same canvas and inset ring (so the dark background frames
 * it and the camera clamp and floor grid work unchanged), solid walls, a door
 * drawn on the bottom wall, and two display pedestals.
 */

import { SHED_BOUNDS, SHED_ROOM, fromPrototype, prop, ringWalls, type Room } from './shedRoom';

export const LOUNGE_ROOM: Room = {
  key: 'lounge',
  width: fromPrototype(960),
  height: fromPrototype(540),
  bounds: SHED_BOUNDS,
  edgeMargin: SHED_ROOM.edgeMargin,
  // Where the shed's lounge door lands, 26 px above this room's door.
  playerStart: { x: 240, y: 190 },
  walls: ringWalls(SHED_BOUNDS),
  props: [
    {
      ...prop('pedestal_1', 'Pedestal', 'Use Pedestal', 400, 170, 16, 16),
      pedestalKey: 'lounge_main',
    },
    {
      ...prop('pedestal_2', 'Pedestal', 'Use Pedestal', 560, 170, 16, 16),
      pedestalKey: 'lounge_window',
    },
    // The shed garden door's square in the bottom wall, back to 26 px below the shed's lounge door.
    {
      ...prop('door', 'Door', 'Back to Shed', 464 + 16, 416 + 16, 16, 16),
      target: { room: 'shed', x: 240, y: 82 },
    },
  ],
  // A warm dark plum-brown behind the ring, a shade redder than the shed's 0x241e18 to suit the carpet.
  floor: 0x2a1c1a,
};
