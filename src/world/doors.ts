/**
 * Where a door sets the player down: beside the far door (its target's `door`
 * in its target's room), stepped into the room perpendicular to the wall that
 * door sits in (a ring band, or a building's face inside the garden) and
 * facing into the room. Pure; WorldScene's `enterRoom` uses it.
 */

import { PLAYER_SCALE, SHEETS } from './assets';
import { INTERACT_RANGE } from './interactables';
import type { Facing } from './player';
import { WALL_BAND, furnitureWalls, type Prop, type Rect, type Room, type Wall } from './shedRoom';

/** The player sprite's half height, logical px: spr_player's 32 px frame at `PLAYER_SCALE` (0.75), halved, 12. */
export const PLAYER_HALF = (SHEETS.player.frameHeight * PLAYER_SCALE) / 2;

/** Room between the landing and anything it must clear: the wall, the door's footprint and its reach. */
export const LANDING_MARGIN = 6;

/** A prop that is a door in a wall. */
export type WallDoor = Prop & { readonly wall: Wall };

export interface Landing {
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
}

/** Facing into the room from each wall, and the unit step inward (+y down). */
const INWARD: Record<Wall, { readonly facing: Facing; readonly dx: number; readonly dy: number }> =
  {
    N: { facing: 'down', dx: 0, dy: 1 },
    S: { facing: 'up', dx: 0, dy: -1 },
    E: { facing: 'left', dx: -1, dy: 0 },
    W: { facing: 'right', dx: 1, dy: 0 },
  };

/** The inner edge of `wall`'s band in the room's ring, along the axis perpendicular to it. */
function ringEdge(room: Room, wall: Wall): number {
  const { x, y, w, h } = room.bounds;
  if (wall === 'N') return y + WALL_BAND;
  if (wall === 'S') return y + h - WALL_BAND;
  if (wall === 'W') return x + WALL_BAND;
  return x + w - WALL_BAND;
}

/** The edge of `r` facing into the room from a door in `wall`. */
function rectEdge(r: Rect, wall: Wall): number {
  if (wall === 'N') return r.y + r.h;
  if (wall === 'S') return r.y;
  if (wall === 'W') return r.x + r.w;
  return r.x;
}

/**
 * The inner edge, along the axis perpendicular to the door's wall, of the
 * solid the door is set in: the wall or solid piece of furniture whose rect
 * contains the door's centre (a ring band, or a building's face standing in
 * the garden), the innermost if several do, else the ring's band.
 */
function innerEdge(room: Room, door: WallDoor): number {
  const { dx, dy } = INWARD[door.wall];
  const holding = [...room.walls, ...furnitureWalls(room.furniture)].filter(
    (r) => door.x >= r.x && door.x < r.x + r.w && door.y >= r.y && door.y < r.y + r.h,
  );
  if (holding.length === 0) return ringEdge(room, door.wall);
  const edges = holding.map((r) => rectEdge(r, door.wall));
  return dx + dy > 0 ? Math.max(...edges) : Math.min(...edges);
}

/**
 * The door's centre moved inward far enough that the player's sprite clears
 * the solid it is set in and the door's own footprint, and the landing is out of the
 * door's reach (`INTERACT_RANGE`), so arriving never prompts to go straight
 * back; each with `LANDING_MARGIN` to spare.
 */
export function landing(room: Room, door: WallDoor): Landing {
  const { facing, dx, dy } = INWARD[door.wall];
  const across = dx === 0 ? door.y : door.x;
  const toWallEdge = Math.abs(innerEdge(room, door) - across);
  const halfDepth = (dx === 0 ? door.h : door.w) / 2;
  const clear = Math.max(Math.max(toWallEdge, halfDepth) + PLAYER_HALF, INTERACT_RANGE);
  const step = clear + LANDING_MARGIN;
  return { x: door.x + dx * step, y: door.y + dy * step, facing };
}

/** The door keyed `key` in `room`, which must be a door in a wall. */
export function wallDoor(room: Room, key: string): WallDoor {
  const door = room.props.find((p) => p.key === key);
  if (door?.wall === undefined) throw new Error(`${room.key} has no door ${key}`);
  return { ...door, wall: door.wall };
}
