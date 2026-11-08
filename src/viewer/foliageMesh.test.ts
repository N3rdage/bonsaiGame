import { describe, expect, it } from 'vitest';
import { DISPLAY_SCALE, branchPoint } from '../sim/geometry';
import { createNewGameState } from '../sim/state';
import { addBranch, createTree, markDirty } from '../sim/tree';
import type { BonsaiTree, Branch, Vec3 } from '../sim/types';
import {
  FOLIAGE_MIN_ORIGIN_FRACTION,
  LEAF_COUNT_BASE,
  LEAF_COUNT_PER_DENSITY,
  LEAF_SIZE_BASE,
  LEAF_SIZE_PER_DENSITY,
  LEAF_SPREAD,
  VERTICES_PER_LEAF,
  addLeaf,
  branchCarriesFoliage,
  buildFoliageMesh,
  foliageSeed,
  hexToRgb,
  leafCount,
  leafHalfSize,
} from './foliageMesh';
import { TriangleList, type MeshArrays } from './meshArrays';

function starterTree(): BonsaiTree {
  const tree = createNewGameState().trees[0];
  if (!tree) throw new Error('no starter');
  return tree;
}

/** A 10 cm juniper with one branch starting at `originY` cm. */
function oneBranchTree(originY: number, density = 0.5): BonsaiTree {
  const tree = createTree('juniper', 'seed', 3);
  tree.trunk.heightCm = 10;
  markDirty(tree);
  addBranch(tree, -1, originY, 45, 4);
  tree.foliageDensity = density;
  return tree;
}

function firstBranch(tree: BonsaiTree): Branch {
  const branch = tree.branches[0];
  if (!branch) throw new Error('no branch');
  return branch;
}

function positionAt(mesh: MeshArrays, v: number): Vec3 {
  const p = mesh.positions;
  return { x: p[v * 3] ?? NaN, y: p[v * 3 + 1] ?? NaN, z: p[v * 3 + 2] ?? NaN };
}

function uvsOf(mesh: MeshArrays, first: number, n: number): number[][] {
  return Array.from({ length: n }, (_, k) => [
    mesh.uvs[(first + k) * 2] ?? NaN,
    mesh.uvs[(first + k) * 2 + 1] ?? NaN,
  ]);
}

function expectVec(actual: Vec3, expected: Vec3, digits = 6): void {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
  expect(actual.z).toBeCloseTo(expected.z, digits);
}

describe('foliage constants (add_foliage_cluster, build_branch)', () => {
  it('pins the canon numbers', () => {
    expect(FOLIAGE_MIN_ORIGIN_FRACTION).toBe(0.3);
    expect(LEAF_COUNT_BASE).toBe(4);
    expect(LEAF_COUNT_PER_DENSITY).toBe(6);
    expect(LEAF_SIZE_BASE).toBe(0.008);
    expect(LEAF_SIZE_PER_DENSITY).toBe(0.006);
    expect(LEAF_SPREAD).toBeCloseTo(0.025 * 4, 12);
    expect(DISPLAY_SCALE).toBe(4);
    expect(VERTICES_PER_LEAF).toBe(12);
  });

  it('leaf count is floor(4 + density * 6)', () => {
    expect(leafCount(0)).toBe(4);
    expect(leafCount(0.1)).toBe(4);
    expect(leafCount(0.25)).toBe(5);
    expect(leafCount(0.5)).toBe(7);
    expect(leafCount(1)).toBe(10);
  });

  it('leaf half-size is (0.008 + density * 0.006) * DISPLAY_SCALE', () => {
    expect(leafHalfSize(0)).toBeCloseTo(0.032, 12);
    expect(leafHalfSize(0.5)).toBeCloseTo(0.044, 12);
    expect(leafHalfSize(1)).toBeCloseTo(0.056, 12);
  });

  it('seeds each cluster with tree.id * 1000 + branch.id', () => {
    const tree = starterTree();
    tree.id = 7;
    expect(tree.branches.map((b) => foliageSeed(tree, b))).toEqual([7000, 7001, 7002, 7003]);
  });
});

describe('hexToRgb', () => {
  it('parses #rrggbb in either case', () => {
    expect(hexToRgb('#4a6741')).toEqual({ r: 74, g: 103, b: 65 });
    expect(hexToRgb('#B33A2A')).toEqual({ r: 179, g: 58, b: 42 });
  });

  it('rejects anything else', () => {
    expect(() => hexToRgb('4a6741')).toThrow();
    expect(() => hexToRgb('#4a674')).toThrow();
    expect(() => hexToRgb('#4a6741ff')).toThrow();
  });
});

describe('the foliage gate', () => {
  it('a branch at exactly 30% of trunk height draws nothing; just above draws', () => {
    const at = oneBranchTree(3);
    expect(at.branches[0]?.originY).toBe(3);
    expect(at.trunk.heightCm).toBe(10);
    expect(branchCarriesFoliage(at, firstBranch(at))).toBe(false);
    expect(buildFoliageMesh(at, 'summer').positions).toHaveLength(0);

    const above = oneBranchTree(3.01);
    expect(branchCarriesFoliage(above, firstBranch(above))).toBe(true);
    expect(buildFoliageMesh(above, 'summer').positions.length / 3).toBe(7 * 12);
  });

  it('clamps the origin fraction, so a branch above the trunk top still leafs out', () => {
    const tree = oneBranchTree(12);
    expect(buildFoliageMesh(tree, 'summer').positions.length / 3).toBe(7 * 12);
  });
});

describe('addLeaf (_add_quad_xz then _add_quad_yz)', () => {
  it('emits two crossed quads in the prototype vertex order with its UVs', () => {
    const list = new TriangleList();
    const c = { x: 1, y: 2, z: 3 };
    const s = 0.5;
    addLeaf(list, c, s, { r: 10, g: 20, b: 30 });
    const mesh = list.build();
    expect(mesh.positions.length / 3).toBe(12);

    const xz = [
      { x: 0.5, y: 2, z: 2.5 },
      { x: 1.5, y: 2, z: 2.5 },
      { x: 1.5, y: 2, z: 3.5 },
      { x: 0.5, y: 2, z: 2.5 },
      { x: 1.5, y: 2, z: 3.5 },
      { x: 0.5, y: 2, z: 3.5 },
    ];
    const yz = [
      { x: 1, y: 1.5, z: 2.5 },
      { x: 1, y: 2.5, z: 2.5 },
      { x: 1, y: 2.5, z: 3.5 },
      { x: 1, y: 1.5, z: 2.5 },
      { x: 1, y: 2.5, z: 3.5 },
      { x: 1, y: 1.5, z: 3.5 },
    ];
    [...xz, ...yz].forEach((p, v) => {
      expectVec(positionAt(mesh, v), p);
    });

    const quadUvs = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
      [1, 1],
      [0, 1],
    ];
    expect(uvsOf(mesh, 0, 6)).toEqual(quadUvs);
    expect(uvsOf(mesh, 6, 6)).toEqual(quadUvs);
    expect(Array.from(mesh.colors.slice(0, 3))).toEqual(
      [10 / 255, 20 / 255, 30 / 255].map(Math.fround),
    );
  });
});

describe('buildFoliageMesh', () => {
  it('builds count * 12 vertices per branch above the gate', () => {
    const tree = starterTree();
    // All four starter branches (8, 14, 18, 22 of 25 cm) clear the 0.3 gate; density 0.5 -> 7 leaves.
    expect(tree.branches.every((b) => branchCarriesFoliage(tree, b))).toBe(true);
    const mesh = buildFoliageMesh(tree, 'summer');
    expect(mesh.positions.length / 3).toBe(4 * 7 * 12);
    expect(mesh.positions.length / 3).toBe(336);
    expect(mesh.colors).toHaveLength(mesh.positions.length);
    expect(mesh.uvs).toHaveLength((mesh.positions.length / 3) * 2);
  });

  it('tints every vertex with the seasonal colour: juniper summer #4a6741 -> (74, 103, 65)', () => {
    const mesh = buildFoliageMesh(starterTree(), 'summer');
    for (let i = 0; i < mesh.colors.length; i += 3) {
      expect(mesh.colors[i]).toBeCloseTo(74 / 255, 6);
      expect(mesh.colors[i + 1]).toBeCloseTo(103 / 255, 6);
      expect(mesh.colors[i + 2]).toBeCloseTo(65 / 255, 6);
    }
  });

  it('draws nothing for a deciduous tree in winter', () => {
    const maple = createTree('maple', 'seed', 1);
    maple.trunk.heightCm = 20;
    markDirty(maple);
    addBranch(maple, -1, 12, 0, 6);
    const winter = buildFoliageMesh(maple, 'winter');
    expect(winter.positions).toHaveLength(0);
    expect(winter.colors).toHaveLength(0);
    expect(winter.uvs).toHaveLength(0);
    expect(buildFoliageMesh(maple, 'autumn').positions.length).toBeGreaterThan(0);
  });

  it('is deterministic: the same tree always gives the same mesh; another tree id differs', () => {
    const a = buildFoliageMesh(starterTree(), 'spring');
    const b = buildFoliageMesh(starterTree(), 'spring');
    expect(b.positions).toEqual(a.positions);
    expect(b.uvs).toEqual(a.uvs);

    const other = starterTree();
    other.id = 1;
    const c = buildFoliageMesh(other, 'spring');
    expect(c.positions).toHaveLength(a.positions.length);
    expect(c.positions).not.toEqual(a.positions);
  });

  it('the season changes colour only, never leaf placement', () => {
    const tree = starterTree();
    expect(buildFoliageMesh(tree, 'winter').positions).toEqual(
      buildFoliageMesh(tree, 'summer').positions,
    );
  });

  it('keeps every leaf centre within the spread around its branch tip', () => {
    const tree = starterTree();
    const mesh = buildFoliageMesh(tree, 'summer');
    const s = leafHalfSize(tree.foliageDensity);
    const perBranch = leafCount(tree.foliageDensity) * VERTICES_PER_LEAF;
    const eps = 1e-6;
    tree.branches.forEach((branch, bi) => {
      const tip = branchPoint(tree, branch, 1);
      for (let leaf = 0; leaf < leafCount(tree.foliageDensity); leaf++) {
        const first = bi * perBranch + leaf * VERTICES_PER_LEAF;
        // Vertex 0 of the xz quad is (cx - s, cy, cz - s).
        const p = positionAt(mesh, first);
        const centre = { x: p.x + s, y: p.y, z: p.z + s };
        expect(Math.abs(centre.x - tip.x)).toBeLessThanOrEqual(LEAF_SPREAD + eps);
        expect(Math.abs(centre.y - tip.y)).toBeLessThanOrEqual(LEAF_SPREAD + eps);
        expect(Math.abs(centre.z - tip.z)).toBeLessThanOrEqual(LEAF_SPREAD / 2 + eps);
      }
    });
  });
});
