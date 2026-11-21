/**
 * The 3D world's mesh list, as pure data: `meshSpecs` turns a room's plan
 * (plan.ts, metres, x east, y south, z up) into the boxes a renderer draws,
 * in the renderer's frame. Nothing here imports Babylon, so the list, the
 * axis mapping and the camera framing are unit-testable.
 */

import { metres, type Box, type RoomPlan3d, type WashKey } from './plan';

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * The plan's frame in Babylon's, which is left-handed with y up: east stays
 * +x, up (plan z) becomes y and south (plan y) becomes -z, so north is
 * +z, away from a camera in the south, and east is on its right.
 */
export function toBabylon(p: Vec3): Vec3 {
  return { x: p.x, y: p.z, z: -p.y };
}

/** A box to draw: its centre and extents in Babylon's frame. */
export interface MeshSpec {
  readonly name: string;
  readonly wash: WashKey;
  readonly center: Vec3;
  /** Extents along Babylon's x, y and z: the plan's east-west, vertical and north-south spans. */
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

function specOf(b: Box): MeshSpec {
  return {
    name: b.name,
    wash: b.wash,
    center: toBabylon({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 }),
    width: b.x1 - b.x0,
    height: b.z1 - b.z0,
    depth: b.y1 - b.y0,
  };
}

/** True if `inner` lies inside `outer` in all three axes and `outer` is taller: its faces would only fight `outer`'s. */
function buried(inner: Box, outer: Box): boolean {
  return (
    inner.x0 >= outer.x0 &&
    inner.x1 <= outer.x1 &&
    inner.y0 >= outer.y0 &&
    inner.y1 <= outer.y1 &&
    inner.z0 >= outer.z0 &&
    inner.z1 < outer.z1
  );
}

/**
 * Every box of the plan: the floor, then the walls, then the furniture. A
 * wall inside a taller piece of furniture (the front garden's band under a
 * building's face) is left out, so two washes never share a surface.
 */
export function meshSpecs(plan: RoomPlan3d): MeshSpec[] {
  const walls = plan.walls.filter((wall) => !plan.furniture.some((piece) => buried(wall, piece)));
  return [...plan.floor, ...walls, ...plan.furniture].map(specOf);
}

/** A capsule 1.6 m tall and 0.3 m in radius stands for the player until there is a model. */
export const PLAYER_HEIGHT = 1.6;
export const PLAYER_RADIUS = 0.3;

/** The player's feet in plan metres, from the 2D player's position in room px. */
export function playerFeet(px: { readonly x: number; readonly y: number }): Vec3 {
  return { x: metres(px.x), y: metres(px.y), z: 0 };
}

/** The camera's pitch from vertical, 55 degrees, and its heading: south of the target, looking north. */
export const CAMERA_BETA = (55 * Math.PI) / 180;
export const CAMERA_ALPHA = -Math.PI / 2;
/** The camera's vertical field of view, Babylon's default 0.8 rad. */
export const CAMERA_FOV = 0.8;

/** The target and distance that frame the whole floor: its centre, and the radius whose view holds the floor's diagonal. */
export function cameraFraming(plan: RoomPlan3d): { target: Vec3; radius: number } {
  const x0 = Math.min(...plan.floor.map((b) => b.x0));
  const x1 = Math.max(...plan.floor.map((b) => b.x1));
  const y0 = Math.min(...plan.floor.map((b) => b.y0));
  const y1 = Math.max(...plan.floor.map((b) => b.y1));
  return {
    target: toBabylon({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: 0 }),
    radius: Math.hypot(x1 - x0, y1 - y0) / 2 / Math.tan(CAMERA_FOV / 2),
  };
}
