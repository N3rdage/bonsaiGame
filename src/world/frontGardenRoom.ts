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
 * and four windows, and the passage's fence with the side gate. The faces are
 * 2.4 m (48 px) tall, standing on the south band's bottom edge, so they rise
 * over the lawn's southern 32 px, which the player still walks, drawn in front
 * of them.
 *
 * The canvas is taller than `bounds`: the road, x −3.5..14.5 m and y
 * −7..−4 m, fills the 96 px above the fence, and the roofs of the garage and
 * the house the strip below the faces. Both are furniture outside `bounds`,
 * drawn and never walked; the world camera shows them where the view is
 * taller than `bounds` (a desktop's) and keeps to `bounds` where it is not.
 */

import { SHEETS } from './assets';
import { BACK_WALL_FACE, FENCE_HEIGHT, WALL_CAP } from './roomArt';
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

/**
 * The garage's front face, x −3.5..0 m, the house's, x 0..13 m, and the
 * passage's fence, x 13..14.5 m: their footprints in the south band. The
 * faces are drawn 2.4 m tall standing on the band's bottom edge (`face`).
 */
export const GARAGE_FACE: Rect = { x: 0, y: FACE_Y, w: siteX(0), h: WALL_BAND };
export const HOUSE_FACE: Rect = { x: siteX(0), y: FACE_Y, w: 13 * METRE, h: WALL_BAND };
export const PASSAGE_FENCE: Rect = {
  x: siteX(13),
  y: FACE_Y,
  w: FRONT_GARDEN_BOUNDS.w - siteX(13),
  h: WALL_BAND,
};

/** The faces' foot, the south band's bottom edge, where the doors and the roller door stand. */
const FACE_FOOT = FACE_Y + WALL_BAND;

/**
 * The garage's closed roller door, 2.4 m centred on x −1.75 m (room x 56),
 * standing on the face's foot: its sheet is 77 logical px wide, 2.4 m at 32
 * px a metre (76.8) rounded to a whole px, and 40 tall, the scale rule's
 * front-on door.
 */
export const ROLLER_DOOR: Rect = {
  x: siteX(-1.75) - SHEETS.rollerDoor.frameWidth / 8,
  y: FACE_FOOT - SHEETS.rollerDoor.frameHeight / 4,
  w: SHEETS.rollerDoor.frameWidth / 4,
  h: SHEETS.rollerDoor.frameHeight / 4,
};

/** A run of `sheet` tiled over `r`, not solid: the ring's bands are the room's collision. */
const run = (sheet: Furniture['sheet'], r: Rect): Furniture => ({ sheet, ...r, solid: false });

/** A run lying flat on the ground, under the cast shadows. */
const flat = (sheet: Furniture['sheet'], r: Rect): Furniture => ({ ...run(sheet, r), flat: true });

/** A face BACK_WALL_FACE (2.4 m) tall standing on the footprint `r`'s bottom edge, as the back garden's (gardenRoom.ts). */
const face = (sheet: Furniture['sheet'], r: Rect): Furniture =>
  run(sheet, { x: r.x, y: r.y + r.h - BACK_WALL_FACE, w: r.w, h: BACK_WALL_FACE });

/**
 * A window in the house's front face, 40 x 24 centred on room x `cx`, its
 * sill 20 px (0.94 m) above the face's foot as the kitchen window's.
 */
const houseWindow = (cx: number): Furniture =>
  run(SHEETS.houseWindow, { x: cx - 20, y: FACE_FOOT - 20 - 24, w: 40, h: 24 });

/** The beds along the fence's inside, one tile deep, on the tile grid: one between the drive and the path, one east of the path. */
const BED_Y = FRONT_GARDEN_BOUNDS.y + WALL_BAND;

/**
 * Drawn in Inked (art/inked/frontGarden.mjs and the back garden's
 * garden.mjs): the road, the drive and the path (both over the fence's band,
 * its gaps), the beds, then the garage's and the house's rendered faces, 48
 * px tall on the south band's bottom edge so they rise 32 px over the lawn's
 * southern edge, the roller door and the windows in them, the passage's
 * fence, the clay-tiled roofs below, and the house's edge-on east wall's cap.
 * The road, the drive, the path and the beds lie `flat`, under the cast
 * shadows; the passage's fence casts as a fence, the roofs as the 2.4 m
 * buildings they stand for.
 */
export const FRONT_GARDEN_FURNITURE: readonly Furniture[] = [
  flat(SHEETS.road, ROAD),
  flat(SHEETS.drive, DRIVE),
  flat(SHEETS.path, PATH),
  flat(SHEETS.bed, { x: 128, y: BED_Y, w: 176, h: WALL_BAND }),
  flat(SHEETS.bed, { x: 368, y: BED_Y, w: 176, h: WALL_BAND }),
  face(SHEETS.houseFace, GARAGE_FACE),
  run(SHEETS.rollerDoor, ROLLER_DOOR),
  face(SHEETS.houseFace, HOUSE_FACE),
  // The lounge's two windows (x 0..5.5 m) and the study's two (x 8.5..13 m) either side of the hallway's front door.
  houseWindow(168),
  houseWindow(232),
  houseWindow(424),
  houseWindow(488),
  { ...run(SHEETS.fence, PASSAGE_FENCE), stands: { height: FENCE_HEIGHT } },
  {
    ...run(SHEETS.houseRoof, { x: 0, y: ROOF_Y, w: PASSAGE_FENCE.x, h: HEIGHT - ROOF_Y }),
    stands: { height: BACK_WALL_FACE },
  },
  // The house's east wall beside the passage, edge-on: its 8 px cap down the face's and the roof's
  // east end, as the back garden draws it.
  run(SHEETS.houseCapV, {
    x: PASSAGE_FENCE.x - WALL_CAP,
    y: FACE_FOOT - BACK_WALL_FACE,
    w: WALL_CAP,
    h: HEIGHT - (FACE_FOOT - BACK_WALL_FACE),
  }),
];

/** A 16 px door or gate centred on room x `x` in the south band. */
function southDoor(key: string, label: string, prompt: string, x: number): Prop {
  return { key, label, prompt, x, y: DOOR_Y, w: WALL_BAND, h: WALL_BAND, wall: 'S' };
}

/** The prop whose interaction opens the shop: the bicycle on the lawn. */
export const SHOP_VEHICLE_KEY = 'shop_bicycle';

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
    // The bicycle leaning on the lawn west of the path, its 54 x 8 footprint centred on (284, 196):
    // 9 px from the path's paving, between the lounge window and the front door, clear of the front
    // door's landing and in the lawn's southern strip, so the drive, the path and the gate stay clear.
    // It opens the shop.
    {
      key: SHOP_VEHICLE_KEY,
      label: 'Bicycle',
      prompt: 'Go to the shop',
      x: 284,
      y: 196,
      w: 54,
      h: 8,
    },
    // B3 row 10: the front door in the house's front face at x 7 m, to the hallway's front door;
    // its solid panelled leaf front-on, standing on the face's foot.
    {
      ...southDoor('door_house', 'Door', 'To Hallway', siteX(7)),
      target: { room: 'hallway', door: 'door_front' },
      sheet: SHEETS.frontDoor,
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
