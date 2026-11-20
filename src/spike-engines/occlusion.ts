/**
 * Which walls and roofs stand between the camera and the player (backlog
 * #378), so both engines fade the same ones. Pure: a segment against each
 * occluder's bounding box (scene.ts `occluders`), site frame.
 */

import type { Aabb3, OccluderKey, SiteVec } from './scene';

/** The opacity a faded occluder is drawn at. */
export const FADED_OPACITY = 0.25;

/** Whether the segment from `a` to `b` passes through the box (the slab test); touching its skin does not count. */
export function segmentHitsBox(a: SiteVec, b: SiteVec, box: Aabb3): boolean {
  let t0 = 0;
  let t1 = 1;
  const axes = [
    [a.x, b.x - a.x, box.x0, box.x1],
    [a.y, b.y - a.y, box.y0, box.y1],
    [a.z, b.z - a.z, box.z0, box.z1],
  ] as const;
  for (const [start, delta, lo, hi] of axes) {
    if (Math.abs(delta) < 1e-12) {
      if (start <= lo || start >= hi) return false;
      continue;
    }
    let near = (lo - start) / delta;
    let far = (hi - start) / delta;
    if (near > far) [near, far] = [far, near];
    t0 = Math.max(t0, near);
    t1 = Math.min(t1, far);
    if (t0 >= t1) return false;
  }
  return true;
}

/**
 * The occluders hiding the player from `eye`: those the sight lines to the
 * player's feet (lifted a little off the floor) or head pass through, sorted
 * by key so the list is stable.
 */
export function blockingOccluders(
  eye: SiteVec,
  feet: { readonly x: number; readonly y: number },
  occluders: Readonly<Partial<Record<OccluderKey, Aabb3>>>,
  height = 1.6,
): OccluderKey[] {
  const low = { x: feet.x, y: feet.y, z: 0.3 };
  const high = { x: feet.x, y: feet.y, z: height };
  const out: OccluderKey[] = [];
  for (const [key, box] of Object.entries(occluders) as [OccluderKey, Aabb3 | undefined][]) {
    if (box && (segmentHitsBox(eye, low, box) || segmentHitsBox(eye, high, box))) out.push(key);
  }
  return out.sort();
}
