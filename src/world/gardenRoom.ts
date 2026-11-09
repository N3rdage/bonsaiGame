/**
 * The garden behind the shed, as pure data: archive/gamemaker/rooms/rm_garden_back
 * (instances and their creation code) and the fence ring the controller builds
 * on entry (obj_game_controller/Other_4.gml), halved like the shed.
 */

import { getSpecies } from '../sim/species';
import type { SpeciesKey } from '../sim/types';
import {
  SHED_ROOM,
  WALL_THICKNESS,
  fromPrototype,
  prop,
  type Prop,
  type Room,
  type RoomKey,
} from './shedRoom';

const WIDTH = fromPrototype(960);
const HEIGHT = fromPrototype(540);

/** Other_4: the garden's left fence leaves a doorway at prototype y 416..480. */
export const DOORWAY = { top: fromPrototype(416), bottom: fromPrototype(480) } as const;

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
  edgeMargin: SHED_ROOM.edgeMargin,
  // The garden is only entered through a door, which sets the spot.
  playerStart: { x: fromPrototype(100), y: fromPrototype(450) },
  // The fence ring as thin edge strips, with the doorway gap on the left.
  walls: [
    { x: 0, y: 0, w: WIDTH, h: WALL_THICKNESS },
    { x: 0, y: HEIGHT - WALL_THICKNESS, w: WIDTH, h: WALL_THICKNESS },
    { x: 0, y: 0, w: WALL_THICKNESS, h: DOORWAY.top },
    { x: 0, y: DOORWAY.bottom, w: WALL_THICKNESS, h: HEIGHT - DOORWAY.bottom },
    { x: WIDTH - WALL_THICKNESS, y: 0, w: WALL_THICKNESS, h: HEIGHT },
  ],
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

export const ROOMS: Record<RoomKey, Room> = { shed: SHED_ROOM, garden: GARDEN_ROOM };
