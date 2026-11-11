/**
 * The 2D player: movement, facing and the walk-animation counter, one fixed
 * step at a time. Ported from archive/gamemaker/objects/obj_player_2d
 * (Create_0 for the numbers, Step_0 for the behaviour), in logical px.
 */

import { fromPrototype, hitsWall, type Room } from './shedRoom';

export type Facing = 'right' | 'left' | 'down' | 'up';

export interface PlayerState {
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
  /** Walk cycle position 0..4 (frame = floor), 0 when standing still. */
  readonly walkAnim: number;
}

/** Movement intent, each axis in -1..1 (+x right, +y down). */
export interface MoveInput {
  readonly x: number;
  readonly y: number;
}

/** The prototype's step rate; `stepPlayer` is one of these steps. */
export const STEPS_PER_SECOND = 60;
/** Create_0: move_speed = 2.5 prototype px per step. */
export const MOVE_SPEED = fromPrototype(2.5);
/** Step_0: walk_anim += 0.14 per moving step, wrapping at 4. */
export const WALK_ANIM_STEP = 0.14;
export const WALK_FRAMES = 4;

/**
 * Whether a step from walk cycle position `prev` to `next` lands a foot: the
 * frames are `[contact, step-A, contact, step-B]`, so a footstep sounds when
 * the cycle enters frame 0 or frame 2 (the wrap from 3 to 0 included). Standing
 * still (`next` 0) never sounds, nor does staying within a frame.
 */
export function footstepDue(prev: number, next: number): boolean {
  if (next === 0) return false;
  const from = Math.floor(prev);
  const to = Math.floor(next);
  return from !== to && to % 2 === 0;
}

export function createPlayer(room: Room): PlayerState {
  return { x: room.playerStart.x, y: room.playerStart.y, facing: 'down', walkAnim: 0 };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** One step of Step_0's movement, facing and walk animation. */
export function stepPlayer(player: PlayerState, input: MoveInput, room: Room): PlayerState {
  let ix = clamp(input.x, -1, 1);
  let iy = clamp(input.y, -1, 1);
  // The prototype normalises every non-zero input; keyboard input always has
  // length 1 or sqrt(2), so normalising only above 1 is the same for keys and
  // lets the touch joystick walk slower than full speed.
  const len = Math.hypot(ix, iy);
  if (len > 1) {
    ix /= len;
    iy /= len;
  }

  let { x, y } = player;
  const nx = x + ix * MOVE_SPEED;
  if (!hitsWall(room, nx, y)) x = nx;
  const ny = y + iy * MOVE_SPEED;
  if (!hitsWall(room, x, ny)) y = ny;
  // Step_0's clamp keeps the player in the room "regardless of wall coverage";
  // the room is its wall ring, so nothing puts the player outside the walls.
  const { bounds: b, edgeMargin: m } = room;
  x = clamp(x, b.x + m, b.x + b.w - m);
  y = clamp(y, b.y + m, b.y + b.h - m);

  let { facing } = player;
  if (ix > 0.5) facing = 'right';
  else if (ix < -0.5) facing = 'left';
  else if (iy > 0.5) facing = 'down';
  else if (iy < -0.5) facing = 'up';

  let walkAnim = 0;
  if (ix !== 0 || iy !== 0) {
    walkAnim = player.walkAnim + WALK_ANIM_STEP;
    if (walkAnim >= WALK_FRAMES) walkAnim -= WALK_FRAMES;
  }

  return { x, y, facing, walkAnim };
}
