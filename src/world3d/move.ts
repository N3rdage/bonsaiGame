/**
 * Walking in the 3D world, as pure functions: the player's input is read
 * against the camera, so "up" is away from it whatever the heading. Collision
 * stays the 2D plan's; only the vector handed to the 2D player is turned.
 */

import type { MoveInput } from '../world/player';

/**
 * The plan-space move (x east, y south) for `input` (x right, y down on the
 * screen) with the camera at heading `alpha` (Babylon's ArcRotateCamera
 * alpha, as in camera.ts). The camera stands at (cos, -sin) of the player in
 * the plan, so away from it is (-cos, sin) and the screen's right is
 * (-sin, -cos). A rotation, so the length, and with it the speed, is
 * unchanged; at the default heading (-90 degrees) it is the identity.
 */
export function cameraRelative(input: MoveInput, alpha: number): MoveInput {
  const sin = Math.sin(alpha);
  const cos = Math.cos(alpha);
  return {
    x: -input.x * sin + input.y * cos,
    y: -input.x * cos - input.y * sin,
  };
}

/** The heading of a step of (`dx`, `dy`) plan metres in radians (0 east, pi/2 south), or `previous` when it is too short to say. */
export function facingOf(dx: number, dy: number, previous: number): number {
  return Math.hypot(dx, dy) < 1e-6 ? previous : Math.atan2(dy, dx);
}
