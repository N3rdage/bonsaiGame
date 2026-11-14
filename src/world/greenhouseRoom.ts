/**
 * The greenhouse, as pure data: new content (the prototype had none), a glass
 * house off the garden, 5 x 3.5 m. An inset ring of glass walls on the shed's
 * canvas round its 10x7-tile paved floor (`GREENHOUSE_FLOOR`, shared with the
 * save's version 6 migration), no windows (the walls are the glass), no
 * furniture of its own, and one door in the bottom wall's centre back out to
 * the garden.
 */

import { GREENHOUSE_FLOOR } from '../sim/greenhouseFloor';
import { SHEETS } from './assets';
import {
  SHED_ROOM,
  WALL_BAND,
  fromPrototype,
  prop,
  ringWalls,
  type Rect,
  type Room,
} from './shedRoom';

/** The floor grown by the glass band each side: 192x144, x 144..336 and y 64..208, centred on the canvas's x 240. */
export const GREENHOUSE_BOUNDS: Rect = {
  x: GREENHOUSE_FLOOR.x - WALL_BAND,
  y: GREENHOUSE_FLOOR.y - WALL_BAND,
  w: GREENHOUSE_FLOOR.w + 2 * WALL_BAND,
  h: GREENHOUSE_FLOOR.h + 2 * WALL_BAND,
};

export const GREENHOUSE_ROOM: Room = {
  key: 'greenhouse',
  width: fromPrototype(960),
  height: fromPrototype(540),
  bounds: GREENHOUSE_BOUNDS,
  windows: [],
  edgeMargin: SHED_ROOM.edgeMargin,
  // Where the garden's greenhouse door lands, 26 px above this room's door.
  playerStart: { x: 240, y: 174 },
  walls: ringWalls(GREENHOUSE_BOUNDS),
  furniture: [],
  props: [
    // The bottom wall's band at its centre, 2.5 m along, prototype top-left (464, 384), back to
    // below the garden's greenhouse door. A walk straight down from the landing stops against the
    // wall at y 191.5 on the 1.25 px step grid, 8.5 px from the door's centre.
    {
      ...prop('door_garden', 'Door', 'To Garden', 464 + 16, 384 + 16, 16, 16),
      wall: 'S',
      target: { room: 'garden', door: 'door_greenhouse' },
      sheet: SHEETS.doorGlassSingle,
    },
  ],
  // A deep moss-grey behind the glass, to suit the grey paving.
  floor: 0x1c2420,
};
