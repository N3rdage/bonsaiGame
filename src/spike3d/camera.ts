/**
 * The spike's fixed cameras as pure maths (backlog #359). Each angle is an
 * orthographic camera pitched down at the player from a compass side: `south`
 * is today's view (north up the screen, the house's roof toward the viewer),
 * `cutaway` the same with the buildings cut down to see over them, and
 * `north` stands on the road and looks at the house's front. Screen-relative
 * things (the light, the keys, the player's facing) turn with the camera, so
 * the light stays in the upper left and up is always up the screen.
 */

import type { Facing, MoveInput } from '../world/player';
import { CAST_SHADOW } from '../world/lighting';
import { viewSize, worldZoom } from '../world/worldCamera';
import { ROOM_PX_PER_METRE } from '../spike-engines/site';

export type AngleKey = 'south' | 'cutaway' | 'north';

export interface Angle {
  readonly key: AngleKey;
  /** Degrees round from the south: 0 looks north, 180 looks south. */
  readonly yaw: number;
  /** Degrees down from the horizontal. */
  readonly pitch: number;
  /** Site y, metres, the camera looks at; it follows the player along x only. */
  readonly focusY: number;
  /** Whether the buildings are cut down to `CUT_HEIGHT` (site.ts) so the camera sees over them. */
  readonly cutaway: boolean;
}

/** In the order the C key cycles them. */
const SOUTH: Angle = { key: 'south', yaw: 0, pitch: 55, focusY: -2.5, cutaway: false };
export const ANGLES: readonly Angle[] = [
  SOUTH,
  { ...SOUTH, key: 'cutaway', cutaway: true },
  { key: 'north', yaw: 180, pitch: 40, focusY: -1.5, cutaway: false },
];

/** The angle named `key`, or `south` if no angle has that name. */
export function angleNamed(key: string | null): Angle {
  return ANGLES.find((a) => a.key === key) ?? SOUTH;
}

/** The angle after `angle`, as the C key cycles them. */
export function nextAngle(angle: Angle): Angle {
  return ANGLES[(ANGLES.indexOf(angle) + 1) % ANGLES.length] ?? angle;
}

/** A vector in three.js's frame: x east, y up, z south (site y). */
export interface Vec {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Unit vector from the target toward the camera. */
export function eyeDirection({ yaw, pitch }: Angle): Vec {
  const c = Math.cos(rad(pitch));
  return { x: Math.sin(rad(yaw)) * c, y: Math.sin(rad(pitch)), z: Math.cos(rad(yaw)) * c };
}

/** The screen's right and down along the ground at `yaw`, as unit vectors (x east, z south). */
function groundAxes(yaw: number): { right: Vec; down: Vec } {
  const c = Math.cos(rad(yaw));
  const s = Math.sin(rad(yaw));
  return { right: { x: c, y: 0, z: -s }, down: { x: s, y: 0, z: c } };
}

/**
 * Toward the rooms' one light (src/world/lighting.ts) at `yaw`: a post one
 * unit tall casts its shadow `CAST_SHADOW.length` along the screen's
 * `CAST_SHADOW.direction`, down and to the right, as in every room. Unit length.
 */
export function lightDirection(yaw: number): Vec {
  const [dx, dy] = CAST_SHADOW.direction;
  const { right, down } = groundAxes(yaw);
  const sx = CAST_SHADOW.length * (dx * right.x + dy * down.x);
  const sz = CAST_SHADOW.length * (dx * right.z + dy * down.z);
  const len = Math.hypot(sx, 1, sz);
  return { x: -sx / len, y: 1 / len, z: -sz / len };
}

/** Screen-relative keys (+x right, +y down the screen) as movement in room px axes (+x east, +y south). */
export function roomInput(screen: MoveInput, yaw: number): MoveInput {
  const { right, down } = groundAxes(yaw);
  const x = screen.x * right.x + screen.y * down.x;
  const y = screen.x * right.z + screen.y * down.z;
  // Round away the float dust of cos(180°), so a key held reads exactly as the room expects.
  return { x: Math.round(x * 1e9) / 1e9 || 0, y: Math.round(y * 1e9) / 1e9 || 0 };
}

const BY_QUARTER: readonly Facing[] = ['up', 'right', 'down', 'left'];

/** Which way a player facing `facing` on the ground looks on screen at `yaw`, for its sprite row. */
export function screenFacing(facing: Facing, yaw: number): Facing {
  const turn = Math.round(yaw / 90);
  const index = BY_QUARTER.indexOf(facing) + turn;
  return BY_QUARTER[((index % 4) + 4) % 4] ?? facing;
}

/**
 * The orthographic view's width in metres for a `cssWidth` x `cssHeight`
 * viewport: today's world camera's (worldCamera.ts), 480 room px on a
 * desktop and 384 on a phone, at 32 px a metre.
 */
export function viewWidthMetres(cssWidth: number, cssHeight: number): number {
  return viewSize(worldZoom(cssWidth, cssHeight)).w / ROOM_PX_PER_METRE;
}

/** Where the camera looks along x: the player, held where the view's edges stay within `x0..x1`. */
export function followX(playerX: number, viewWidth: number, x0: number, x1: number): number {
  const lo = x0 + viewWidth / 2;
  const hi = x1 - viewWidth / 2;
  return lo > hi ? (x0 + x1) / 2 : Math.min(hi, Math.max(lo, playerX));
}
