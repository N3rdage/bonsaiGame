import { describe, expect, it } from 'vitest';
import {
  TRUNK_MIN_RADIUS,
  branchFrameAt,
  branchPoint,
  trunkFrameAt,
  trunkFrames,
  trunkRadiusAt,
} from '../sim/geometry';
import { createNewGameState } from '../sim/state';
import { createTree } from '../sim/tree';
import type { BonsaiTree, Branch, Vec3 } from '../sim/types';
import { dcos, dsin } from '../sim/vec3';
import { TriangleList, type MeshArrays } from './meshArrays';
import type { Rgb } from './potPalette';
import {
  ANCHOR_MIN_SEGS,
  ANCHOR_SEGMENTS,
  ANCHOR_TURNS,
  BARK_TILE_LENGTH,
  BRANCH_MIN_RADIUS,
  BRANCH_RING_SEGMENTS,
  BRANCH_SEGMENTS,
  BRANCH_TIP_FRACTION,
  TRUNK_RING_SEGMENTS,
  WIRE_FULL_BEND_DEG,
  WIRE_GAUGE_MAX,
  WIRE_GAUGE_MIN,
  WIRE_MIN_RADIUS,
  WIRE_MIN_SEGS,
  WIRE_PITCH_DIAMETERS,
  WIRE_RGB,
  WIRE_RING_SEGMENTS,
  WIRE_SEGS_PER_TURN,
  addWireCoil,
  buildOrientedRing,
  buildRing,
  buildRingWithBasis,
  branchRadiusAt,
  buildTreeMesh,
  ringNormals,
  ringU,
  speciesBark,
  stitchRings,
  tubeNormals,
  wireCoilOffset,
  wireCoilSegments,
  wireCoilTurns,
  wireRadius,
} from './treeMesh';
import { VIEWER_FIXTURES, WIRED_BRANCH_ID } from './viewerFixtures';

function starterTree(): BonsaiTree {
  const tree = createNewGameState().trees[0];
  if (!tree) throw new Error('no starter');
  return tree;
}

function positionAt(mesh: MeshArrays, v: number): Vec3 {
  const p = mesh.positions;
  return { x: p[v * 3] ?? NaN, y: p[v * 3 + 1] ?? NaN, z: p[v * 3 + 2] ?? NaN };
}

function colorAt(mesh: MeshArrays, v: number): [number, number, number] {
  const c = mesh.colors;
  return [c[v * 3] ?? NaN, c[v * 3 + 1] ?? NaN, c[v * 3 + 2] ?? NaN];
}

function expectVec(actual: Vec3, expected: Vec3, digits = 5): void {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
  expect(actual.z).toBeCloseTo(expected.z, digits);
}

function expectColor(actual: [number, number, number], { r, g, b }: Rgb): void {
  [r / 255, g / 255, b / 255].forEach((e, i) => {
    expect(actual[i]).toBeCloseTo(e, 6);
  });
}

/**
 * One ring read back out of a stitched band: each ring segment emits
 * (a1, b1, a2, a2, b1, b2), so a-ring vertex k is at offset 0 and b-ring
 * vertex k at offset 1 of segment k.
 */
function ringOf(mesh: MeshArrays, firstVertex: number, n: number, side: 'a' | 'b'): Vec3[] {
  return Array.from({ length: n }, (_, k) =>
    positionAt(mesh, firstVertex + k * 6 + (side === 'a' ? 0 : 1)),
  );
}

function centroid(ring: Vec3[]): Vec3 {
  const s = ring.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }), {
    x: 0,
    y: 0,
    z: 0,
  });
  return { x: s.x / ring.length, y: s.y / ring.length, z: s.z / ring.length };
}

const dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

function normalAt(mesh: MeshArrays, v: number): Vec3 {
  const n = mesh.normals;
  return { x: n[v * 3] ?? NaN, y: n[v * 3 + 1] ?? NaN, z: n[v * 3 + 2] ?? NaN };
}

/** Degrees between a unit normal and the plane perpendicular to the unit tangent. */
function tiltDeg(n: Vec3, tangent: Vec3): number {
  return (Math.asin(Math.min(1, Math.abs(dot(n, tangent)))) * 180) / Math.PI;
}

/**
 * Ring and point index of vertex `k` within a stitched tube of `segments`-point
 * rings: segment s of band b emits (a_s, b_s, a_s+1, a_s+1, b_s, b_s+1).
 */
function tubeVertex(k: number, segments: number): { ring: number; point: number } {
  const band = Math.floor(k / (segments * 6));
  const seg = Math.floor(k / 6) % segments;
  const [onB, next] = [
    [0, 0],
    [1, 0],
    [0, 1],
    [0, 1],
    [1, 0],
    [1, 1],
  ][k % 6] ?? [NaN, NaN];
  return { ring: band + (onB ?? NaN), point: (seg + (next ?? NaN)) % segments };
}

describe('tree mesh constants (scr_bonsai_mesh build_trunk / build_branch)', () => {
  it('match the prototype', () => {
    expect(TRUNK_RING_SEGMENTS).toBe(10);
    expect(TRUNK_MIN_RADIUS).toBe(0.001);
    expect(BRANCH_SEGMENTS).toBe(6);
    expect(BRANCH_RING_SEGMENTS).toBe(6);
    expect(BRANCH_TIP_FRACTION).toBe(0.2);
    expect(BRANCH_MIN_RADIUS).toBe(0.005);
  });

  it("the juniper's bark is the prototype's one bark; the maple and pine have their own", () => {
    expect(speciesBark('juniper')).toEqual({
      trunk: { r: 90, g: 60, b: 40 },
      branch: { r: 110, g: 75, b: 50 },
    });
    expect(speciesBark('maple')).toEqual({
      trunk: { r: 110, g: 106, b: 98 },
      branch: { r: 124, g: 120, b: 112 },
    });
    expect(speciesBark('pine')).toEqual({
      trunk: { r: 62, g: 42, b: 30 },
      branch: { r: 76, g: 54, b: 38 },
    });
  });

  it('match the prototype wire (add_wire_coil / add_wire_anchor), in Inked ink brown', () => {
    expect(WIRE_RGB).toEqual({ r: 46, g: 30, b: 22 });
    // Darker than every species' bark in every channel, so the coil reads over it.
    for (const key of ['juniper', 'maple', 'pine'] as const) {
      const { trunk, branch } = speciesBark(key);
      for (const bark of [trunk, branch]) {
        expect(WIRE_RGB.r).toBeLessThan(bark.r);
        expect(WIRE_RGB.g).toBeLessThan(bark.g);
        expect(WIRE_RGB.b).toBeLessThan(bark.b);
      }
    }
    expect(WIRE_GAUGE_MIN).toBe(0.15);
    expect(WIRE_GAUGE_MAX).toBe(0.3);
    expect(WIRE_FULL_BEND_DEG).toBe(60);
    expect(WIRE_MIN_RADIUS).toBe(0.002);
    expect(WIRE_PITCH_DIAMETERS).toBe(3);
    expect(WIRE_SEGS_PER_TURN).toBe(8);
    expect(WIRE_MIN_SEGS).toBe(20);
    expect(WIRE_RING_SEGMENTS).toBe(6);
    expect(ANCHOR_TURNS).toBe(1.5);
    expect(ANCHOR_MIN_SEGS).toBe(16);
    // max(16, ceil(1.5 * 8) = 12) = 16.
    expect(ANCHOR_SEGMENTS).toBe(16);
  });

  it('derives the trunk base radius from girth in mm, as a diameter, at display scale 4', () => {
    expect(trunkRadiusAt(starterTree().trunk, 0)).toBeCloseTo(0.036, 12);
  });
});

describe('ring helpers', () => {
  it('buildRing lays its points flat around the centre, starting along +x', () => {
    const c = { x: 1, y: 2, z: 3 };
    const ring = buildRing(c, 0.5, 4);
    expect(ring).toHaveLength(4);
    expectVec(ring[0] ?? c, { x: 1.5, y: 2, z: 3 }, 12);
    expectVec(ring[1] ?? c, { x: 1, y: 2.5, z: 3 }, 12);
    expectVec(ring[2] ?? c, { x: 0.5, y: 2, z: 3 }, 12);
  });

  it('buildRingWithBasis spans the given u and v', () => {
    const c = { x: 0, y: 0, z: 1 };
    const ring = buildRingWithBasis(c, 2, 4, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 });
    expectVec(ring[0] ?? c, { x: 0, y: 0, z: 3 }, 12);
    expectVec(ring[1] ?? c, { x: 2, y: 0, z: 1 }, 12);
    expectVec(ring[3] ?? c, { x: -2, y: 0, z: 1 }, 12);
  });

  it('buildOrientedRing around a vertical normal switches to the +x reference: a horizontal circle', () => {
    const c = { x: 1, y: 2, z: 3 };
    const ring = buildOrientedRing(c, 0.5, 4, { x: 0, y: 0, z: 1 });
    // u = normalize(+x cross +z) = -y, v = n cross u = +x.
    expectVec(ring[0] ?? c, { x: 1, y: 1.5, z: 3 }, 12);
    expectVec(ring[1] ?? c, { x: 1.5, y: 2, z: 3 }, 12);
    for (const p of ring) expect(p.z).toBeCloseTo(3, 12);
  });

  it('buildOrientedRing around +x keeps the +z reference: a circle in the yz plane', () => {
    const c = { x: 1, y: 2, z: 3 };
    const ring = buildOrientedRing(c, 0.5, 4, { x: 1, y: 0, z: 0 });
    // u = normalize(+z cross +x) = +y, v = n cross u = +z.
    expectVec(ring[0] ?? c, { x: 1, y: 2.5, z: 3 }, 12);
    expectVec(ring[1] ?? c, { x: 1, y: 2, z: 3.5 }, 12);
    for (const p of ring) expect(p.x).toBeCloseTo(1, 12);
  });

  it('buildOrientedRing puts every vertex at the radius, perpendicular to n, either side of 0.95', () => {
    const c = { x: -0.3, y: 0.7, z: 0.2 };
    for (const nz of [0.94, 0.96, -0.97, 0.2]) {
      const h = Math.sqrt(1 - nz * nz);
      const n = { x: h * 0.6, y: -h * 0.8, z: nz };
      const ring = buildOrientedRing(c, 0.25, 6, n);
      expect(ring).toHaveLength(6);
      for (const p of ring) {
        expect(dist(p, c)).toBeCloseTo(0.25, 12);
        expect((p.x - c.x) * n.x + (p.y - c.y) * n.y + (p.z - c.z) * n.z).toBeCloseTo(0, 12);
      }
    }
  });

  it('stitchRings emits (a1, b1, a2), (a2, b1, b2) per segment and wraps around', () => {
    const a = [0, 1, 2].map((i) => ({ x: i, y: 0, z: 0 }));
    const b = [0, 1, 2].map((i) => ({ x: i, y: 0, z: 1 }));
    const list = new TriangleList();
    const red = { r: 255, g: 0, b: 0 };
    stitchRings(list, a, b, red);
    const mesh = list.build();
    expect(mesh.positions).toHaveLength(3 * 2 * 3 * 3);
    const xs = Array.from({ length: 18 }, (_, v) => positionAt(mesh, v));
    const label = xs.map((p) => `${p.z === 0 ? 'a' : 'b'}${String(p.x)}`);
    expect(label).toEqual([
      ...['a0', 'b0', 'a1', 'a1', 'b0', 'b1'],
      ...['a1', 'b1', 'a2', 'a2', 'b1', 'b2'],
      ...['a2', 'b2', 'a0', 'a0', 'b2', 'b0'],
    ]);
    expectColor(colorAt(mesh, 17), red);
  });

  it('stitchRings gives each vertex its ring point outward normal and bark UVs', () => {
    const square = (z: number): Vec3[] => [
      { x: 1, y: 0, z },
      { x: 0, y: 1, z },
      { x: -1, y: 0, z },
      { x: 0, y: -1, z },
    ];
    const list = new TriangleList();
    stitchRings(list, square(0), square(1), { r: 0, g: 0, b: 0 }, 0.5, 1.5);
    const mesh = list.build();
    const count = mesh.positions.length / 3;
    expect(count).toBe(4 * 6);
    for (let v = 0; v < count; v++) {
      const p = positionAt(mesh, v);
      const n = {
        x: mesh.normals[v * 3] ?? NaN,
        y: mesh.normals[v * 3 + 1] ?? NaN,
        z: mesh.normals[v * 3 + 2] ?? NaN,
      };
      expect(n.x).toBeCloseTo(p.x, 6);
      expect(n.y).toBeCloseTo(p.y, 6);
      expect(n.z).toBeCloseTo(0, 6);
      expect(mesh.uvs[v * 2 + 1]).toBe(p.z === 0 ? 0.5 : 1.5);
    }
    // The last segment runs u from 1.5 to 2, not back to 0.
    expect(Array.from(mesh.uvs.slice(18 * 2, 24 * 2)).filter((_, i) => i % 2 === 0)).toEqual([
      1.5, 1.5, 2, 2, 1.5, 2,
    ]);
  });

  it('tubeNormals drops the along-tangent part of each offset; stitchRings uses given normals', () => {
    // A flat ring around a tube rising at 45 degrees in the xz plane.
    const c = { x: 1, y: 2, z: 3 };
    const t = { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 };
    const ring = buildRing(c, 0.5, 4);
    const normals = tubeNormals(ring, c, t);
    // +x offset: (0.5, 0, 0) minus its along-tangent part (0.25, 0, 0.25), normalised.
    expectVec(normals[0] ?? c, { x: Math.SQRT1_2, y: 0, z: -Math.SQRT1_2 }, 12);
    expectVec(normals[1] ?? c, { x: 0, y: 1, z: 0 }, 12);
    for (const n of normals) expect(dot(n, t)).toBeCloseTo(0, 12);

    const list = new TriangleList();
    stitchRings(list, ring, ring, { r: 0, g: 0, b: 0 }, 0, 1, { a: normals, b: normals });
    const mesh = list.build();
    // Segment 0 is (a0, b0, a1, a1, b0, b1).
    expectVec(normalAt(mesh, 0), normals[0] ?? c, 6);
    expectVec(normalAt(mesh, 2), normals[1] ?? c, 6);
  });

  it('ringU and ringNormals', () => {
    expect(ringU(0, 10)).toBe(0);
    expect(ringU(5, 10)).toBe(1);
    expect(ringU(10, 10)).toBe(2);
    const ring = buildRing({ x: 1, y: 2, z: 3 }, 0.25, 6);
    for (const [i, n] of ringNormals(ring).entries()) {
      const p = ring[i] ?? { x: NaN, y: NaN, z: NaN };
      expect(n.x).toBeCloseTo((p.x - 1) / 0.25, 12);
      expect(n.y).toBeCloseTo((p.y - 2) / 0.25, 12);
      expect(n.z).toBeCloseTo(0, 12);
    }
  });
});

describe('buildTreeMesh', () => {
  it('builds the starter: 20 trunk segments x 10 x 2 + 4 branches x 6 x 6 x 2 = 688 triangles', () => {
    // 25 cm -> arc 1.0 display units -> max(8, floor(1.0 * 20)) = 20 segments.
    const mesh = buildTreeMesh(starterTree());
    expect(mesh.positions.length / 3).toBe(688 * 3);
    expect(mesh.positions.length / 3).toBe(2064);
    expect(mesh.colors).toHaveLength(mesh.positions.length);
    expect(mesh.normals).toHaveLength(mesh.positions.length);
    expect(mesh.uvs).toHaveLength((mesh.positions.length / 3) * 2);
  });

  it('textures the bark: u runs 0 to 2 round each ring, v grows along the trunk by BARK_TILE_LENGTH', () => {
    const tree = starterTree();
    const mesh = buildTreeMesh(tree);
    const trunkVertices = 20 * 10 * 6;
    const us = new Set<number>();
    let vMax = 0;
    for (let i = 0; i < trunkVertices; i++) {
      us.add(Math.round((mesh.uvs[i * 2] ?? NaN) * 10));
      vMax = Math.max(vMax, mesh.uvs[i * 2 + 1] ?? NaN);
    }
    expect([...us].sort((a, b) => a - b)).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    // The trunk's centreline is at least its height long.
    expect(vMax).toBeGreaterThanOrEqual(
      ((tree.trunk.heightCm / 100) * 4) / BARK_TILE_LENGTH - 1e-4,
    );
    // The first band starts at v 0.
    expect(mesh.uvs[1]).toBe(0);
  });

  it('builds a fresh juniper cutting: 8 trunk segments x 10 x 2 + 2 branches x 72 = 304 triangles', () => {
    // 8 cm -> arc 0.32 -> floor(6.4) = 6, raised to the minimum of 8 segments.
    const mesh = buildTreeMesh(createTree('juniper', 'cutting', 1));
    expect(mesh.positions.length / 3).toBe(304 * 3);
    expect(mesh.positions.length / 3).toBe(912);
  });

  it('builds the first trunk segment vertex for vertex, in trunk bark', () => {
    const mesh = buildTreeMesh(starterTree());
    // Ring 0 at the soil line with the base radius; ring 1 one segment (1/20) up,
    // tapered toward 0.036 * (1 - 0.7).
    const r0 = 0.036;
    const r1 = 0.036 + (0.0108 - 0.036) / 20;
    const at = (r: number, z: number, k: number): Vec3 => ({
      x: Math.cos((k * Math.PI) / 5) * r,
      y: Math.sin((k * Math.PI) / 5) * r,
      z,
    });
    const expected = [at(r0, 0, 0), at(r1, 0.05, 0), at(r0, 0, 1)];
    expected.push(expected[2] ?? at(0, 0, 0), expected[1] ?? at(0, 0, 0), at(r1, 0.05, 1));
    expected.forEach((p, v) => {
      expectVec(positionAt(mesh, v), p);
      expectColor(colorAt(mesh, v), { r: 90, g: 60, b: 40 });
    });
  });

  it('ends the trunk with the tapered apex ring around the last frame', () => {
    const tree = starterTree();
    const mesh = buildTreeMesh(tree);
    const last = trunkFrames(tree).at(-1);
    const apex = ringOf(mesh, 19 * 10 * 6, 10, 'b');
    expectVec(centroid(apex), last?.pos ?? { x: NaN, y: NaN, z: NaN });
    expectVec(centroid(apex), { x: 0, y: 0, z: 1 });
    for (const p of apex) expect(dist(p, { x: 0, y: 0, z: 1 })).toBeCloseTo(0.036 * 0.3, 5);
  });

  it('builds branches from flat rings centred on branchPoint, tapering to the 0.005 floor', () => {
    const mesh = buildTreeMesh(starterTree());
    // Branch 0 (8 cm up, angle 30, 12 cm long, girth 3.6) starts after 400 trunk triangles.
    const start = 400 * 3;
    const base = ringOf(mesh, start, 6, 'a');
    // On a straight trunk the origin sits on the trunk surface at the branch's angle.
    const trunkR = 0.036 + (0.0108 - 0.036) * (8 / 25);
    const origin = {
      x: Math.cos(Math.PI / 6) * trunkR,
      y: Math.sin(Math.PI / 6) * trunkR,
      z: 0.32,
    };
    expectVec(centroid(base), origin);
    for (const p of base) {
      expect(p.z).toBeCloseTo(0.32, 6);
      expect(dist(p, origin)).toBeCloseTo(0.0144, 5);
    }
    expectColor(colorAt(mesh, start), { r: 110, g: 75, b: 50 });

    // Tip: 0.48 display units out along 30 degrees, lifted by a quarter of that.
    const tip = ringOf(mesh, start + 5 * 6 * 6, 6, 'b');
    const tipCentre = {
      x: origin.x + 0.48 * Math.cos(Math.PI / 6),
      y: origin.y + 0.48 * Math.sin(Math.PI / 6),
      z: 0.32 + 0.12,
    };
    expectVec(centroid(tip), tipCentre);
    for (const p of tip) expect(dist(p, tipCentre)).toBeCloseTo(0.005, 5);
  });

  it('shades a steeply rising branch radial to its tangent, on the same flat rings', () => {
    const tree = starterTree();
    const first = tree.branches[0];
    if (!first) throw new Error('no branch');
    const branch: Branch = { ...first, girth: 8, bendV: 70 };
    tree.branches = [branch];
    // The tip rises at more than 60 degrees.
    expect(branchFrameAt(tree, branch, 1).tangent.z).toBeGreaterThan(Math.sin(Math.PI / 3));

    const mesh = buildTreeMesh(tree);
    const total = mesh.positions.length / 3;
    const start = total - BRANCH_SEGMENTS * BRANCH_RING_SEGMENTS * 6;
    const r0 = (branch.girth / 1000) * 4;
    let oldWorst = 0;
    for (let k = 0; k < total - start; k++) {
      const { ring, point } = tubeVertex(k, BRANCH_RING_SEGMENTS);
      const t = ring / BRANCH_SEGMENTS;
      const r = Math.max(r0 + (r0 * BRANCH_TIP_FRACTION - r0) * t, BRANCH_MIN_RADIUS);
      const centre = branchPoint(tree, branch, t);
      const flat = buildRing(centre, r, BRANCH_RING_SEGMENTS);
      const p = flat[point] ?? centre;
      // Geometry unmoved: the prototype's flat ring around branchPoint, exactly.
      expect(positionAt(mesh, start + k)).toEqual({
        x: Math.fround(p.x),
        y: Math.fround(p.y),
        z: Math.fround(p.z),
      });

      const { tangent } = branchFrameAt(tree, branch, t);
      const n = normalAt(mesh, start + k);
      expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 6);
      expect(tiltDeg(n, tangent)).toBeLessThan(5);
      expect(dot(n, { x: p.x - centre.x, y: p.y - centre.y, z: p.z - centre.z })).toBeGreaterThan(
        0,
      );
      oldWorst = Math.max(oldWorst, tiltDeg(ringNormals(flat)[point] ?? n, tangent));
    }
    // The old in-ring-plane normals tilt far off the surface on this branch.
    expect(oldWorst).toBeGreaterThan(45);
  });

  it("keeps the trunk's normals radial to its own tangent (its rings are already square to it)", () => {
    const tree = VIEWER_FIXTURES.bent();
    const mesh = buildTreeMesh(tree);
    const frames = trunkFrames(tree);
    const trunkVertices = (frames.length - 1) * TRUNK_RING_SEGMENTS * 6;
    for (let k = 0; k < trunkVertices; k++) {
      const f = frames[tubeVertex(k, TRUNK_RING_SEGMENTS).ring];
      if (!f) throw new Error('no frame');
      const p = positionAt(mesh, k);
      const n = normalAt(mesh, k);
      expect(dot(n, f.tangent)).toBeCloseTo(0, 5);
      expect(dot(n, { x: p.x - f.pos.x, y: p.y - f.pos.y, z: p.z - f.pos.z })).toBeGreaterThan(0);
    }
  });

  it("builds a maple's and a pine's trunk and branches in their own bark", () => {
    for (const key of ['maple', 'pine'] as const) {
      const tree = VIEWER_FIXTURES[key]();
      const mesh = buildTreeMesh(tree);
      const bark = speciesBark(key);
      const total = mesh.positions.length / 3;
      // Unwired: the trunk's bands, then 72 triangles of bark per branch.
      const trunkVertices = total - tree.branches.length * 72 * 3;
      expectColor(colorAt(mesh, 0), bark.trunk);
      expectColor(colorAt(mesh, trunkVertices - 1), bark.trunk);
      expectColor(colorAt(mesh, trunkVertices), bark.branch);
      expectColor(colorAt(mesh, total - 1), bark.branch);
    }
  });

  it('is deterministic', () => {
    const a = buildTreeMesh(starterTree());
    const b = buildTreeMesh(starterTree());
    expect(a.positions).toEqual(b.positions);
    expect(a.colors).toEqual(b.colors);
  });

  it('displaces a bent trunk the way trunkFrames does (what you see is what you score)', () => {
    const tree = VIEWER_FIXTURES.bent();
    const mesh = buildTreeMesh(tree);
    const last = trunkFrames(tree).at(-1);
    if (!last) throw new Error('no frames');
    const apex = centroid(ringOf(mesh, 19 * 10 * 6, 10, 'b'));
    expectVec(apex, last.pos);
    // Two bends toward -135 degrees carry the apex into the (-x, -y) quadrant, on the diagonal.
    expect(apex.x).toBeLessThan(-0.1);
    expect(apex.y).toBeCloseTo(apex.x, 5);
    expect(apex.z).toBeLessThan(1);
  });
});

describe('wire (scr_bonsai_mesh add_wire_coil / add_wire_anchor)', () => {
  function wired(): { tree: BonsaiTree; branch: Branch } {
    const tree = VIEWER_FIXTURES.wired();
    const branch = tree.branches[WIRED_BRANCH_ID];
    if (!branch) throw new Error('no wired branch');
    return { tree, branch };
  }

  // Starter trunk: 20 segments x 10 x 6 = 1200 vertices, then 216 per branch's bark.
  // The wired branch is branch 1, so its coil follows two barks; the anchor follows the coil.
  const COIL_START = 1200 + 2 * 216;
  const COIL_SEGS = 178;
  const ANCHOR_START = COIL_START + COIL_SEGS * 36;

  it('sizes the coil on the fixture branch from girth, bend and length', () => {
    const { branch } = wired();
    // 11 cm branch: girth max(2, 11 * 0.3) = 3.3 mm -> base radius 0.0132 units.
    expect(branch.girth).toBeCloseTo(3.3, 12);
    expect(branch.bend).toBe(40);
    // Bend 40 / 60 -> gauge lerp(0.15, 0.30, 2/3) = 0.25 -> wire radius 0.0033.
    expect(wireRadius(branch)).toBeCloseTo(0.0033, 12);
    // Pitch 3 x 0.0066 = 0.0198; length 0.44 units -> 22.2 turns -> ceil(177.8) = 178 bands.
    expect(wireCoilTurns(branch)).toBeCloseTo(0.44 / 0.0198, 9);
    expect(wireCoilSegments(branch)).toBe(COIL_SEGS);
  });

  it('floors the wire radius at 0.002 and the coil at 20 bands', () => {
    const thin = { ...wired().branch, girth: 0.5, bend: 0, length: 1 };
    // 0.002 units base radius x 0.15 is far below the floor.
    expect(wireRadius(thin)).toBe(0.002);
    // 0.04 units / pitch 0.012 = 3.3 turns -> ceil(26.7) = 27 bands; at 0.5 cm,
    // 1.7 turns -> 14 bands, raised to the floor of 20.
    expect(wireCoilSegments(thin)).toBe(27);
    expect(wireCoilSegments({ ...thin, length: 0.5 })).toBe(20);
  });

  it('adds a 178-band coil and a 16-band anchor to the wired fixture: 9048 vertices', () => {
    // 2064 bark + 178 x 6 x 6 = 6408 coil + 16 x 6 x 6 = 576 anchor.
    const mesh = buildTreeMesh(wired().tree);
    expect(mesh.positions.length / 3).toBe(2064 + 6408 + 576);
    expect(mesh.positions.length / 3).toBe(9048);
    const branchBark = speciesBark('juniper').branch;
    expectColor(colorAt(mesh, COIL_START - 1), branchBark);
    expectColor(colorAt(mesh, COIL_START), WIRE_RGB);
    expectColor(colorAt(mesh, ANCHOR_START + 575), WIRE_RGB);
    expectColor(colorAt(mesh, ANCHOR_START + 576), branchBark);
  });

  it('adds nothing for an unwired branch, however bent', () => {
    const { tree, branch } = wired();
    branch.wired = false;
    expect(buildTreeMesh(tree).positions.length / 3).toBe(2064);
  });

  /** Vertices as emitted, in double precision (the built mesh stores Float32). */
  class RecordingList extends TriangleList {
    readonly points: Vec3[] = [];
    override vertex(p: Vec3, c: Rgb, n: Vec3, u = 0, v = 0): void {
      this.points.push(p);
      super.vertex(p, c, n, u, v);
    }
  }

  const missing = { x: NaN, y: NaN, z: NaN };

  /** Ring `i` of a run of 6-segment bands starting at vertex `first` (see `ringOf`). */
  function wireRing(points: Vec3[], first: number, bands: number, i: number): Vec3[] {
    const band = Math.min(i, bands - 1);
    const side = i < bands ? 0 : 1;
    return Array.from({ length: 6 }, (_, k) => points[first + band * 36 + k * 6 + side] ?? missing);
  }

  function wirePoints(): { tree: BonsaiTree; branch: Branch; points: Vec3[] } {
    const { tree, branch } = wired();
    const list = new RecordingList();
    addWireCoil(list, tree, branch);
    expect(list.points).toHaveLength(6408 + 576);
    return { tree, branch, points: list.points };
  }

  it('floors the branch radius at 0.005: the fixture branch from s = 0.7765, a thin one throughout', () => {
    const { branch } = wired();
    // Base radius 3.3 mm / 1000 x 4 = 0.0132; the taper 0.0132 - 0.01056 t meets
    // the 0.005 floor at t = 0.0082 / 0.01056 = 0.7765 and would end at 0.00264.
    expect(branchRadiusAt(branch, 0)).toBeCloseTo(0.0132, 12);
    expect(branchRadiusAt(branch, 0.5)).toBeCloseTo(0.0132 - 0.00528, 12);
    const tFloor = 0.0082 / 0.01056;
    expect(tFloor).toBeCloseTo(0.7765, 4);
    expect(branchRadiusAt(branch, tFloor)).toBeCloseTo(0.005, 12);
    expect(branchRadiusAt(branch, tFloor - 0.01)).toBeGreaterThan(0.005);
    expect(branchRadiusAt(branch, 0.9)).toBe(BRANCH_MIN_RADIUS);
    expect(branchRadiusAt(branch, 1)).toBe(BRANCH_MIN_RADIUS);

    // A 1 mm branch (base radius 0.004) is under the floor from base to tip.
    const thin = { ...branch, girth: 1 };
    expect(branchRadiusAt(thin, 0)).toBe(BRANCH_MIN_RADIUS);
    expect(branchRadiusAt(thin, 0.5)).toBe(BRANCH_MIN_RADIUS);
    expect(branchRadiusAt(thin, 1)).toBe(BRANCH_MIN_RADIUS);
  });

  it("leaves the wired fixture's branch bark on the prototype's floored flat rings", () => {
    const { tree, branch } = wired();
    const mesh = buildTreeMesh(tree);
    const start = 1200 + 216;
    const r0 = 0.0132;
    for (let k = 0; k < 216; k++) {
      const { ring, point } = tubeVertex(k, BRANCH_RING_SEGMENTS);
      const t = ring / BRANCH_SEGMENTS;
      const r = Math.max(r0 + (r0 * BRANCH_TIP_FRACTION - r0) * t, BRANCH_MIN_RADIUS);
      const centre = branchPoint(tree, branch, t);
      const p = buildRing(centre, r, BRANCH_RING_SEGMENTS)[point] ?? centre;
      expect(positionAt(mesh, start + k)).toEqual({
        x: Math.fround(p.x),
        y: Math.fround(p.y),
        z: Math.fround(p.z),
      });
    }
  });

  it('offsets the coil by the floored bark radius plus the wire radius', () => {
    const { branch } = wired();
    expect(wireCoilOffset(branch, 0)).toBeCloseTo(0.0132 + 0.0033, 12);
    expect(wireCoilOffset(branch, 0.5)).toBeCloseTo(0.0132 - 0.00528 + 0.0033, 12);
    // At the tip 0.005 + 0.0033 = 0.0083. The unfloored taper would put the coil's
    // centre at 0.00264 + 0.0033 = 0.00594, its inner edge at 0.00264, 0.00236 inside
    // the 0.005 bark: over a third of the wire's 0.0066 diameter buried.
    expect(wireCoilOffset(branch, 1)).toBeCloseTo(0.0083, 12);
    for (let i = 0; i <= 100; i++) {
      const s = i / 100;
      expect(wireCoilOffset(branch, s)).toBeCloseTo(
        branchRadiusAt(branch, s) + wireRadius(branch),
        15,
      );
    }
    const thin = { ...branch, girth: 0.5, bend: 0 };
    expect(wireCoilOffset(thin, 1)).toBeCloseTo(0.005 + 0.002, 12);
  });

  it('rides the coil on the floored bark: centres at wireCoilOffset(s) from branchPoint', () => {
    const { tree, branch, points } = wirePoints();
    const wireR = 0.0033;
    for (let i = 0; i <= COIL_SEGS; i++) {
      const s = i / COIL_SEGS;
      const ring = wireRing(points, 0, COIL_SEGS, i);
      const centre = centroid(ring);
      const d = dist(centre, branchPoint(tree, branch, s));
      expect(Math.abs(d - wireCoilOffset(branch, s))).toBeLessThan(1e-9);
      // The wire never enters the bark: every ring centre is a wire radius outside it.
      expect(d).toBeGreaterThanOrEqual(branchRadiusAt(branch, s) + wireR - 1e-9);
      for (const p of ring) expect(dist(p, centre)).toBeCloseTo(wireR, 12);
    }
  });

  it('wraps the anchor around the trunk at the branch base and ends on the branch side', () => {
    const { tree, branch, points } = wirePoints();
    const t = 14 / 25;
    const f = trunkFrameAt(tree, t);
    const trunkR = 0.036 + (0.036 * 0.3 - 0.036) * t;
    const offset = trunkR + 0.0033;
    const anchorH = 1.5 * 3 * 0.0066;
    const centres: Vec3[] = [];
    for (let i = 0; i <= 16; i++) {
      const s = i / 16;
      const ring = wireRing(points, COIL_SEGS * 36, 16, i);
      const centre = centroid(ring);
      for (const p of ring) expect(dist(p, centre)).toBeCloseTo(0.0033, 12);
      centres.push(centre);
      const axial = (s - 0.5) * anchorH;
      expect(Math.abs(dist(centre, f.pos) - Math.hypot(offset, axial))).toBeLessThan(1e-9);
    }
    const last = centres.at(-1) ?? f.pos;
    const d = { x: last.x - f.pos.x, y: last.y - f.pos.y, z: last.z - f.pos.z };
    const n = d.x * f.normal.x + d.y * f.normal.y + d.z * f.normal.z;
    const b = d.x * f.binormal.x + d.y * f.binormal.y + d.z * f.binormal.z;
    expect(n / offset).toBeCloseTo(dcos(branch.angle), 9);
    expect(b / offset).toBeCloseTo(dsin(branch.angle), 9);
  });

  it('wraps the anchor on the floored trunk radius at a fully tapered tip', () => {
    const { tree, branch } = wired();
    tree.trunk.taper = 1;
    branch.originY = tree.trunk.heightCm;
    const list = new RecordingList();
    addWireCoil(list, tree, branch);
    const wireR = wireRadius(branch);
    const offset = TRUNK_MIN_RADIUS + wireR;
    const anchorH = ANCHOR_TURNS * WIRE_PITCH_DIAMETERS * (2 * wireR);
    const f = trunkFrameAt(tree, 1);
    for (let i = 0; i <= ANCHOR_SEGMENTS; i++) {
      const s = i / ANCHOR_SEGMENTS;
      const centre = centroid(wireRing(list.points, COIL_SEGS * 36, ANCHOR_SEGMENTS, i));
      const axial = (s - 0.5) * anchorH;
      expect(Math.abs(dist(centre, f.pos) - Math.hypot(offset, axial))).toBeLessThan(1e-9);
    }
  });
});
