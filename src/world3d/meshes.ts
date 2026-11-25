/**
 * The 3D world's mesh list, as pure data: `meshSpecs` turns a room's plan
 * (plan.ts, metres, x east, y south, z up) into the boxes a renderer draws,
 * in the renderer's frame. Nothing here imports Babylon, so the list and the
 * axis mapping are unit-testable.
 */

import { CHARACTER_HEIGHT } from './character';
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

const EPSILON = 1e-6;

/** True if `inner` lies inside `outer` in all three axes: its faces would only fight `outer`'s. */
function nested(inner: Box, outer: Box): boolean {
  return (
    inner.x0 >= outer.x0 - EPSILON &&
    inner.x1 <= outer.x1 + EPSILON &&
    inner.y0 >= outer.y0 - EPSILON &&
    inner.y1 <= outer.y1 + EPSILON &&
    inner.z0 >= outer.z0 - EPSILON &&
    inner.z1 <= outer.z1 + EPSILON
  );
}

/** True if `over` reaches at least as far as `box` does on both ends of an axis. */
const spans = (box: Box, over: Box, lo: 'x0' | 'y0' | 'z0', hi: 'x1' | 'y1' | 'z1'): boolean =>
  over[lo] <= box[lo] + EPSILON && over[hi] >= box[hi] - EPSILON;

/**
 * `box` cut back to where `over` begins or ends, when the two overlap at one
 * end of `box` along a plan axis and `over` spans `box` on the other two: the
 * overlap is a face they share, and `box` gives it up.
 */
function cutBack(box: Box, over: Box): Box {
  if (!spans(box, over, 'z0', 'z1')) return box;
  const alongX = spans(box, over, 'y0', 'y1');
  const alongY = spans(box, over, 'x0', 'x1');
  if (alongX && over.x0 <= box.x0 + EPSILON && over.x1 > box.x0 && over.x1 < box.x1) {
    return { ...box, x0: over.x1 };
  }
  if (alongX && over.x1 >= box.x1 - EPSILON && over.x0 > box.x0 && over.x0 < box.x1) {
    return { ...box, x1: over.x0 };
  }
  if (alongY && over.y0 <= box.y0 + EPSILON && over.y1 > box.y0 && over.y1 < box.y1) {
    return { ...box, y0: over.y1 };
  }
  if (alongY && over.y1 >= box.y1 - EPSILON && over.y0 > box.y0 && over.y0 < box.y1) {
    return { ...box, y1: over.y0 };
  }
  return box;
}

/**
 * The boxes with every surface once. Taller boxes come first (then the wider,
 * then the earlier): each is cut back from the ones before it that share a
 * face with it, and left out if that leaves it inside one, so no two boxes
 * have faces in one plane for the depth test to fight over.
 */
function withoutSharedSurfaces(boxes: readonly Box[]): Box[] {
  const area = (b: Box): number => (b.x1 - b.x0) * (b.y1 - b.y0);
  const ranked = [...boxes].sort((a, b) => b.z1 - a.z1 || area(b) - area(a));
  const kept: Box[] = [];
  const cut = new Map<Box, Box>();
  for (const box of ranked) {
    const trimmed = kept.reduce((b, over) => cutBack(b, over), box);
    if (kept.some((over) => nested(trimmed, over))) continue;
    kept.push(trimmed);
    cut.set(box, trimmed);
  }
  return boxes.flatMap((box) => cut.get(box) ?? []);
}

/**
 * Every box of the plan: the floor, then the walls, then the furniture that
 * has no model (a modelled piece is drawn from furniture.ts's pieces). A box
 * inside another is left out and one that shares a face with another is cut
 * back (a building's wall, its roof's footprint and its face; a band of wall
 * under a building's face), so two washes never share a surface.
 */
export function meshSpecs(plan: RoomPlan3d): MeshSpec[] {
  const drawn = withoutSharedSurfaces([...plan.floor, ...plan.walls, ...plan.furniture]);
  return drawn.filter((box) => box.model === undefined).map(specOf);
}

/** The player's height, metres: the character's, which the camera looks at the middle of. */
export const PLAYER_HEIGHT = CHARACTER_HEIGHT;

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
