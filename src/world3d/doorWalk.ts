/**
 * Walking through a door in the 3D world, as pure functions: a player who
 * walks into a doorway takes the door, with no Interact press. Only the
 * decision lives here; the room change and the landing are the door's own
 * (WorldScene's `enterRoom`, doors.ts `landing`), so the player arrives where
 * pressing Interact would have put them.
 */

import { INWARD, wallDoor, type WallDoor } from '../world/doors';
import { INTERACT_RANGE } from '../world/interactables';
import type { MoveInput } from '../world/player';
import type { DoorTarget, Room } from '../world/shedRoom';

/**
 * `walkThrough`: whether doors in the 3D world are taken by walking into them. False gives
 * them back to Interact (and the tap's walk-and-use), as the 2D rooms have them.
 */
export const DOOR_RULES = { walkThrough: true };

/**
 * How far into the room the doorway's trigger strip reaches from the door's
 * centre: the door's Interact range, so the strip is where the prompt shows.
 * A landing is further out than this (doors.ts `landing`), so arriving never
 * stands in the strip of the door the player came through.
 */
export const DOOR_REACH = INTERACT_RANGE;

/** The strip is the door's width plus this much each side, logical px, so a player brushing the jamb still goes through. */
export const DOOR_SIDE_SLACK = 4;

/**
 * The least cosine between the motion and the direction into the door (a 60
 * degree cone each side): walking along the wall, or sliding past with a
 * sideways lean, does not take it.
 */
export const DOOR_APPROACH_COS = 0.5;

/**
 * Whether the player at (`x`, `y`) walking with `motion` is walking into
 * `door`: standing in the doorway's strip (within `DOOR_REACH` of the door's
 * centre on the room side, and across the door's width) and moving toward the
 * door, not along its wall.
 */
export function walksIntoDoor(
  player: { readonly x: number; readonly y: number },
  motion: MoveInput,
  door: WallDoor,
): boolean {
  const speed = Math.hypot(motion.x, motion.y);
  if (speed === 0) return false;
  const { dx, dy } = INWARD[door.wall];
  const depth = (player.x - door.x) * dx + (player.y - door.y) * dy;
  const across = Math.abs((player.x - door.x) * dy - (player.y - door.y) * dx);
  const halfWidth = (dx === 0 ? door.w : door.h) / 2 + DOOR_SIDE_SLACK;
  if (depth < 0 || depth > DOOR_REACH || across > halfWidth) return false;
  const toward = -(motion.x * dx + motion.y * dy) / speed;
  return toward >= DOOR_APPROACH_COS;
}

/** The target of the door in `room` the player is walking into, if any. */
export function doorWalkedInto(
  player: { readonly x: number; readonly y: number },
  motion: MoveInput,
  room: Room,
): DoorTarget | undefined {
  for (const prop of room.props) {
    if (prop.target === undefined || prop.wall === undefined) continue;
    if (walksIntoDoor(player, motion, wallDoor(room, prop.key))) return prop.target;
  }
  return undefined;
}
