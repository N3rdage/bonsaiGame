/**
 * The 3D world's camera as pure data: the heading, pitch and distance the
 * player has asked for (`CameraRig`), the drag and pinch that move them
 * (`CameraGesture`), and which pieces of the room stand in the camera's way
 * (`cutNames`). Nothing here imports Babylon, Phaser or the DOM, so the
 * clamps and the cut-away rule are unit-testable; renderer.ts eases the real
 * camera toward the rig and lowers the cut pieces.
 *
 * Angles are Babylon's ArcRotateCamera's: alpha is the heading round the
 * target (-90 degrees is south of it, looking north) and beta the pitch from
 * vertical. Positions are in the plan's frame (x east, y south, z up).
 */

import { PLAYER_HEIGHT, type Vec3 } from './meshes';
import type { Box, RoomPlan3d, WallSide } from './plan';

/** The pitch from vertical a new session starts at, 55 degrees, and the heading: south of the player, looking north. */
export const CAMERA_BETA = (55 * Math.PI) / 180;
export const CAMERA_ALPHA = -Math.PI / 2;
/** The pitch limits: 20 degrees off straight down, and 80 degrees, a camera that is still above the floor. */
export const BETA_MIN = (20 * Math.PI) / 180;
export const BETA_MAX = (80 * Math.PI) / 180;
/**
 * The distance limits in metres. At 4 m the player is under half of an 824 x
 * 384 phone's height; at 16 m it is still 45 px tall there, not a speck.
 */
export const RADIUS_MIN = 4;
export const RADIUS_MAX = 16;
/** The distance a session starts at: the player about 80 px tall on that phone, the room round them in view. */
export const RADIUS_DEFAULT = 9;

/** One Q or E press turns the heading by 45 degrees. */
export const TURN_STEP = Math.PI / 4;
/** Radians of heading and pitch per px of drag. */
export const DRAG_RADIANS_PER_PX = 0.008;
/** Zoom per wheel delta unit: a 100-unit notch scales the distance by about 10%. */
export const WHEEL_ZOOM_PER_UNIT = 0.001;
/** The time constant of the easing of the camera toward the rig, in ms. */
export const EASE_MS = 120;

/** A wall faces the camera when the camera's heading and the wall's outward normal have a dot product over this: about 17 degrees past the wall's plane. */
export const FACING_DOT = 0.3;
/** The height a cut-away wall drops to: a skirting board. */
export const SKIRTING_HEIGHT = 0.3;
/** Outdoors only pieces taller than this can hide the player and be cut: the fences the camera sees over stay. */
export const OUTDOOR_CUT_MIN_HEIGHT = 1;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The camera's heading, pitch and distance. */
export interface CameraView {
  readonly alpha: number;
  readonly beta: number;
  readonly radius: number;
}

/** What the player has asked of the camera; alive for the session, across rooms, never saved. */
export class CameraRig implements CameraView {
  alpha = CAMERA_ALPHA;
  beta = CAMERA_BETA;
  radius = RADIUS_DEFAULT;

  /** Turns the heading and pitch by the given radians; the pitch stays clamped. */
  turn(dAlpha: number, dBeta: number): void {
    this.alpha += dAlpha;
    this.beta = clamp(this.beta + dBeta, BETA_MIN, BETA_MAX);
  }

  /** Turns to the next multiple of `TURN_STEP` in `direction` (1 or -1). */
  step(direction: 1 | -1): void {
    this.alpha = (Math.round(this.alpha / TURN_STEP) + direction) * TURN_STEP;
  }

  /** Scales the distance by `factor` (under 1 zooms in); it stays clamped. */
  zoom(factor: number): void {
    this.radius = clamp(this.radius * factor, RADIUS_MIN, RADIUS_MAX);
  }
}

/** The one rig of the session. */
export const cameraRig = new CameraRig();

/** `current` moved toward `goal` by `dtMs` of an exponential ease of time constant `EASE_MS`, frame-rate independent. */
export function ease(current: number, goal: number, dtMs: number): number {
  return current + (goal - current) * (1 - Math.exp(-dtMs / EASE_MS));
}

/** A press on bare ground, as far as routing it goes. */
export interface Press {
  readonly world3d: boolean;
  readonly touch: boolean;
  /** Whether the press is on the left half of the screen. */
  readonly left: boolean;
  readonly stickHeld: boolean;
}

/**
 * Where a press on bare ground goes. In the 2D world it is the stick's. In the
 * 3D world it is the stick's only as a touch on the left half while no stick
 * is held; every other press (the mouse, the right half, a second finger) is
 * the camera's, so a drag is never both.
 */
export function pressRoute(press: Press): 'stick' | 'camera' {
  if (!press.world3d) return 'stick';
  return press.touch && press.left && !press.stickHeld ? 'stick' : 'camera';
}

/**
 * The pointers that move the camera: one turns it by the drag, two zoom it
 * by the change of the distance between them. The caller decides which
 * presses become camera pointers (the stick's and the buttons' never do).
 */
export class CameraGesture {
  private readonly points = new Map<number, { x: number; y: number }>();

  constructor(private readonly rig: CameraRig) {}

  /** Whether the pointer `id` is one of the camera's. */
  has(id: number): boolean {
    return this.points.has(id);
  }

  /** Takes the pointer `id` at (`x`, `y`) unless two are already held; says whether it did. */
  down(id: number, x: number, y: number): boolean {
    if (this.points.size >= 2) return false;
    this.points.set(id, { x, y });
    return true;
  }

  move(id: number, x: number, y: number): void {
    const point = this.points.get(id);
    if (!point) return;
    const other = [...this.points.entries()].find(([key]) => key !== id)?.[1];
    if (other) {
      const before = Math.hypot(point.x - other.x, point.y - other.y);
      const after = Math.hypot(x - other.x, y - other.y);
      if (before > 0 && after > 0) this.rig.zoom(before / after);
    } else {
      this.rig.turn(-(x - point.x) * DRAG_RADIANS_PER_PX, -(y - point.y) * DRAG_RADIANS_PER_PX);
    }
    point.x = x;
    point.y = y;
  }

  up(id: number): void {
    this.points.delete(id);
  }

  clear(): void {
    this.points.clear();
  }
}

/**
 * True if a wall on `side` of the room stands between the camera at `alpha`
 * and the room's interior: the camera is on that side. An `interior` wall
 * bounds no side and is never cut. At a heading between two sides both face it.
 */
export function facesCamera(side: WallSide, alpha: number): boolean {
  if (side === 'interior') return false;
  const east = Math.cos(alpha);
  const south = -Math.sin(alpha);
  const normal = { N: -south, S: south, E: east, W: -east }[side];
  return normal > FACING_DOT;
}

/** The part of a piece spanning heights `z0` to `z1` that stands once it is cut away to `SKIRTING_HEIGHT`, or undefined when none of it is that low. */
export function cutSpan(z0: number, z1: number): { z0: number; z1: number } | undefined {
  return z0 < SKIRTING_HEIGHT ? { z0, z1: Math.min(z1, SKIRTING_HEIGHT) } : undefined;
}

/** The camera's place in the plan's frame for a view round `target`. */
export function cameraPosition(view: CameraView, target: Vec3): Vec3 {
  const flat = view.radius * Math.sin(view.beta);
  return {
    x: target.x + flat * Math.cos(view.alpha),
    y: target.y - flat * Math.sin(view.alpha),
    z: target.z + view.radius * Math.cos(view.beta),
  };
}

/** True if the segment from `a` to `b` passes through the box (the slab test). */
export function segmentCrossesBox(a: Vec3, b: Vec3, box: Box): boolean {
  let enter = 0;
  let leave = 1;
  const axes = [
    [a.x, b.x, box.x0, box.x1],
    [a.y, b.y, box.y0, box.y1],
    [a.z, b.z, box.z0, box.z1],
  ] as const;
  for (const [from, to, lo, hi] of axes) {
    const d = to - from;
    if (d === 0) {
      if (from < lo || from > hi) return false;
      continue;
    }
    const t0 = (lo - from) / d;
    const t1 = (hi - from) / d;
    enter = Math.max(enter, Math.min(t0, t1));
    leave = Math.min(leave, Math.max(t0, t1));
  }
  return enter <= leave;
}

/** The rooms with no roof or ceiling in the way: their buildings' faces are cut only where they hide the player. */
const OUTDOORS: ReadonlySet<RoomPlan3d['key']> = new Set(['garden', 'frontGarden']);

/** Whether `piece` can ever be cut away: any wall indoors, only a tall piece outdoors, so a garden's fences stand for good. */
export function cuttable(plan: RoomPlan3d, piece: Box): boolean {
  return !OUTDOORS.has(plan.key) || piece.z1 - piece.z0 > OUTDOOR_CUT_MIN_HEIGHT;
}

/**
 * The names of the plan's pieces to cut away to the skirting for a camera in
 * `view` round the player standing at `player` (feet, plan metres). Indoors
 * that is each wall on the side the camera is on (`facesCamera`); outdoors,
 * each tall wall or building piece the line from the camera to the player's
 * middle passes through. The camera is taken as centred on the player, which
 * it is once eased.
 */
export function cutNames(plan: RoomPlan3d, view: CameraView, player: Vec3): string[] {
  if (!OUTDOORS.has(plan.key)) {
    return plan.walls.filter((wall) => facesCamera(wall.side, view.alpha)).map((wall) => wall.name);
  }
  const middle = { ...player, z: player.z + PLAYER_HEIGHT / 2 };
  const eye = cameraPosition(view, middle);
  return [...plan.walls, ...plan.furniture]
    .filter((piece) => cuttable(plan, piece) && segmentCrossesBox(eye, middle, piece))
    .map((piece) => piece.name);
}
