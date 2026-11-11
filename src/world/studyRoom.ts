/**
 * The study, as pure data: new content (the prototype had no interiors), an
 * indoor display room at the end of the hallway. It is the lounge's shape (the
 * shed's canvas and inset ring, solid walls), its one door in the left wall on
 * the row y 190, and two display pedestals in the top corners as the
 * lounge's.
 */

import { SHED_BOUNDS, SHED_ROOM, fromPrototype, prop, ringWalls, type Room } from './shedRoom';

export const STUDY_ROOM: Room = {
  key: 'study',
  width: fromPrototype(960),
  height: fromPrototype(540),
  bounds: SHED_BOUNDS,
  edgeMargin: SHED_ROOM.edgeMargin,
  // Where the hallway's study door lands, 26 px right of this room's door.
  playerStart: { x: 114, y: 190 },
  walls: ringWalls(SHED_BOUNDS),
  props: [
    // In the top corners, as the lounge's, within reach of a player stopped by both walls.
    {
      ...prop('pedestal_1', 'Pedestal', 'Use Pedestal', 200, 160, 16, 16),
      pedestalKey: 'study_desk',
    },
    {
      ...prop('pedestal_2', 'Pedestal', 'Use Pedestal', 760, 160, 16, 16),
      pedestalKey: 'study_bookshelf',
    },
    // The left wall's band, prototype top-left (160, 364), back to 26 px left of the hallway's study door.
    {
      ...prop('door_hallway', 'Door', 'To Hallway', 160 + 16, 364 + 16, 16, 16),
      target: { room: 'hallway', x: 366, y: 190 },
    },
  ],
  // A deep wine-brown behind the ring, to suit the red parquet.
  floor: 0x2a1618,
};
