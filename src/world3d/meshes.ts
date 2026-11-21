/**
 * The 3D world's mesh list, as pure data: `meshSpecs` turns a room's plan
 * (plan.ts, metres, x east, y south, z up) into the boxes a renderer draws,
 * in the renderer's frame. Nothing here imports Babylon, so the list and the
 * axis mapping are unit-testable.
 */

import {
  DOOR_HEIGHT,
  DOOR_WIDTH,
  metres,
  pixels,
  type Box,
  type RoomPlan3d,
  type WashKey,
} from './plan';

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

/** The inverse of `toBabylon`: a point of Babylon's frame in the plan's. */
export function fromBabylon(p: Vec3): Vec3 {
  return { x: p.x, y: -p.z, z: p.y };
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

/** The room px (the 2D player's position) of a floor point of Babylon's frame: the inverse of `toBabylon` then `playerFeet`. */
export function roomPx(p: Vec3): { x: number; y: number } {
  const plan = fromBabylon(p);
  return { x: pixels(plan.x), y: pixels(plan.y) };
}

/** An invisible box a tap can hit: a prop, by the id the 2D world knows it by. */
export interface HotspotSpec {
  readonly key: string;
  readonly center: Vec3;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

/**
 * One box per prop (the plan's anchors, so the ids are the room data's): over
 * its footprint, at least a door's width each way so a thin door or a spot on
 * a pedestal is still a target, and a door's height tall.
 */
export function hotspotSpecs(plan: RoomPlan3d): HotspotSpec[] {
  return plan.anchors.map((a) => ({
    key: a.key,
    center: toBabylon({ x: a.x, y: a.y, z: DOOR_HEIGHT / 2 }),
    width: Math.max(a.width, DOOR_WIDTH),
    height: DOOR_HEIGHT,
    depth: Math.max(a.depth, DOOR_WIDTH),
  }));
}
