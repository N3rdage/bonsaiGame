/**
 * The greenhouse, as pure data: new content (the prototype had none), a glass
 * house off the garden. An inset ring of glass walls on the shed's canvas,
 * its 22x10-tile paved floor left empty for the trees to come, no windows (the
 * walls are the glass), no furniture, and one door in the bottom wall's centre
 * back out to the garden.
 */

import { SHEETS } from './assets';
import { SHED_ROOM, fromPrototype, prop, ringWalls, type Rect, type Room } from './shedRoom';

/** 384x192, x 48..432 and y 48..240: inside the ring a floor of 352x160, 22x10 tiles, centred on the canvas's x 240. */
export const GREENHOUSE_BOUNDS: Rect = { x: 48, y: 48, w: 384, h: 192 };

export const GREENHOUSE_ROOM: Room = {
  key: 'greenhouse',
  width: fromPrototype(960),
  height: fromPrototype(540),
  bounds: GREENHOUSE_BOUNDS,
  windows: [],
  edgeMargin: SHED_ROOM.edgeMargin,
  // Where the garden's greenhouse door lands, 26 px above this room's door.
  playerStart: { x: 240, y: 206 },
  walls: ringWalls(GREENHOUSE_BOUNDS),
  furniture: [],
  props: [
    // The bottom wall's band at its centre, prototype top-left (464, 448), back to below
    // the garden's greenhouse door. A walk straight down from the landing stops against the wall
    // at y 223.5 on the 1.25 px step grid, 8.5 px from the door's centre.
    {
      ...prop('door_garden', 'Door', 'To Garden', 464 + 16, 448 + 16, 16, 16),
      wall: 'S',
      target: { room: 'garden', door: 'door_greenhouse' },
      sheet: SHEETS.doorGlassSingle,
    },
  ],
  // A deep moss-grey behind the glass, to suit the grey paving.
  floor: 0x1c2420,
};
