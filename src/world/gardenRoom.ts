/**
 * The back garden, as pure data, in plan B2's shape (docs/site-plan/README.md):
 * 1 m is 32 logical px and the house's north-west corner is (0, 0). Its
 * bounding box, x 0..14.5 m and y 0..16 m, is the room; the walkable ground
 * is the passage beside the study (x 13..14.5 m, y 0..4.5 m), the notch
 * beside the shed (x 5..14.5 m, y 4.5..8 m) and the lawn (y 8..16 m). The
 * house's and the shed's footprints fill the rest of the box and are solid;
 * the freestanding greenhouse stands in the lawn. Everything a door leads to
 * in the house and the outbuildings is a room of its own.
 *
 * Kept from archive/gamemaker/rooms/rm_garden_back: the fence ring the
 * controller built on entry (obj_game_controller/Other_4.gml), its tiles 16
 * logical px deep, the three source plants and the green background.
 */

import { getSpecies } from '../sim/species';
import { SHEETS } from './assets';
import type { SpeciesKey } from '../sim/types';
import { GREENHOUSE_ROOM } from './greenhouseRoom';
import { HALLWAY_ROOM } from './hallwayRoom';
import { LOUNGE_ROOM } from './loungeRoom';
import {
  SHED_ROOM,
  WALL_BAND,
  fromPrototype,
  furnitureWalls,
  ringWalls,
  type Furniture,
  type Prop,
  type Rect,
  type Room,
  type RoomKey,
} from './shedRoom';
import { STUDY_ROOM } from './studyRoom';

/** Logical px per metre of the site plan: two 16 px tiles. */
const METRE = 32;

/** Plan B2's back garden bounding box, 14.5 x 16 m. */
const BOUNDS: Rect = { x: 0, y: 0, w: 14.5 * METRE, h: 16 * METRE };

/** The house (lounge, hallway and study), x 0..13 m, y 0..4.5 m: solid. */
export const HOUSE: Rect = { x: 0, y: 0, w: 13 * METRE, h: 4.5 * METRE };

/** The shed, x 0..5 m, y 4.5..8 m: solid. */
export const SHED: Rect = { x: 0, y: 4.5 * METRE, w: 5 * METRE, h: 3.5 * METRE };

/** The greenhouse standing in the lawn, x 8..13 m, y 9.5..13 m: a glass box, solid all round. */
export const GREENHOUSE: Rect = { x: 8 * METRE, y: 9.5 * METRE, w: 5 * METRE, h: 3.5 * METRE };

/**
 * A run of `sheet` tiled over `r` (roomArt's `furnitureRuns`), drawn over the
 * fence ring's bands where it covers them; `solid` joins it to the walls.
 */
const run = (sheet: Furniture['sheet'], r: Rect, solid = false): Furniture => ({
  sheet,
  ...r,
  solid,
});

/**
 * The buildings seen from the garden, at placeholder quality: each roof is
 * `spr_roof` over its footprint and each face the garden sees is one band
 * deep along its edge, the house's in its own plaster (`spr_wall_hallway`)
 * along the notch and down the passage, the shed's in `spr_wall`'s planks
 * along the lawn; the greenhouse is `spr_wall_glass` all over. The house's
 * and the shed's walls are their footprints (GARDEN_ROOM.walls); the glass
 * box is solid furniture. The garage, west of the shed, is out of sight.
 */
export const EXTERIORS: readonly Furniture[] = [
  run(SHEETS.roof, { x: 0, y: 0, w: HOUSE.w - WALL_BAND, h: HOUSE.h }),
  run(SHEETS.wallHallway, {
    x: SHED.w,
    y: HOUSE.h - WALL_BAND,
    w: HOUSE.w - WALL_BAND - SHED.w,
    h: WALL_BAND,
  }),
  run(SHEETS.wallHallway, { x: HOUSE.w - WALL_BAND, y: 0, w: WALL_BAND, h: HOUSE.h }),
  run(SHEETS.roof, { x: 0, y: SHED.y, w: SHED.w, h: SHED.h - WALL_BAND }),
  run(SHEETS.wall, { x: 0, y: SHED.y + SHED.h - WALL_BAND, w: SHED.w, h: WALL_BAND }),
  run(SHEETS.wallGlass, GREENHOUSE, true),
];

/**
 * obj_source_plant: 48 px sprite, centred at (x, y) logical px; prompt `Take
 * Cutting`, labelled with the species. WorldScene shows `sourcePlantPrompt`
 * instead (Take Seeds in autumn).
 */
function sourcePlant(speciesKey: SpeciesKey, x: number, y: number): Prop {
  return {
    key: `source_${speciesKey}`,
    label: getSpecies(speciesKey).displayName,
    prompt: 'Take Cutting',
    x,
    y,
    w: fromPrototype(48),
    h: fromPrototype(48),
    speciesKey,
  };
}

/** A door's 16 px square centred at (x, y) logical px, in the face to its `wall` side. */
function door(
  key: string,
  prompt: string,
  x: number,
  y: number,
  rest: Pick<Prop, 'wall' | 'target' | 'sheet'>,
): Prop {
  return { key, label: 'Door', prompt, x, y, w: WALL_BAND, h: WALL_BAND, ...rest };
}

/** The row the source plants stand on, just clear of the south fence's band. */
const BED_Y = BOUNDS.h - WALL_BAND - 1.5 * WALL_BAND;

export const GARDEN_ROOM: Room = {
  key: 'garden',
  width: BOUNDS.w,
  height: BOUNDS.h,
  bounds: BOUNDS,
  windows: [],
  edgeMargin: SHED_ROOM.edgeMargin,
  // The garden is only entered through a door, which sets the spot; this is the shed door's landing.
  playerStart: { x: 80, y: 274 },
  walls: [...ringWalls(BOUNDS), HOUSE, SHED, ...furnitureWalls(EXTERIORS)],
  furniture: EXTERIORS,
  props: [
    // B2's bed along the south fence below the shed, one plant a metre from x 2.5 m.
    sourcePlant('juniper', 2.5 * METRE, BED_Y),
    sourcePlant('maple', 3.5 * METRE, BED_Y),
    sourcePlant('pine', 4.5 * METRE, BED_Y),
    // B2 row 13: in the shed's south face at x 2.5 m, back to just above the shed's door.
    door('door', 'Back to Shed', 2.5 * METRE, SHED.y + SHED.h - WALL_BAND / 2, {
      wall: 'N',
      target: { room: 'shed', door: 'door' },
    }),
    // B2 row 14: the study's glazed door in the house's back face on the notch's north edge, x 10.75 m.
    door('door_study', 'To Study', 10.75 * METRE, HOUSE.h - WALL_BAND / 2, {
      wall: 'N',
      target: { room: 'study', door: 'door_garden' },
      sheet: SHEETS.doorGlassSingle,
    }),
    // B2 row 15: in the greenhouse's south face, standing in the lawn at x 10.5 m.
    door(
      'door_greenhouse',
      'To Greenhouse',
      10.5 * METRE,
      GREENHOUSE.y + GREENHOUSE.h - WALL_BAND / 2,
      {
        wall: 'N',
        target: { room: 'greenhouse', door: 'door_garden' },
        sheet: SHEETS.doorGlassSingle,
      },
    ),
    // B2 row 12: the side gate in the passage's north fence at x 13.75 m. It leads nowhere
    // until the front garden exists (SP-4), so it has no target and E finds it closed.
    { ...door('gate', 'Gate', 13.75 * METRE, WALL_BAND / 2, { wall: 'N' }), label: 'Gate' },
  ],
  // rm_garden_back's background colour 4281094192 is ABGR 0xff2c5030.
  floor: 0x30502c,
};

export const ROOMS: Record<RoomKey, Room> = {
  shed: SHED_ROOM,
  garden: GARDEN_ROOM,
  lounge: LOUNGE_ROOM,
  hallway: HALLWAY_ROOM,
  study: STUDY_ROOM,
  greenhouse: GREENHOUSE_ROOM,
};
