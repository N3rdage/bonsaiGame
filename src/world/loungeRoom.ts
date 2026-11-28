/**
 * The lounge-kitchen, as pure data: new content (the prototype had no
 * interiors), plan B3's lounge with its open-plan kitchen as one walkable room
 * (docs/site-plan/README.md), an indoor display room through the shed's top
 * door. It reuses the shed's conventions (the same canvas, an inset ring of
 * solid walls framed by the dark background): 10.5 x 4.5 m at 1 m to 32 px
 * (the interior is drawn 2 m wider than the house's 5.5 m lounge footprint on
 * the site plan: rooms favour feel over exact scale), the hallway's 3 x 2 m block solid in its north-east corner as the back
 * garden's house and shed footprints are, the kitchen open below that block
 * with its counter along its south and east walls. Two windows in the
 * lounge's top wall, a door drawn on the bottom wall back to the shed, one in
 * the block's west face on to the hallway, and a fireplace and a side table
 * against the top wall carrying the two display
 * spots that were the shed's pedestals (saves from before version 4 move the
 * shed's displayed trees onto them). A sofa, a coffee table and an armchair
 * seat the middle of the room, clear of both doors' walks to the spots; a tall
 * bookcase stands against the top wall beside the fireplace, a floor lamp by the
 * armchair and a potted plant before the east window.
 */

import { SHEETS } from './assets';
import { BACK_WALL_FACE, WALL_CAP } from './roomArt';
import {
  SHED_ROOM,
  displaySpot,
  fromPrototype,
  furnitureWalls,
  prop,
  ringWalls,
  type Furniture,
  type Rect,
  type Room,
} from './shedRoom';

/**
 * The 336x144 floor (10.5 x 4.5 m), x 96..432 and y 64..208, grown by the
 * 16 px wall band: x 80..448 and y 48..224. The sitting area west of the
 * kitchen (x 96..336) is 7.5 x 4.5 m. Its bottom wall is the shed's
 * top row, so the shed door's square stays at x 240, and it fits a phone's
 * zoomed view (384x216).
 */
export const LOUNGE_BOUNDS: Rect = { x: 80, y: 48, w: 368, h: 176 };

/**
 * The hallway's 3 x 2 m (96x64) in the floor's north-east corner, x 336..432
 * and y 64..128: a solid block, the hallway door in its west face, drawn as
 * the paper (the house beyond this room, as the surround outside the walls
 * is) inside the lounge's caps on its open edges (HALLWAY_BLOCK_CAPS). Its
 * walls stand the back wall's 2.4 m, so it casts as the ring's walls do. The
 * kitchen is the floor below it, x 336..432 and y 128..208.
 */
export const HALLWAY_BLOCK: Furniture = {
  sheet: SHEETS.paper,
  x: 336,
  y: 64,
  w: 96,
  h: 64,
  solid: true,
  stands: { height: BACK_WALL_FACE },
};

/**
 * The block's two open edges drawn as the lounge's walls' caps, on its
 * inside as the ring's are on its bands: `spr_lounge_cap_v` down its west
 * edge and `spr_lounge_cap` along its south edge, each tile hashed by where
 * it lands. Not solid: the block is.
 */
export const HALLWAY_BLOCK_CAPS: readonly Furniture[] = [
  { sheet: SHEETS.loungeCapV, x: 336, y: 64, w: WALL_CAP, h: 64, solid: false },
  { sheet: SHEETS.loungeCap, x: 336, y: 128 - WALL_CAP, w: 96, h: WALL_CAP, solid: false },
];

/** The kitchen's quarry tiles over its floor below the block, under the counter. */
export const KITCHEN_FLOOR: Furniture = {
  sheet: SHEETS.floorKitchen,
  x: 336,
  y: 128,
  w: 96,
  h: 80,
  solid: false,
  flat: true,
};

/**
 * The fireplace, 1.0 x 0.75 x 0.9 m, against the top wall centred between the
 * windows on x 240: the mantel shelf is its sprite's top face, y 44..68.
 */
export const FIREPLACE: Furniture = {
  sheet: SHEETS.fireplace,
  x: 224,
  y: 64,
  w: 32,
  h: 24,
  solid: true,
  sorted: true,
  stands: { height: 20 },
};

/**
 * A low side table, 0.5 m square and 0.4 m high, in the top-left corner
 * against both walls: its top face is its sprite's y 56..72.
 */
export const SIDE_TABLE: Furniture = {
  sheet: SHEETS.sideTable,
  x: 96,
  y: 64,
  w: 16,
  h: 16,
  solid: true,
  sorted: true,
  stands: { height: 8 },
};

/**
 * The sofa, 0.875 x 1.875 x 0.9 m (28 x 60 px), its back along the west wall
 * and its seat facing east, x 112..140 and y 98..158. It floats 16 px off the
 * west wall, leaving the lane x 96..112 that a walk into that wall and up to
 * the side table takes, and ends on y 158 so the floor-tree spots on y 160
 * stay clear.
 */
export const SOFA: Furniture = {
  sheet: SHEETS.sofa,
  x: 112,
  y: 98,
  w: 28,
  h: 60,
  solid: true,
  sorted: true,
  stands: { height: 20 },
};

/**
 * The coffee table, 0.625 x 1.0 x 0.4 m (20 x 32 px), 6 px in front of the
 * sofa and centred on its length, x 146..166 and y 112..144: clear of the
 * column x 232..248 that a walk up from the shed door's landing takes to the
 * mantel.
 */
export const COFFEE_TABLE: Furniture = {
  sheet: SHEETS.coffeeTable,
  x: 146,
  y: 112,
  w: 20,
  h: 32,
  solid: true,
  sorted: true,
  stands: { height: 8 },
};

/**
 * The armchair, 0.75 x 0.75 x 0.9 m (24 px square), its back to the east and
 * turned toward the fire, x 276..300 and y 112..136: east of the mantel
 * column and 18 px short of the hallway door's landing (x 318), below the row
 * y 96 that landing's walk to the side table takes west.
 */
export const ARMCHAIR: Furniture = {
  sheet: SHEETS.armchair,
  x: 276,
  y: 112,
  w: 24,
  h: 24,
  solid: true,
  sorted: true,
  stands: { height: 20 },
};

/**
 * The tall bookcase, 0.875 x 0.375 x 1.78 m (28 x 12 px, 38 tall), against the
 * top wall between the fireplace and the east window, x 258..286 and y 64..76:
 * east of the column x 232..248 that a walk up to the mantel takes, and clear
 * of both windows, x 112..144 and 288..320.
 */
export const BOOKCASE: Furniture = {
  sheet: SHEETS.bookcase,
  x: 258,
  y: 64,
  w: 28,
  h: 12,
  solid: true,
  sorted: true,
  stands: { height: 38 },
};

/**
 * A floor lamp, 0.4375 m square and 1.5 m tall (14 px, 32 tall), beside the
 * armchair's south end, x 281..295 and y 140..154: below the armchair (y 112..136)
 * and clear of the walk from the hallway's landing down to the kitchen.
 */
export const FLOOR_LAMP: Furniture = {
  sheet: SHEETS.floorLamp,
  x: 281,
  y: 140,
  w: 14,
  h: 14,
  solid: true,
  sorted: true,
  stands: { height: 32 },
};

/**
 * A potted plant, 0.625 x 0.5 m and 1.125 m tall (20 x 16 px, 24 tall), on the
 * top wall in front of the east window, x 294..314 and y 64..80: 8 px east of
 * the bookcase, and 10 px above the row y 96 that the hallway landing's walk
 * west to the side table takes.
 */
export const POTTED_PLANT: Furniture = {
  sheet: SHEETS.pottedPlant,
  x: 294,
  y: 64,
  w: 20,
  h: 16,
  solid: true,
  sorted: true,
  stands: { height: 24 },
};

/**
 * The kitchen counter, 0.6 m deep (20 px) and 0.9 m high: its run along the
 * kitchen's south wall and its run up the east wall from there to the block,
 * the east run its worktop alone (20 x 60), its south end joined to the south
 * run, so it starts at the block's south cap, y 128, the south run's worktop
 * over its last 20 px. Solid: no floor-tree spot and no walk in the lounge
 * reaches east of x 336. Both runs stand 20 px, the south run's front face.
 */
const COUNTER = { solid: true, sorted: true, stands: { height: 20 } } as const;

export const KITCHEN_COUNTER: readonly Furniture[] = [
  { ...COUNTER, sheet: SHEETS.counter, x: 336, y: 188, w: 96, h: 20 },
  { ...COUNTER, sheet: SHEETS.counterV, x: 412, y: 128, w: 20, h: 60 },
];

const FURNITURE = [
  KITCHEN_FLOOR,
  HALLWAY_BLOCK,
  ...HALLWAY_BLOCK_CAPS,
  FIREPLACE,
  SIDE_TABLE,
  SOFA,
  COFFEE_TABLE,
  ARMCHAIR,
  BOOKCASE,
  FLOOR_LAMP,
  POTTED_PLANT,
  ...KITCHEN_COUNTER,
];

export const LOUNGE_ROOM: Room = {
  key: 'lounge',
  width: fromPrototype(960),
  height: fromPrototype(540),
  bounds: LOUNGE_BOUNDS,
  windows: [
    { x: 112, w: 32 },
    { x: 288, w: 32 },
  ],
  edgeMargin: SHED_ROOM.edgeMargin,
  // Where the shed's lounge door lands, 26 px above this room's door.
  playerStart: { x: 240, y: 190 },
  walls: [...ringWalls(LOUNGE_BOUNDS), ...furnitureWalls(FURNITURE)],
  furniture: FURNITURE,
  props: [
    // On the mantel shelf, the fireplace's top face, y 44..68: a walk
    // straight up from the shed door's landing stops against the fireplace
    // at y 88.75 on the 1.25 px step grid, 11.75 px below the spot's centre
    // (240, 77).
    displaySpot('pedestal_1', 'lounge_mantel', FIREPLACE, 66, FIREPLACE.x, FIREPLACE.w, 'Mantel'),
    // On the table top, y 56..72: a walk into the left wall and then up
    // stops against the table at (96.25, 80) from the shed door's landing,
    // (96.75, 81) from the hallway door's, on the 1.25 px step grid, each
    // within 10.1 px of the spot's centre (104, 74).
    displaySpot('pedestal_2', 'lounge_side_table', SIDE_TABLE, 68),
    // Plan B3 row 3: the shed garden door's square in the bottom wall, 4.5 m along its floor, back to
    // below the shed's lounge door.
    {
      ...prop('door', 'Door', 'Back to Shed', 464 + 16, 416 + 16, 16, 16),
      wall: 'S',
      target: { room: 'shed', door: 'door_lounge' },
    },
    // Plan B3 row 4: in the hallway block's west face, 1 m from its north end, seen from the
    // side, to beside the hallway's lounge door. It lands west of the block, facing it.
    {
      key: 'door_hallway',
      label: 'Door',
      prompt: 'To Hallway',
      x: 344,
      y: 96,
      w: 16,
      h: 16,
      wall: 'E',
      target: { room: 'hallway', door: 'door_lounge' },
      sheet: SHEETS.doorSideE,
    },
  ],
  // A warm dark plum-brown behind the ring, a shade redder than the shed's 0x241e18 to suit the carpet.
  floor: 0x2a1c1a,
};
