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

/** The extent of a box: what the slab test needs of it. */
type Extent = Pick<Box, 'x0' | 'x1' | 'y0' | 'y1' | 'z0' | 'z1'>;

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
}

/**
 * Where a press on bare ground goes. In the 2D world it is the stick's. In the
 * 3D world it is the stick's only as a touch on the left half; every other
 * press (the mouse, the right half) is the camera's, so a drag is never both.
 * A second finger is neither, whichever half it lands in: `CameraGesture`
 * makes the two a pinch.
 */
export function pressRoute(press: Press): 'stick' | 'camera' {
  if (!press.world3d) return 'stick';
  return press.touch && press.left ? 'stick' : 'camera';
}

/**
 * What a first press is to the gesture: the `stick`'s, one that turns the
 * `camera` by its drag, or a press on a HUD `button`, which is held so a second
 * finger still makes a pinch but neither turns the camera nor is the stick.
 */
export type PressRole = 'stick' | 'camera' | 'button';

/** What `CameraGesture.down` made of a press: the stick's, a camera drag, a HUD button's, the second finger that starts a pinch, or a press it ignores. */
export type GestureDown = 'stick' | 'drag' | 'button' | 'pinch' | 'ignored';

/**
 * The pointers on the canvas in the 3D world: one is the stick, turns the
 * camera by its drag or is on a HUD button; two are a pinch that zooms the
 * camera by the change of the distance between them and does nothing else.
 * The second finger makes the first one's stick, drag, tap or button press part
 * of a pinch, wherever each lands, a button included; the pinch lasts until
 * every finger is up, so a finger that stays down or a third that joins turns
 * and taps nothing.
 */
export class CameraGesture {
  private readonly points = new Map<number, { x: number; y: number; role: PressRole }>();
  private pinch = false;

  constructor(private readonly rig: CameraRig) {}

  /** Whether any pointer is held, so a second finger counts wherever it lands. */
  get held(): boolean {
    return this.points.size > 0;
  }

  /** Whether two fingers are or were down and not all are up yet: a button's release in that time is part of the pinch. */
  get pinching(): boolean {
    return this.pinch;
  }

  /** Takes the pointer `id` at (`x`, `y`) in `role`; says what the press is. */
  down(id: number, x: number, y: number, role: PressRole): GestureDown {
    if (this.pinch || this.points.has(id)) return 'ignored';
    const first = this.points.size === 0;
    this.points.set(id, { x, y, role });
    if (first) return role === 'camera' ? 'drag' : role;
    this.pinch = true;
    return 'pinch';
  }

  move(id: number, x: number, y: number): void {
    const point = this.points.get(id);
    if (!point) return;
    const other = [...this.points.entries()].find(([key]) => key !== id)?.[1];
    if (this.pinch) {
      if (other) {
        const before = Math.hypot(point.x - other.x, point.y - other.y);
        const after = Math.hypot(x - other.x, y - other.y);
        if (before > 0 && after > 0) this.rig.zoom(before / after);
      }
    } else if (point.role === 'camera') {
      this.rig.turn(-(x - point.x) * DRAG_RADIANS_PER_PX, -(y - point.y) * DRAG_RADIANS_PER_PX);
    }
    point.x = x;
    point.y = y;
  }

  /** Lets go of the pointer `id`; says what its press was, undefined if it was not held. */
  up(id: number): Exclude<GestureDown, 'ignored'> | undefined {
    const point = this.points.get(id);
    if (!point) return undefined;
    const kind = this.pinch ? 'pinch' : point.role === 'camera' ? 'drag' : point.role;
    this.points.delete(id);
    if (this.points.size === 0) this.pinch = false;
    return kind;
  }

  clear(): void {
    this.points.clear();
    this.pinch = false;
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
export function segmentCrossesBox(a: Vec3, b: Vec3, box: Extent): boolean {
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
 * each tall wall or building piece, and each roof (over its footprint from the floor), the line from the camera to the player's
 * middle passes through. The camera is taken as centred on the player, which
 * it is once eased.
 */
export function cutNames(plan: RoomPlan3d, view: CameraView, player: Vec3): string[] {
  if (!OUTDOORS.has(plan.key)) {
    return plan.walls.filter((wall) => facesCamera(wall.side, view.alpha)).map((wall) => wall.name);
  }
  const middle = { ...player, z: player.z + PLAYER_HEIGHT / 2 };
  const eye = cameraPosition(view, middle);
  const pieces = [...plan.walls, ...plan.furniture]
    .filter((piece) => cuttable(plan, piece) && segmentCrossesBox(eye, middle, piece))
    .map((piece) => piece.name);
  const roofs = plan.roofs
    .filter((roof) => segmentCrossesBox(eye, middle, { ...roof, z0: 0, z1: roof.high }))
    .map((roof) => roof.name);
  return [...pieces, ...roofs];
}
