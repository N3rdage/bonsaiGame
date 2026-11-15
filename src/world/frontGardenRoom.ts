/**
 * The front garden, as pure data, in plan B3's shape (docs/site-plan/README.md):
 * new content (the prototype had no front garden). 1 m is 32 logical px, and
 * the room's x 0 is the site plan's x −3.5 m, so room x = (metres + 3.5) * 32.
 * The walkable ground, `bounds`, is the plan's front garden, x −3.5..14.5 m
 * and y −4..0 m: the drive paved at its west end, the path paved from the
 * kerb to the front door at x 7 m, and lawn between. A ring of solid bands
 * keeps the player in it: the low front fence along the kerb (drawn with gaps
 * at the drive and the path, which stay solid: the road is never walked), and
 * along the south edge the garage's front face with its roller door (closed,
 * no prop: it leads nowhere yet), the house's front face with the front door
 * and four windows, and the passage's fence with the side gate.
 *
 * The canvas is taller than `bounds`: the road, x −3.5..14.5 m and y
 * −7..−4 m, fills the 96 px above the fence, and the roofs of the garage and
 * the house the strip below the faces. Both are furniture outside `bounds`,
 * drawn and never walked; the world camera shows them where the view is
 * taller than `bounds` (a desktop's) and keeps to `bounds` where it is not.
 */

import { SHEETS } from './assets';
import {
  SHED_ROOM,
  WALL_BAND,
  ringWalls,
  type Furniture,
  type Prop,
  type Rect,
  type Room,
} from './shedRoom';

/** Logical px per metre of the site plan: two 16 px tiles. */
const METRE = 32;

/** Room x of site plan x `m` metres: the room starts at x −3.5 m. */
const siteX = (m: number): number => (m + 3.5) * METRE;

/** The road, 3 m deep, across the top of the canvas above the fence. */
export const ROAD: Rect = { x: 0, y: 0, w: 18 * METRE, h: 3 * METRE };

/** Plan B3's front garden, 18 x 4 m, below the road. */
export const FRONT_GARDEN_BOUNDS: Rect = { x: 0, y: ROAD.h, w: 18 * METRE, h: 4 * METRE };

/** The faces' band along the south edge, and the row the doors in it are centred on. */
const FACE_Y = FRONT_GARDEN_BOUNDS.y + FRONT_GARDEN_BOUNDS.h - WALL_BAND;
const DOOR_Y = FACE_Y + WALL_BAND / 2;

/** The strip of roofs below the faces, to the canvas's foot. */
const HEIGHT = 272;
const ROOF_Y = FACE_Y + WALL_BAND;

/** The drive, x −3.5..0 m, inside the west fence's column, from the kerb to the garage. */
export const DRIVE: Rect = {
  x: WALL_BAND,
  y: FRONT_GARDEN_BOUNDS.y,
  w: siteX(0) - WALL_BAND,
  h: FACE_Y - FRONT_GARDEN_BOUNDS.y,
};

/**
 * The path, centred on the front door at x 7 m from the kerb to the house:
 * plan B3's paving is 6.6..7.4 m (room x 323.2..348.8), drawn as two whole
 * paving tiles on the tile grid, x 320..352 (6.5..7.5 m).
 */
export const PATH: Rect = {
  x: siteX(7) - WALL_BAND,
  y: FRONT_GARDEN_BOUNDS.y,
  w: 2 * WALL_BAND,
  h: FACE_Y - FRONT_GARDEN_BOUNDS.y,
};

/** The garage's front face, x −3.5..0 m, the house's, x 0..13 m, and the passage's fence, x 13..14.5 m. */
export const GARAGE_FACE: Rect = { x: 0, y: FACE_Y, w: siteX(0), h: WALL_BAND };
export const HOUSE_FACE: Rect = { x: siteX(0), y: FACE_Y, w: 13 * METRE, h: WALL_BAND };
export const PASSAGE_FENCE: Rect = {
  x: siteX(13),
  y: FACE_Y,
  w: FRONT_GARDEN_BOUNDS.w - siteX(13),
  h: WALL_BAND,
};

/**
 * The garage's roller door, 2.4 m centred on x −1.75 m (room x 56): its sheet
 * is 154 prototype px, 77 logical px, the nearest whole prototype pixel.
 */
export const ROLLER_DOOR: Rect = {
  x: siteX(-1.75) - SHEETS.rollerDoor.frameWidth / 4,
  y: FACE_Y,
  w: SHEETS.rollerDoor.frameWidth / 2,
  h: WALL_BAND,
};

/** A run of `sheet` tiled over `r`, not solid: the ring's bands are the room's collision. */
const run = (sheet: Furniture['sheet'], r: Rect): Furniture => ({ sheet, ...r, solid: false });

/** A 32 px window of two panes in the house's front face, from room x `x`. */
const houseWindow = (x: number): Furniture =>
  run(SHEETS.window, { x, y: FACE_Y, w: 32, h: WALL_BAND });

/** The beds along the fence's inside, one tile deep, on the tile grid: one between the drive and the path, one east of the path. */
const BED_Y = FRONT_GARDEN_BOUNDS.y + WALL_BAND;

export const FRONT_GARDEN_FURNITURE: readonly Furniture[] = [
  run(SHEETS.road, ROAD),
  run(SHEETS.drive, DRIVE),
  run(SHEETS.floorGreenhouse, PATH),
  run(SHEETS.bed, { x: 128, y: BED_Y, w: 176, h: WALL_BAND }),
  run(SHEETS.bed, { x: 368, y: BED_Y, w: 176, h: WALL_BAND }),
  run(SHEETS.wallHallway, GARAGE_FACE),
  run(SHEETS.rollerDoor, ROLLER_DOOR),
  run(SHEETS.wallHallway, HOUSE_FACE),
  // The lounge's two windows (x 0..5.5 m) and the study's two (x 8.5..13 m) either side of the hallway's front door.
  houseWindow(152),
  houseWindow(216),
  houseWindow(408),
  houseWindow(472),
  run(SHEETS.fence, PASSAGE_FENCE),
  run(SHEETS.roof, { x: 0, y: ROOF_Y, w: PASSAGE_FENCE.x, h: HEIGHT - ROOF_Y }),
];

/** A 16 px door or gate centred on room x `x` in the south band. */
function southDoor(key: string, label: string, prompt: string, x: number): Prop {
  return { key, label, prompt, x, y: DOOR_Y, w: WALL_BAND, h: WALL_BAND, wall: 'S' };
}

export const FRONT_GARDEN_ROOM: Room = {
  key: 'frontGarden',
  width: FRONT_GARDEN_BOUNDS.w,
  height: HEIGHT,
  bounds: FRONT_GARDEN_BOUNDS,
  windows: [],
  edgeMargin: SHED_ROOM.edgeMargin,
  // The front garden is only entered through a door, which sets the spot; this is the front door's landing.
  playerStart: { x: 336, y: 190 },
  walls: ringWalls(FRONT_GARDEN_BOUNDS),
  furniture: FRONT_GARDEN_FURNITURE,
  props: [
    // B3 row 10: the front door in the house's front face at x 7 m, to the hallway's front door.
    {
      ...southDoor('door_house', 'Door', 'To Hallway', siteX(7)),
      target: { room: 'hallway', door: 'door_front' },
    },
    // B3 row 11: the side gate in the passage's fence, to the back garden's gate. At x 13.5 m,
    // in line with the back garden's side of it (gardenRoom.ts), so the player lands clear of the
    // east fence's band.
    {
      ...southDoor('gate', 'Gate', 'To Back Garden', siteX(13.5)),
      target: { room: 'garden', door: 'gate' },
      sheet: SHEETS.gate,
    },
  ],
  // The back garden's green, under the lawn tiles.
  floor: 0x30502c,
};
