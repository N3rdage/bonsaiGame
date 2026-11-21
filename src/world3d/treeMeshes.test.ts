import { describe, expect, it } from 'vitest';
import { DISPLAY_SCALE } from '../sim/geometry';
import { createTree } from '../sim/tree';
import { buildPotGeometry, FOOT_H, POT_DEPTH, POT_LIP, POT_R_TOP } from '../viewer/potGeometry';
import { potPalette } from '../viewer/potPalette';
import { buildTreeMesh } from '../viewer/treeMesh';
import { treeMeshData, worldMeshData } from './treeMeshes';

const tree = createTree('juniper', 'cutting', 0);

describe('worldMeshData', () => {
  it('turns display units into metres and swaps y and z for y up', () => {
    const data = worldMeshData({
      positions: new Float32Array([4, 8, 12, 0, 0, 0, 0, 0, 0]),
      normals: new Float32Array([0, 1, 0, 0, 0, 1, 1, 0, 0]),
      colors: new Float32Array([1, 0.5, 0, 0, 0, 0, 1, 1, 1]),
      uvs: new Float32Array(6),
    });
    expect(Array.from(data.positions.subarray(0, 3))).toEqual([1, 3, 2]);
    expect(Array.from(data.normals)).toEqual([0, 0, 1, 0, 1, 0, 1, 0, 0]);
    expect(Array.from(data.colors.subarray(0, 8))).toEqual([1, 0.5, 0, 1, 0, 0, 0, 1]);
    expect(Array.from(data.indices)).toEqual([0, 1, 2, 0, 2, 1]);
  });
});

describe('treeMeshData', () => {
  it('is the viewer mesh at real scale: the pot rim is 0.1 m of radius and its lip, the trunk is its cm tall', () => {
    const parts = treeMeshData(tree, 'summer');
    const pot = parts.find((p) => p.part === 'pot')?.data;
    const trunk = parts.find((p) => p.part === 'trunk')?.data;
    expect(pot?.positions.length).toBe(buildPotGeometry(tree.potTier).positions.length);
    expect(trunk?.positions.length).toBe(buildTreeMesh(tree).positions.length);
    const reach = (axis: number, data: Float32Array | undefined): number =>
      Math.max(...Array.from(data ?? []).filter((_, i) => i % 3 === axis));
    expect(reach(0, pot?.positions)).toBeCloseTo((POT_R_TOP + POT_LIP) / DISPLAY_SCALE, 3);
    expect(POT_R_TOP / DISPLAY_SCALE).toBeCloseTo(0.1);
    // y is up: above the soil (the pot's depth up), no trunk vertex is far above the tree's own height.
    const aboveSoil = reach(1, trunk?.positions) - POT_DEPTH / DISPLAY_SCALE;
    expect(aboveSoil).toBeLessThan((tree.trunk.heightCm / 100) * 1.6);
    expect(aboveSoil).toBeGreaterThan((tree.trunk.heightCm / 100) * 0.5);
  });

  it('stands the pot on the surface, feet included, with the soil above its bottom and the trunk rooted there', () => {
    const ys = (data: Float32Array | undefined): number[] =>
      Array.from(data ?? []).filter((_, i) => i % 3 === 1);
    // The soil is the viewer's z 0; a pot on feet is raised by them.
    const soilAbove = { 0: POT_DEPTH, 1: POT_DEPTH + FOOT_H } as const;
    for (const potTier of [0, 1] as const) {
      const parts = treeMeshData({ ...tree, potTier }, 'summer');
      const pot = ys(parts.find((p) => p.part === 'pot')?.data.positions);
      const trunk = ys(parts.find((p) => p.part === 'trunk')?.data.positions);
      const soil = soilAbove[potTier] / DISPLAY_SCALE;
      expect(Math.min(...pot)).toBeCloseTo(0, 5);
      expect(Math.min(...trunk)).toBeCloseTo(soil, 3);
    }
  });

  it('colours the pot by tier, fancy pots included', () => {
    const colours = (potTier: 0 | 1): Set<string> => {
      const pot = treeMeshData({ ...tree, potTier }, 'summer').find((p) => p.part === 'pot');
      return new Set(Array.from(pot?.data.colors ?? []).map((c) => c.toFixed(4)));
    };
    for (const tier of [0, 1] as const) {
      const { r, g, b } = potPalette(tier).body;
      for (const channel of [r, g, b]) expect(colours(tier)).toContain((channel / 255).toFixed(4));
    }
    expect(colours(0)).not.toEqual(colours(1));
  });

  it('leaves out foliage when the species is bare', () => {
    const bare = { ...tree, speciesKey: 'maple' as const };
    const winter = treeMeshData(bare, 'winter').map((p) => p.part);
    expect(winter).not.toContain('foliage');
    expect(treeMeshData(bare, 'summer').map((p) => p.part)).toContain('foliage');
  });
});
