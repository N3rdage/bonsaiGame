/**
 * The hallway, as pure data: new content (the prototype had no interiors),
 * plan B3's 3 x 2 m entrance hall (docs/site-plan/README.md), the house's hub
 * between the lounge and the study. A ring of solid walls on the shed's canvas
 * round a 6 x 4 tile floor, no windows and no display spots, a runner and a
 * console table along the bottom wall, neither of which stops the player, the
 * front door in the top wall and a door in each side wall 1 m from its north
 * end, on the row y 176.
 */

import { SHEETS } from './assets';
import {
  SHED_ROOM,
  fromPrototype,
  ringWalls,
  type Furniture,
  type Prop,
  type Rect,
  type Room,
} from './shedRoom';

/** The 96x64 floor (3 x 2 m), x 192..288 and y 144..208, grown by the 16 px wall band. */
export const HALLWAY_BOUNDS: Rect = { x: 176, y: 128, w: 128, h: 96 };

/**
 * spr_runner (416x48 prototype px, 208x24 logical) along the bottom wall,
 * x 200..260: a run crops its one frame to the rect rather than stretching
 * it, so it shows the runner's west end and its pattern, cut at x 260.
 */
export const RUNNER: Furniture = {
  sheet: SHEETS.runner,
  x: 200,
  y: 184,
  w: 60,
  h: 24,
  solid: false,
};

/** spr_hall_table's 32x24 prototype px, halved: against the bottom wall east of the runner. */
export const HALL_TABLE: Furniture = {
  sheet: SHEETS.hallTable,
  x: 266,
  y: 196,
  w: 16,
  h: 12,
  solid: false,
};

/** A door's 16 px square centred at (x, y) logical px. */
function door(key: string, prompt: string, x: number, y: number): Prop {
  return { key, label: 'Door', prompt, x, y, w: 16, h: 16 };
}

export const HALLWAY_ROOM: Room = {
  key: 'hallway',
  width: fromPrototype(960),
  height: fromPrototype(540),
  bounds: HALLWAY_BOUNDS,
  windows: [],
  edgeMargin: SHED_ROOM.edgeMargin,
  // Where the lounge's hallway door lands, 26 px right of this room's lounge door.
  playerStart: { x: 210, y: 176 },
  walls: ringWalls(HALLWAY_BOUNDS),
  furniture: [RUNNER, HALL_TABLE],
  props: [
    // Plan B3 row 5: the left wall's band 1 m from its north end, seen from the side, back to
    // beside the lounge's hallway door.
    {
      ...door('door_lounge', 'To Lounge', 184, 176),
      wall: 'W',
      target: { room: 'lounge', door: 'door_hallway' },
      sheet: SHEETS.doorSideW,
    },
    // Plan B3 row 6, the front door: in the top wall's band 1.5 m along, at its centre, to beside
    // the front garden's door to the hallway.
    {
      ...door('door_front', 'To Front Garden', 240, 136),
      wall: 'N',
      target: { room: 'frontGarden', door: 'door_house' },
    },
    // Plan B3 row 7: the right wall's band 1 m from its north end, seen from the side, to beside
    // the study's door.
    {
      ...door('door_study', 'To Study', 296, 176),
      wall: 'E',
      target: { room: 'study', door: 'door_hallway' },
      sheet: SHEETS.doorSideE,
    },
  ],
  // A dark warm umber behind the ring, between the shed's 0x241e18 and the lounge's 0x2a1c1a.
  floor: 0x261c16,
};
