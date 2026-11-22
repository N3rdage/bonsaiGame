/**
 * The sun's shadow frustum for one room, fitted once from the room's extent
 * rather than from the casters each frame. A frustum that refits to the
 * player's and the trees' bounds slides the shadow map's texels under the
 * floor as they move, and a depth range left to the camera's near and far
 * (1 to 10000 m) spends the map's precision on empty space, which shows as
 * shadow acne. Pure: no Babylon.
 */

import type { Vec3 } from './meshes';

/** An axis-aligned box in Babylon's frame. */
export interface Extent {
  readonly min: Vec3;
  readonly max: Vec3;
}

/** The light's eye, its orthographic window in the light's view and its depth range along the light, all metres. */
export interface ShadowFrustum {
  readonly position: Vec3;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly top: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** Room around the extent on every side, so a caster just past a wall still lands in the map. */
const MARGIN = 0.5;

/** The step a window edge is rounded out to, in metres. */
const SNAP = 0.5;

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function unit(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/**
 * The frustum that holds `extent` for a light travelling along the unit
 * `direction`, in Babylon's left-handed look-at frame (x right, y up, z along
 * the light) with the eye placed so every depth is positive.
 */
export function shadowFrustum(extent: Extent, direction: Vec3): ShadowFrustum {
  const { min, max } = extent;
  const centre = {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    z: (min.z + max.z) / 2,
  };
  const reach = Math.hypot(max.x - min.x, max.y - min.y, max.z - min.z) / 2 + MARGIN;
  const position = {
    x: centre.x - direction.x * reach,
    y: centre.y - direction.y * reach,
    z: centre.z - direction.z * reach,
  };
  const right = unit(cross({ x: 0, y: 1, z: 0 }, direction));
  const up = cross(direction, right);
  let left = Infinity;
  let bottom = Infinity;
  let rightEdge = -Infinity;
  let top = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const x of [min.x, max.x]) {
    for (const y of [min.y, max.y]) {
      for (const z of [min.z, max.z]) {
        const from = { x: x - position.x, y: y - position.y, z: z - position.z };
        const u = dot(from, right);
        const v = dot(from, up);
        const w = dot(from, direction);
        left = Math.min(left, u);
        rightEdge = Math.max(rightEdge, u);
        bottom = Math.min(bottom, v);
        top = Math.max(top, v);
        minZ = Math.min(minZ, w);
        maxZ = Math.max(maxZ, w);
      }
    }
  }
  const down = (n: number): number => Math.floor((n - MARGIN) / SNAP) * SNAP;
  const upTo = (n: number): number => Math.ceil((n + MARGIN) / SNAP) * SNAP;
  return {
    position,
    left: down(left),
    right: upTo(rightEdge),
    bottom: down(bottom),
    top: upTo(top),
    minZ: Math.max(0.1, minZ - MARGIN),
    maxZ: maxZ + MARGIN,
  };
}
