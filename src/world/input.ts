/**
 * Turning raw input into movement intent and frame time into fixed steps.
 * Pure, so the scene only reads keys and pointers and passes them in.
 */

import { STEPS_PER_SECOND, type MoveInput } from './player';

export interface HeldKeys {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
}

/** Step_0: right minus left, down minus up (arrows and WASD already merged per direction). */
export function keyboardInput(keys: HeldKeys): MoveInput {
  return {
    x: Number(keys.right) - Number(keys.left),
    y: Number(keys.down) - Number(keys.up),
  };
}

/** Drag distance in logical px below which the joystick reads as still. */
export const JOYSTICK_DEAD_ZONE = 4;
/** Drag distance in logical px at which the joystick reads full speed. */
export const JOYSTICK_RADIUS = 24;

/** The touch joystick: the drag from where the pointer went down to where it is now. */
export function joystickInput(dx: number, dy: number): MoveInput {
  const len = Math.hypot(dx, dy);
  if (len < JOYSTICK_DEAD_ZONE) return { x: 0, y: 0 };
  const scale = 1 / Math.max(len, JOYSTICK_RADIUS);
  return { x: dx * scale, y: dy * scale };
}

export const STEP_MS = 1000 / STEPS_PER_SECOND;
/** At most this many steps per frame, so a long stall does not fast-forward the player. */
export const MAX_STEPS_PER_FRAME = 5;

/**
 * Fixed-rate accumulator: adds a frame's `deltaMs` to the carried remainder and
 * returns how many whole steps to run and the new remainder, so movement runs
 * at STEPS_PER_SECOND whatever the display's refresh rate.
 */
export function fixedSteps(
  accumulatorMs: number,
  deltaMs: number,
): {
  steps: number;
  accumulatorMs: number;
} {
  const total = accumulatorMs + Math.max(0, deltaMs);
  const whole = Math.floor(total / STEP_MS);
  const steps = Math.min(whole, MAX_STEPS_PER_FRAME);
  return { steps, accumulatorMs: whole > steps ? 0 : total - whole * STEP_MS };
}
