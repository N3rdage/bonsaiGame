import { describe, expect, it } from 'vitest';
import { DISPLAY_SCALE } from '../sim/geometry';
import { createTree } from '../sim/tree';
import { buildPotGeometry, FOOT_H, POT_DEPTH, POT_LIP, POT_R_TOP } from '../viewer/potGeometry';
import { potPalette } from '../viewer/potPalette';
import { buildTreeMesh } from '../viewer/treeMesh';
import { readFileSync } from 'node:fs';
import { buildFoliageMesh } from '../viewer/foliageMesh';
import { BONSAI_SCALE, treeMeshData, worldMeshData } from './treeMeshes';

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

  it('scales positions about the origin and leaves normals alone', () => {
    const data = worldMeshData(
      {
        positions: new Float32Array([4, 8, 12, 0, 0, 0, 0, 0, 0]),
        normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
        colors: new Float32Array(9),
        uvs: new Float32Array(6),
      },
      0,
      2,
    );
    expect(Array.from(data.positions.subarray(0, 3))).toEqual([2, 6, 4]);
    expect(Array.from(data.normals.subarray(0, 3))).toEqual([0, 0, 1]);
  });
});

describe('treeMeshData', () => {
  it('is the viewer mesh at BONSAI_SCALE times real scale: the pot rim is 0.1 m of radius and its lip, the trunk is its cm tall', () => {
    const parts = treeMeshData(tree, 'summer');
    const pot = parts.find((p) => p.part === 'pot')?.data;
    const trunk = parts.find((p) => p.part === 'trunk')?.data;
    expect(pot?.positions.length).toBe(buildPotGeometry(tree.potTier).positions.length);
    expect(trunk?.positions.length).toBe(buildTreeMesh(tree).positions.length);
    const reach = (axis: number, data: Float32Array | undefined): number =>
      Math.max(...Array.from(data ?? []).filter((_, i) => i % 3 === axis));
    expect(reach(0, pot?.positions)).toBeCloseTo(
      ((POT_R_TOP + POT_LIP) / DISPLAY_SCALE) * BONSAI_SCALE,
      3,
    );
    expect(POT_R_TOP / DISPLAY_SCALE).toBeCloseTo(0.1);
    // y is up: above the soil (the pot's depth up), no trunk vertex is far above the tree's own height.
    const aboveSoil = reach(1, trunk?.positions) - (POT_DEPTH / DISPLAY_SCALE) * BONSAI_SCALE;
    expect(aboveSoil).toBeLessThan((tree.trunk.heightCm / 100) * 1.6 * BONSAI_SCALE);
    expect(aboveSoil).toBeGreaterThan((tree.trunk.heightCm / 100) * 0.5 * BONSAI_SCALE);
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
      const soil = (soilAbove[potTier] / DISPLAY_SCALE) * BONSAI_SCALE;
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

  it('draws every tree BONSAI_SCALE (1.3) times its real size, a feel number', () => {
    expect(BONSAI_SCALE).toBe(1.3);
  });

  it('is the real-size build scaled about the feet: the base stays at y 0, the extent grows by the factor', () => {
    const reach = (data: Float32Array, axis: number): [number, number] => {
      const v = Array.from(data).filter((_, i) => i % 3 === axis);
      return [Math.min(...v), Math.max(...v)];
    };
    const all = (list: { positions: Float32Array }[]): Float32Array =>
      Float32Array.from(list.flatMap((d) => Array.from(d.positions)));
    for (const potTier of [0, 1] as const) {
      const t = { ...tree, potTier };
      const pot = buildPotGeometry(potTier);
      const low = Math.min(...Array.from(pot.positions).filter((_, i) => i % 3 === 2));
      const real = all([
        worldMeshData(pot, -low),
        worldMeshData(buildTreeMesh(t), -low),
        worldMeshData(buildFoliageMesh(t, 'summer'), -low),
      ]);
      const drawn = all(treeMeshData(t, 'summer').map((p) => p.data));
      expect(reach(drawn, 1)[0]).toBeCloseTo(0, 5);
      for (const axis of [0, 1, 2]) {
        expect(reach(drawn, axis)[0]).toBeCloseTo(reach(real, axis)[0] * BONSAI_SCALE, 4);
        expect(reach(drawn, axis)[1]).toBeCloseTo(reach(real, axis)[1] * BONSAI_SCALE, 4);
      }
    }
  });

  it("leaves the tree itself, the simulation's numbers, untouched", () => {
    const before = structuredClone(tree);
    treeMeshData(tree, 'summer');
    expect(tree).toEqual(before);
  });
});

describe('source plants', () => {
  it('are not bonsai: details.ts draws them, never from treeMeshes, so the factor does not reach them', () => {
    const source = readFileSync(new URL('./details.ts', import.meta.url), 'utf8');
    expect(source).not.toContain('BONSAI_SCALE');
    expect(source).not.toContain('treeMeshes');
  });
});
