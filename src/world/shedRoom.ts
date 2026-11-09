/**
 * The shed, the room a new game starts in, as pure data, and the shape every
 * room shares (the garden is in gardenRoom.ts).
 *
 * The prototype's rooms are 960x540; the web build's logical canvas is 480x270
 * (`GAME_WIDTH`/`GAME_HEIGHT` in resolution.ts), so every prototype coordinate and
 * distance halves. `fromPrototype` is the one place that rule lives.
 *
 * Positions are ported from archive/gamemaker/rooms/rm_shed/rm_shed.yy (the
 * instance list). The prototype's `obj_wall` instances are not in the shed, so
 * its edges are the bounds; here they are thin wall strips along the edges.
 */

import type { SpeciesKey } from '../sim/types';

/** Prototype room px per logical px. */
export const PROTOTYPE_SCALE = 2;

export function fromPrototype(px: number): number {
  return px / PROTOTYPE_SCALE;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The rooms the world can show; also the `location` of a tree on that room's floor. */
export type RoomKey = 'shed' | 'garden';

/** Where a door leads (obj_door's `target_room`, `target_x`, `target_y`), logical px. */
export interface DoorTarget {
  readonly room: RoomKey;
  readonly x: number;
  readonly y: number;
}

export interface Prop {
  readonly key: string;
  readonly label: string;
  /** The prototype object's `prompt` (Create_0 of obj_workbench, obj_door, ...): what E does here. */
  readonly prompt: string;
  /** Centre of the prop's footprint, logical px. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Display pedestals only: the prototype's `pedestal_key` (instance creation code), as in `displayed:<pedestalKey>`. */
  readonly pedestalKey?: string;
  /** Doors only: the room and spot E takes the player to. */
  readonly target?: DoorTarget;
  /** Garden source plants only (obj_source_plant's `species_key`): what a cutting is of. */
  readonly speciesKey?: SpeciesKey;
}

export interface Room {
  readonly key: RoomKey;
  readonly width: number;
  readonly height: number;
  /** The player is kept at least this far inside the room's edges. */
  readonly edgeMargin: number;
  readonly playerStart: { readonly x: number; readonly y: number };
  readonly walls: readonly Rect[];
  readonly props: readonly Prop[];
  /** Floor colour, from the room's background layer. */
  readonly floor: number;
}

/**
 * Edge walls are thinner than `edgeMargin`, so the clamp (Step_0: "keep the
 * player inside the room regardless of wall coverage") is what holds the player
 * in at the edges; wall collision is for walls inside a room.
 */
export const WALL_THICKNESS = 2;

const WIDTH = fromPrototype(960);
const HEIGHT = fromPrototype(540);

/** A prop centred on prototype (px, py), `w` x `h` logical px. */
export function prop(
  key: string,
  label: string,
  prompt: string,
  px: number,
  py: number,
  w: number,
  h: number,
): Prop {
  return { key, label, prompt, x: fromPrototype(px), y: fromPrototype(py), w, h };
}

export const SHED_ROOM: Room = {
  key: 'shed',
  width: WIDTH,
  height: HEIGHT,
  // Step_0: clamp(x, 8, room_width - 8).
  edgeMargin: fromPrototype(8),
  playerStart: { x: fromPrototype(480), y: fromPrototype(270) },
  walls: [
    { x: 0, y: 0, w: WIDTH, h: WALL_THICKNESS },
    { x: 0, y: HEIGHT - WALL_THICKNESS, w: WIDTH, h: WALL_THICKNESS },
    { x: 0, y: 0, w: WALL_THICKNESS, h: HEIGHT },
    { x: WIDTH - WALL_THICKNESS, y: 0, w: WALL_THICKNESS, h: HEIGHT },
  ],
  props: [
    prop('workbench', 'Workbench', 'Make Pot', 250, 180, 40, 20),
    prop('planting_table', 'Planting', 'Plant Cutting', 330, 180, 32, 20),
    prop('shop_kiosk', 'Shop', 'Shop', 250, 290, 28, 24),
    // rm_shed instance creation code: inst_32863523 and inst_277706A5.
    {
      ...prop('pedestal_1', 'Pedestal', 'Use Pedestal', 620, 170, 16, 16),
      pedestalKey: 'shed_main',
    },
    {
      ...prop('pedestal_2', 'Pedestal', 'Use Pedestal', 700, 170, 16, 16),
      pedestalKey: 'shed_window',
    },
    // inst_52E224DC's creation code: target_room = rm_garden_back, (100, 450).
    {
      ...prop('door', 'Door', 'To Garden', 464, 416, 24, 32),
      target: { room: 'garden', x: fromPrototype(100), y: fromPrototype(450) },
    },
  ],
  // rm_shed's background colour 4279770660 is ABGR 0xff181e24.
  floor: 0x241e18,
};

/** True if the point lies inside any wall. */
export function hitsWall(room: Room, x: number, y: number): boolean {
  return room.walls.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}
