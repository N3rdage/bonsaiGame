import { describe, expect, it } from 'vitest';
import { DISPLAY_SCALE } from '../sim/geometry';
import { buildPotGeometry } from '../viewer/potGeometry';
import { bonsaiMeshes, lowestZ, toRenderMesh } from './bonsai';
import { buildScene } from './scene';

const scene = buildScene();

describe('the bonsai on the pedestal', () => {
  const meshes = bonsaiMeshes(scene);

  it("stands the pot's feet on the pedestal's top, in metres", () => {
    const ys = [...meshes.pot.positions].filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBeCloseTo(scene.pedestal.z, 6);
    // The pot is a real 20 cm across (0.1 display units a side of its centre at 4 a metre... see potGeometry).
    const xs = [...meshes.pot.positions].filter((_, i) => i % 3 === 0);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.4);
  });

  it('draws a real tree from the simulation: bark, and foliage in summer', () => {
    expect(meshes.tree.speciesKey).toBe('maple');
    expect(meshes.bark.positions.length).toBeGreaterThan(0);
    expect(meshes.foliage.positions.length).toBeGreaterThan(0);
    // Every triangle in both windings.
    expect(meshes.bark.indices.length).toBe((2 * meshes.bark.positions.length) / 3);
  });

  it('carries a viewer point to origin + p / DISPLAY_SCALE, z up becoming the render y', () => {
    const pot = buildPotGeometry(0);
    const m = toRenderMesh(pot, { x: 1, y: 2, z: 3 });
    expect(m.positions[0]).toBeCloseTo(1 + (pot.positions[0] ?? 0) / DISPLAY_SCALE, 6);
    expect(m.positions[1]).toBeCloseTo(3 + (pot.positions[2] ?? 0) / DISPLAY_SCALE, 6);
    expect(m.positions[2]).toBeCloseTo(2 + (pot.positions[1] ?? 0) / DISPLAY_SCALE, 6);
    expect(lowestZ(pot)).toBeLessThan(0);
  });
});
