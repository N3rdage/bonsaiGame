/**
 * Trunk and branch bark as flat triangle-list arrays, ready to feed a three.js
 * BufferGeometry. Pure: no three.js import, so it is unit-tested in Node.
 *
 * Ported from `build_trunk`, the bark part of `build_branch`,
 * `build_ring_with_basis`, `build_ring` and `stitch_rings` in
 * archive/gamemaker/scripts/scr_bonsai_mesh/scr_bonsai_mesh.gml. Shape comes
 * from `trunkFrames` and `branchPoint` only, so what you see is what you score.
 * Foliage is built separately in `foliageMesh.ts`; wire is not built yet.
 */

import type { BonsaiTree, Branch, Vec3 } from '../sim/types';
import { DISPLAY_SCALE, branchPoint, trunkFrames } from '../sim/geometry';
import { dcos, dsin } from '../sim/vec3';
import { TriangleList, type MeshArrays } from './meshArrays';
import type { Rgb } from './potPalette';

export const TRUNK_RING_SEGMENTS = 10;
export const TRUNK_MIN_RADIUS = 0.001;
export const TRUNK_BARK_RGB: Rgb = { r: 90, g: 60, b: 40 };

/** Rings along a branch, base to tip, minus one. */
export const BRANCH_SEGMENTS = 6;
export const BRANCH_RING_SEGMENTS = 6;
/** Branch radius at the tip as a fraction of its base radius. */
export const BRANCH_TIP_FRACTION = 0.2;
export const BRANCH_MIN_RADIUS = 0.005;
export const BRANCH_BARK_RGB: Rgb = { r: 110, g: 75, b: 50 };

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

/** Trunk radius at the soil line in display units (girth is a diameter in mm). */
export function trunkBaseRadius(tree: BonsaiTree): number {
  return (tree.trunk.girthMm / 1000 / 2) * DISPLAY_SCALE;
}

/** `segments` points around `centre` in the plane spanned by the unit vectors u and v. */
export function buildRingWithBasis(
  centre: Vec3,
  radius: number,
  segments: number,
  u: Vec3,
  v: Vec3,
): Vec3[] {
  const ring: Vec3[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * 360;
    const ca = dcos(a);
    const sa = dsin(a);
    ring.push({
      x: centre.x + (ca * u.x + sa * v.x) * radius,
      y: centre.y + (ca * u.y + sa * v.y) * radius,
      z: centre.z + (ca * u.z + sa * v.z) * radius,
    });
  }
  return ring;
}

/** `segments` points around `centre` in the horizontal plane through it. */
export function buildRing(centre: Vec3, radius: number, segments: number): Vec3[] {
  const ring: Vec3[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * 360;
    ring.push({ x: centre.x + dcos(a) * radius, y: centre.y + dsin(a) * radius, z: centre.z });
  }
  return ring;
}

/** Two triangles per ring segment, (a1, b1, a2) then (a2, b1, b2), in one colour. */
export function stitchRings(list: TriangleList, ringA: Vec3[], ringB: Vec3[], c: Rgb): void {
  const n = ringA.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a1 = ringA[i];
    const a2 = ringA[j];
    const b1 = ringB[i];
    const b2 = ringB[j];
    if (!a1 || !a2 || !b1 || !b2) return;
    list.vertex(a1, c);
    list.vertex(b1, c);
    list.vertex(a2, c);
    list.vertex(a2, c);
    list.vertex(b1, c);
    list.vertex(b2, c);
  }
}

function buildTrunk(list: TriangleList, tree: BonsaiTree): void {
  const base = trunkBaseRadius(tree);
  const frames = trunkFrames(tree);
  const n = frames.length;
  let prev: Vec3[] | undefined;
  frames.forEach((f, i) => {
    const t = n > 1 ? i / (n - 1) : 0;
    const r = Math.max(lerp(base, base * (1 - tree.trunk.taper), t), TRUNK_MIN_RADIUS);
    const ring = buildRingWithBasis(f.pos, r, TRUNK_RING_SEGMENTS, f.normal, f.binormal);
    if (prev) stitchRings(list, prev, ring, TRUNK_BARK_RGB);
    prev = ring;
  });
}

function buildBranchBark(list: TriangleList, tree: BonsaiTree, branch: Branch): void {
  const r0 = (branch.girth / 1000) * DISPLAY_SCALE;
  let prev: Vec3[] | undefined;
  for (let i = 0; i <= BRANCH_SEGMENTS; i++) {
    const t = i / BRANCH_SEGMENTS;
    const r = Math.max(lerp(r0, r0 * BRANCH_TIP_FRACTION, t), BRANCH_MIN_RADIUS);
    const ring = buildRing(branchPoint(tree, branch, t), r, BRANCH_RING_SEGMENTS);
    if (prev) stitchRings(list, prev, ring, BRANCH_BARK_RGB);
    prev = ring;
  }
}

/** The trunk, then each branch in order, as one triangle list. */
export function buildTreeMesh(tree: BonsaiTree): MeshArrays {
  const list = new TriangleList();
  buildTrunk(list, tree);
  for (const branch of tree.branches) buildBranchBark(list, tree, branch);
  return list.build();
}
