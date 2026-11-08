import { describe, expect, it } from 'vitest';
import { trunkFrames } from '../sim/geometry';
import { createNewGameState } from '../sim/state';
import { createTree } from '../sim/tree';
import type { BonsaiTree, Vec3 } from '../sim/types';
import { TriangleList, type MeshArrays } from './meshArrays';
import type { Rgb } from './potPalette';
import {
  BRANCH_BARK_RGB,
  BRANCH_MIN_RADIUS,
  BRANCH_RING_SEGMENTS,
  BRANCH_SEGMENTS,
  BRANCH_TIP_FRACTION,
  TRUNK_BARK_RGB,
  TRUNK_MIN_RADIUS,
  TRUNK_RING_SEGMENTS,
  buildRing,
  buildRingWithBasis,
  buildTreeMesh,
  stitchRings,
  trunkBaseRadius,
} from './treeMesh';
import { VIEWER_FIXTURES } from './viewerFixtures';

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

describe('tree mesh constants (scr_bonsai_mesh build_trunk / build_branch)', () => {
  it('match the prototype', () => {
    expect(TRUNK_RING_SEGMENTS).toBe(10);
    expect(TRUNK_MIN_RADIUS).toBe(0.001);
    expect(TRUNK_BARK_RGB).toEqual({ r: 90, g: 60, b: 40 });
    expect(BRANCH_SEGMENTS).toBe(6);
    expect(BRANCH_RING_SEGMENTS).toBe(6);
    expect(BRANCH_TIP_FRACTION).toBe(0.2);
    expect(BRANCH_MIN_RADIUS).toBe(0.005);
    expect(BRANCH_BARK_RGB).toEqual({ r: 110, g: 75, b: 50 });
  });

  it('derives the trunk base radius from girth in mm, as a diameter, at display scale 4', () => {
    expect(trunkBaseRadius(starterTree())).toBeCloseTo(0.036, 12);
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
});

describe('buildTreeMesh', () => {
  it('builds the starter: 20 trunk segments x 10 x 2 + 4 branches x 6 x 6 x 2 = 688 triangles', () => {
    // 25 cm -> arc 1.0 display units -> max(8, floor(1.0 * 20)) = 20 segments.
    const mesh = buildTreeMesh(starterTree());
    expect(mesh.positions.length / 3).toBe(688 * 3);
    expect(mesh.positions.length / 3).toBe(2064);
    expect(mesh.colors).toHaveLength(mesh.positions.length);
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
