/**
 * The garden behind the shed, as pure data: archive/gamemaker/rooms/rm_garden_back
 * (instances and their creation code) and the fence ring the controller builds
 * on entry (obj_game_controller/Other_4.gml), halved like the shed.
 */

import { getSpecies } from '../sim/species';
import type { SpeciesKey } from '../sim/types';
import { HALLWAY_ROOM } from './hallwayRoom';
import { LOUNGE_ROOM } from './loungeRoom';
import {
  SHED_ROOM,
  fromPrototype,
  prop,
  ringWalls,
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

/** obj_source_plant: 48 px sprite, centred; prompt `Take Cutting`, labelled with the species. */
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
};
