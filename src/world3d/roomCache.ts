/**
 * What the renderer needs to keep each room's built meshes between visits:
 * the signature that says a kept set still matches the room, and the log of
 * how long each change of room took to draw, and which rooms lie behind a
 * room's doors. Pure; the renderer holds the
 * meshes.
 */

import type { Room } from '../world/shedRoom';

/** How many room changes the log keeps, the latest. */
export const ROOM_CHANGE_LOG = 20;

/** One change of room: its room, whether the renderer built that room's meshes for it, and the time to draw its first frame. */
export interface RoomChange {
  readonly room: Room['key'];
  /** True when the change built the room's meshes: the room's first visit, or one after what it was built from changed. */
  readonly first: boolean;
  /** From the start of the change's frame to the end of its render, ms. */
  readonly ms: number;
  /** A built room's art only: from the start of the change's frame to when its floor and wall sheets had all been laid, ms; absent until then. */
  dressedMs?: number;
}

/**
 * Everything of `room` the 3D build reads (its plan, details, floor and wall
 * art and hotspots are all derived from the room's data), so two rooms with
 * the same signature build the same meshes. The live room's furniture and
 * props change as items are placed and picked up, which changes it.
 */
export function roomSignature(room: Room): string {
  return JSON.stringify(room);
}

/** The rooms `room`'s doors lead to, each once, in prop order, never `room` itself. */
export function neighbourKeys(room: Room): Room['key'][] {
  const keys = new Set<Room['key']>();
  for (const prop of room.props) {
    const key = prop.target?.room;
    if (key !== undefined && key !== room.key) keys.add(key);
  }
  return [...keys];
}

/** One room built hidden ahead of a change into it, and the time `build` took. */
export interface AheadBuild {
  readonly room: Room['key'];
  /** The time the room's build took, ms. */
  readonly ms: number;
}

/** `log` with `entry` added, keeping the latest `ROOM_CHANGE_LOG`. */
export function logChange<T>(log: readonly T[], entry: T): T[] {
  return [...log, entry].slice(-ROOM_CHANGE_LOG);
}
