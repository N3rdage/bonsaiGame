/**
 * Trunk and branch bark as flat triangle-list arrays, ready to feed a three.js
 * BufferGeometry. Pure: no three.js import, so it is unit-tested in Node.
 *
 * Ported from `build_trunk`, the bark and wire parts of `build_branch`,
 * `add_wire_coil`, `add_wire_anchor`, `build_ring_with_basis`,
 * `build_oriented_ring`, `build_ring` and `stitch_rings` in
 * archive/gamemaker/scripts/scr_bonsai_mesh/scr_bonsai_mesh.gml. Shape comes
 * from `trunkFrames`, `branchPoint` and the `*FrameAt` lookups only, so what
 * you see is what you score. A wired branch's copper coil and trunk anchor are
 * appended to the bark list right after that branch's bark, as the prototype
 * appended them to its bark buffer. Foliage is built separately in
 * `foliageMesh.ts`.
 */

import type { BonsaiTree, Branch, Frame, Vec3 } from '../sim/types';
import {
  DISPLAY_SCALE,
  branchFrameAt,
  branchPoint,
  trunkFrameAt,
  trunkFrames,
} from '../sim/geometry';
import { clamp, dcos, dsin } from '../sim/vec3';
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

/** Copper training wire. */
export const WIRE_RGB: Rgb = { r: 180, g: 110, b: 50 };
/** Wire radius as a fraction of the branch's base radius, unbent and at full bend. */
export const WIRE_GAUGE_MIN = 0.15;
export const WIRE_GAUGE_MAX = 0.3;
/** Bend magnitude (degrees) at which the wire reaches its thickest gauge. */
export const WIRE_FULL_BEND_DEG = 60;
export const WIRE_MIN_RADIUS = 0.002;
/** Coil pitch in wire diameters: a comfortable, hand-applied wrap with visible gaps. */
export const WIRE_PITCH_DIAMETERS = 3;
export const WIRE_SEGS_PER_TURN = 8;
export const WIRE_MIN_SEGS = 20;
export const WIRE_RING_SEGMENTS = 6;
/** Turns the anchor wraps around the trunk before feeding into the branch. */
export const ANCHOR_TURNS = 1.5;
export const ANCHOR_MIN_SEGS = 16;

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

/**
 * `segments` points around `centre` in the plane perpendicular to the unit
 * vector `n`. The reference axis is world +z, or +x when `n` is nearly
 * vertical so the cross product cannot collapse.
 */
export function buildOrientedRing(centre: Vec3, radius: number, segments: number, n: Vec3): Vec3[] {
  const ref = Math.abs(n.z) < 0.95 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const ux = ref.y * n.z - ref.z * n.y;
  const uy = ref.z * n.x - ref.x * n.z;
  const uz = ref.x * n.y - ref.y * n.x;
  let ulen = Math.sqrt(ux * ux + uy * uy + uz * uz);
  if (ulen < 0.0001) ulen = 1;
  const u = { x: ux / ulen, y: uy / ulen, z: uz / ulen };
  const v = {
    x: n.y * u.z - n.z * u.y,
    y: n.z * u.x - n.x * u.z,
    z: n.x * u.y - n.y * u.x,
  };
  return buildRingWithBasis(centre, radius, segments, u, v);
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

/** Wire radius for a branch: thicker for thicker and more sharply bent branches. */
export function wireRadius(branch: Branch): number {
  const branchRBase = (branch.girth / 1000) * DISPLAY_SCALE;
  const bendFactor = clamp(Math.abs(branch.bend) / WIRE_FULL_BEND_DEG, 0, 1);
  return Math.max(WIRE_MIN_RADIUS, branchRBase * lerp(WIRE_GAUGE_MIN, WIRE_GAUGE_MAX, bendFactor));
}

/** Coil turns along a branch: its length over the pitch, at least one. */
export function wireCoilTurns(branch: Branch): number {
  const pitch = WIRE_PITCH_DIAMETERS * (2 * wireRadius(branch));
  const lengthWorld = (branch.length / 100) * DISPLAY_SCALE;
  return Math.max(1, lengthWorld / pitch);
}

/** Bands in a branch's coil (rings minus one). */
export function wireCoilSegments(branch: Branch): number {
  return Math.max(WIRE_MIN_SEGS, Math.ceil(wireCoilTurns(branch) * WIRE_SEGS_PER_TURN));
}

/** Bands in a trunk anchor (rings minus one). */
export const ANCHOR_SEGMENTS = Math.max(
  ANCHOR_MIN_SEGS,
  Math.ceil(ANCHOR_TURNS * WIRE_SEGS_PER_TURN),
);

/**
 * Centre and unit tangent of a helix of radius `offset` around `f.pos`, at
 * `theta` degrees in the frame's normal/binormal plane, lifted `axial` along
 * its tangent. Speeds are lengths per unit of the sweep parameter.
 */
function helixSample(
  f: Frame,
  theta: number,
  offset: number,
  axial: number,
  axialSpeed: number,
  radialSpeed: number,
): { centre: Vec3; tangent: Vec3 } {
  const ca = dcos(theta);
  const sa = dsin(theta);
  const centre = {
    x: f.pos.x + (ca * f.normal.x + sa * f.binormal.x) * offset + f.tangent.x * axial,
    y: f.pos.y + (ca * f.normal.y + sa * f.binormal.y) * offset + f.tangent.y * axial,
    z: f.pos.z + (ca * f.normal.z + sa * f.binormal.z) * offset + f.tangent.z * axial,
  };
  const radialMag = offset * radialSpeed;
  const tx = f.tangent.x * axialSpeed + (-sa * f.normal.x + ca * f.binormal.x) * radialMag;
  const ty = f.tangent.y * axialSpeed + (-sa * f.normal.y + ca * f.binormal.y) * radialMag;
  const tz = f.tangent.z * axialSpeed + (-sa * f.normal.z + ca * f.binormal.z) * radialMag;
  const tlen = Math.sqrt(tx * tx + ty * ty + tz * tz);
  return { centre, tangent: { x: tx / tlen, y: ty / tlen, z: tz / tlen } };
}

/**
 * Trunk-side anchor: a short helix wrapped around the trunk at the branch's
 * base, along the trunk's local tangent, ending on the side the branch leaves
 * from so it reads as feeding into the coil.
 */
export function addWireAnchor(
  list: TriangleList,
  tree: BonsaiTree,
  branch: Branch,
  wireR: number,
  col: Rgb,
): void {
  const trunk = tree.trunk;
  const t = clamp(branch.originY / trunk.heightCm, 0, 1);
  const baseR = trunkBaseRadius(tree);
  const trunkR = lerp(baseR, baseR * (1 - trunk.taper), t);
  const f = trunkFrameAt(tree, t);

  const anchorH = ANCHOR_TURNS * WIRE_PITCH_DIAMETERS * (2 * wireR);
  const offset = trunkR + wireR;
  const endAngle = branch.angle;
  const startAngle = endAngle - ANCHOR_TURNS * 360;
  const radialSpeed = ANCHOR_TURNS * 2 * Math.PI;

  let prev: Vec3[] | undefined;
  for (let i = 0; i <= ANCHOR_SEGMENTS; i++) {
    const s = i / ANCHOR_SEGMENTS;
    const { centre, tangent } = helixSample(
      f,
      lerp(startAngle, endAngle, s),
      offset,
      (s - 0.5) * anchorH,
      anchorH,
      radialSpeed,
    );
    const ring = buildOrientedRing(centre, wireR, WIRE_RING_SEGMENTS, tangent);
    if (prev) stitchRings(list, prev, ring, col);
    prev = ring;
  }
}

/**
 * Copper helix around a wired branch, following its curve through
 * `branchFrameAt` and riding on its tapering surface, then the trunk anchor.
 * Rings are perpendicular to the helix tangent, not the branch axis, so the
 * tight pitch does not skew them.
 */
export function addWireCoil(list: TriangleList, tree: BonsaiTree, branch: Branch): void {
  const branchRBase = (branch.girth / 1000) * DISPLAY_SCALE;
  const wireR = wireRadius(branch);
  const lengthWorld = (branch.length / 100) * DISPLAY_SCALE;
  const turns = wireCoilTurns(branch);
  const segs = wireCoilSegments(branch);
  const radialSpeed = turns * 2 * Math.PI;

  let prev: Vec3[] | undefined;
  for (let i = 0; i <= segs; i++) {
    const s = i / segs;
    const offset = lerp(branchRBase, branchRBase * BRANCH_TIP_FRACTION, s) + wireR;
    const { centre, tangent } = helixSample(
      branchFrameAt(tree, branch, s),
      s * turns * 360,
      offset,
      0,
      lengthWorld,
      radialSpeed,
    );
    const ring = buildOrientedRing(centre, wireR, WIRE_RING_SEGMENTS, tangent);
    if (prev) stitchRings(list, prev, ring, WIRE_RGB);
    prev = ring;
  }

  addWireAnchor(list, tree, branch, wireR, WIRE_RGB);
}

/** The trunk, then each branch in order (bark, then its wire if wired), as one triangle list. */
export function buildTreeMesh(tree: BonsaiTree): MeshArrays {
  const list = new TriangleList();
  buildTrunk(list, tree);
  for (const branch of tree.branches) {
    buildBranchBark(list, tree, branch);
    if (branch.wired) addWireCoil(list, tree, branch);
  }
  return list.build();
}
