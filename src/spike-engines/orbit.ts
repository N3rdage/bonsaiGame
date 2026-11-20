/**
 * The orbit camera's state and the gestures that change it (backlog #378):
 * yaw, pitch and distance about a target over the player, clamped, from
 * mouse or touch drags, pinches, the wheel and keys. Pure and engine-neutral;
 * each engine only places its camera at `eyeOf` looking at the target.
 */

import type { SiteVec } from './scene';

export interface OrbitState {
  /** Degrees round the target: 0 stands south of it looking north, 90 stands east looking west. */
  readonly yaw: number;
  /** Degrees above the horizontal. */
  readonly pitch: number;
  /** Metres from the target. */
  readonly distance: number;
}

export const PITCH_MIN = 12;
export const PITCH_MAX = 80;
export const DISTANCE_MIN = 3;
export const DISTANCE_MAX = 18;
export const DRAG_DEGREES_PER_PX = 0.3;
/** Each wheel notch (100 px of deltaY) scales the distance by this. */
export const WHEEL_FACTOR = 1.12;
/** Degrees a second the Q and E keys turn the camera. */
export const KEY_TURN_DEG_PER_S = 90;
/** The target's height over the player's feet, metres: about the chest. */
export const TARGET_HEIGHT = 1;

export const DEFAULT_ORBIT: OrbitState = { yaw: 0, pitch: 45, distance: 9 };

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Yaw wrapped into 0..360, pitch and distance clamped. */
export function clampOrbit(o: OrbitState): OrbitState {
  return {
    yaw: ((o.yaw % 360) + 360) % 360,
    pitch: clamp(o.pitch, PITCH_MIN, PITCH_MAX),
    distance: clamp(o.distance, DISTANCE_MIN, DISTANCE_MAX),
  };
}

/** A one-finger or mouse drag of dx, dy CSS px: drag right swings the view round to the right, drag down looks from higher. */
export function dragOrbit(o: OrbitState, dx: number, dy: number): OrbitState {
  return clampOrbit({
    ...o,
    yaw: o.yaw - dx * DRAG_DEGREES_PER_PX,
    pitch: o.pitch + dy * DRAG_DEGREES_PER_PX,
  });
}

/** A pinch from `startPx` apart to `nowPx` apart, against the state when it began: spreading moves in. */
export function pinchOrbit(start: OrbitState, startPx: number, nowPx: number): OrbitState {
  if (startPx <= 0 || nowPx <= 0) return start;
  return clampOrbit({ ...start, distance: (start.distance * startPx) / nowPx });
}

/** A wheel's deltaY in px (100 a notch): down moves out. */
export function wheelOrbit(o: OrbitState, deltaY: number): OrbitState {
  return clampOrbit({ ...o, distance: o.distance * WHEEL_FACTOR ** (deltaY / 100) });
}

/** Turning with keys for `dt` seconds: `turn` -1 (Q) or 1 (E). */
export function keyTurnOrbit(o: OrbitState, turn: number, dt: number): OrbitState {
  return clampOrbit({ ...o, yaw: o.yaw + turn * KEY_TURN_DEG_PER_S * dt });
}

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** The camera's eye for a target, site frame. */
export function eyeOf(o: OrbitState, target: SiteVec): SiteVec {
  const flat = Math.cos(rad(o.pitch)) * o.distance;
  return {
    x: target.x + Math.sin(rad(o.yaw)) * flat,
    y: target.y + Math.cos(rad(o.yaw)) * flat,
    z: target.z + Math.sin(rad(o.pitch)) * o.distance,
  };
}

/** What the camera looks at: over the player's feet. */
export function targetOf(feet: { readonly x: number; readonly y: number }): SiteVec {
  return { x: feet.x, y: feet.y, z: TARGET_HEIGHT };
}
