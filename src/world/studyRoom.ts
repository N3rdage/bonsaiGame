/**
 * The study, as pure data: new content (the prototype had no interiors), an
 * indoor display room at the end of the hallway. A small room (an inset ring
 * of solid walls on the shed's canvas, narrower than the shed), one window in
 * its top wall, its one door in the left wall on the row y 190, and two
 * display pedestals in the top corners as the lounge's.
 */

import { SHED_ROOM, fromPrototype, prop, ringWalls, type Rect, type Room } from './shedRoom';

/** 224x128, x 128..352 and y 96..224, centred on the canvas's x 240 and smaller than a phone's zoomed view (240x135). */
export const STUDY_BOUNDS: Rect = { x: 128, y: 96, w: 224, h: 128 };

export const STUDY_ROOM: Room = {
  key: 'study',
  width: fromPrototype(960),
  height: fromPrototype(540),
  bounds: STUDY_BOUNDS,
  windows: [{ x: 224, w: 32 }],
  edgeMargin: SHED_ROOM.edgeMargin,
  // Where the hallway's study door lands, 26 px right of this room's door.
  playerStart: { x: 162, y: 190 },
  walls: ringWalls(STUDY_BOUNDS),
  props: [
    // In the top corners, within reach of a player stopped by both walls
    // ((144.5, 112.5) or (335.75, 112.5) from the landing on the 1.25 px step grid).
    {
      ...prop('pedestal_1', 'Pedestal', 'Use Pedestal', 296, 256, 16, 16),
      pedestalKey: 'study_desk',
    },
    {
      ...prop('pedestal_2', 'Pedestal', 'Use Pedestal', 664, 256, 16, 16),
      pedestalKey: 'study_bookshelf',
    },
    // The left wall's band, prototype top-left (256, 364), back to 26 px left of the hallway's study door.
    {
      ...prop('door_hallway', 'Door', 'To Hallway', 256 + 16, 364 + 16, 16, 16),
      target: { room: 'hallway', x: 366, y: 190 },
    },
  ],
  // A deep wine-brown behind the ring, to suit the red parquet.
  floor: 0x2a1618,
};
