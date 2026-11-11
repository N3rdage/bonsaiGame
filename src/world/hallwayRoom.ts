/**
 * The hallway, as pure data: new content (the prototype had no interiors), the
 * house's hub between the lounge and the study. It is the lounge's shape (the
 * shed's canvas and inset ring, solid walls) with no pedestals, a corridor
 * with a door in each side wall. Both doors sit on the row y 190, as do the
 * doors they lead to, so every walk through the house is a straight walk
 * along that row into the wall the door is in.
 */

import { SHED_BOUNDS, SHED_ROOM, fromPrototype, prop, ringWalls, type Room } from './shedRoom';

export const HALLWAY_ROOM: Room = {
  key: 'hallway',
  width: fromPrototype(960),
  height: fromPrototype(540),
  bounds: SHED_BOUNDS,
  edgeMargin: SHED_ROOM.edgeMargin,
  // Where the lounge's hallway door lands, 26 px right of this room's lounge door.
  playerStart: { x: 114, y: 190 },
  walls: ringWalls(SHED_BOUNDS),
  props: [
    // The left wall's band, prototype top-left (160, 364), back to 26 px left of the lounge's hallway door.
    {
      ...prop('door_lounge', 'Door', 'To Lounge', 160 + 16, 364 + 16, 16, 16),
      target: { room: 'lounge', x: 366, y: 190 },
    },
    // The right wall's band, prototype top-left (768, 364), to 26 px right of the study's door.
    {
      ...prop('door_study', 'Door', 'To Study', 768 + 16, 364 + 16, 16, 16),
      target: { room: 'study', x: 114, y: 190 },
    },
  ],
  // A dark warm umber behind the ring, between the shed's 0x241e18 and the lounge's 0x2a1c1a.
  floor: 0x261c16,
};
