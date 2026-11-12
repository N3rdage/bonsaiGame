/**
 * The garden behind the shed, as pure data: archive/gamemaker/rooms/rm_garden_back
 * (instances and their creation code) and the fence ring the controller builds
 * on entry (obj_game_controller/Other_4.gml), halved like the shed.
 */

import { getSpecies } from '../sim/species';
import { SHEETS } from './assets';
import type { SpeciesKey } from '../sim/types';
import { GREENHOUSE_ROOM } from './greenhouseRoom';
import { HALLWAY_ROOM } from './hallwayRoom';
import { LOUNGE_ROOM } from './loungeRoom';
import {
  SHED_ROOM,
  fromPrototype,
  prop,
  ringWalls,
  type Furniture,
  type Gap,
  type Prop,
  type Rect,
  type Room,
  type RoomKey,
} from './shedRoom';
import { STUDY_ROOM } from './studyRoom';

const WIDTH = fromPrototype(960);
const HEIGHT = fromPrototype(540);

/** Other_4: the garden's left fence leaves a doorway at prototype y 416..480. */
export const DOORWAY: Gap = { top: fromPrototype(416), bottom: fromPrototype(480) };

/** Other_4 fences the whole room. */
const BOUNDS: Rect = { x: 0, y: 0, w: WIDTH, h: HEIGHT };

/**
 * obj_source_plant: 48 px sprite, centred; prompt `Take Cutting`, labelled with
 * the species. WorldScene shows `sourcePlantPrompt` instead (Take Seeds in autumn).
 */
function sourcePlant(speciesKey: SpeciesKey, px: number, py: number): Prop {
  return {
    ...prop(
      `source_${speciesKey}`,
      getSpecies(speciesKey).displayName,
      'Take Cutting',
      px,
      py,
      fromPrototype(48),
      fromPrototype(48),
    ),
    speciesKey,
  };
}

/**
 * New content: the shed's back wall round the garden door, 32x56 from the
 * fence's left edge, its dark opening the door's 16x16 rect at (8, 220) and
 * the rest over the fence column's end tiles and the grass. Drawn, not solid:
 * the doorway's gap in the fence is the only collision there.
 */
export const SHED_EXTERIOR: Furniture = {
  sheet: SHEETS.shedExterior,
  x: 0,
  y: 196,
  w: fromPrototype(SHEETS.shedExterior.frameWidth),
  h: fromPrototype(SHEETS.shedExterior.frameHeight),
  solid: false,
};

export const GARDEN_ROOM: Room = {
  key: 'garden',
  width: WIDTH,
  height: HEIGHT,
  bounds: BOUNDS,
  windows: [],
  edgeMargin: SHED_ROOM.edgeMargin,
  // The garden is only entered through a door, which sets the spot.
  playerStart: { x: fromPrototype(100), y: fromPrototype(450) },
  walls: ringWalls(BOUNDS, DOORWAY),
  furniture: [SHED_EXTERIOR],
  props: [
    sourcePlant('juniper', 280, 180),
    sourcePlant('maple', 520, 160),
    sourcePlant('pine', 760, 200),
    // inst_64469EE5: a 32x32 door with its origin top-left at (16, 440), back
    // to the shed at (480, 380), just above the shed's door.
    {
      ...prop('door', 'Door', 'Back to Shed', 16 + 16, 440 + 16, 16, 16),
      target: { room: 'shed', x: fromPrototype(480), y: fromPrototype(380) },
    },
    // New content: a glazed door drawn on the right fence's band on the row y 190, back to 26 px
    // above the study's glass doors. A walk right along the row stops against the fence at x 463.5,
    // 8.5 px short of its centre.
    {
      ...prop('door_study', 'Door', 'To Study', 944, 380, 16, 16),
      target: { room: 'study', x: 320, y: 190 },
      sheet: SHEETS.doorGlassSingle,
    },
    // New content: a glazed door drawn on the top fence's band right of the source plants, centred
    // 2 px right of the study door's landing, back to 26 px above the greenhouse's door. A walk
    // straight up from that landing (446, 190) stops against the fence at y 16.25, 8.5 px from it.
    {
      ...prop('door_greenhouse', 'Door', 'To Greenhouse', 896, 16, 16, 16),
      target: { room: 'greenhouse', x: 240, y: 206 },
      sheet: SHEETS.doorGlassSingle,
    },
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
