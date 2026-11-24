import { describe, expect, it } from 'vitest';
import type { Roof } from './plan';
import { roofMesh } from './roofMeshes';

const gable: Roof = {
  name: 'g',
  wash: 'tile',
  x0: 0,
  x1: 6,
  y0: 0,
  y1: 4,
  low: 2,
  high: 3,
  form: { kind: 'gable', axis: 'x' },
};
const slope: Roof = {
  ...gable,
  name: 's',
  low: 0.4,
  high: 2.25,
  form: { kind: 'slope', high: 'N' },
};

/** The mesh's vertices in Babylon's frame (x east, y up, z north), moved back from its centre. */
const vertices = (roof: Roof) => {
  const { center, positions } = roofMesh(roof);
  return Array.from({ length: positions.length / 3 }, (_, v) => ({
    x: (positions[v * 3] ?? 0) + center.x,
    y: (positions[v * 3 + 1] ?? 0) + center.y,
    z: (positions[v * 3 + 2] ?? 0) + center.z,
  }));
};

describe('roofMesh', () => {
  it('keeps a gable to 14 vertices, its ridge over the middle of the footprint', () => {
    const v = vertices(gable);
    expect(v).toHaveLength(14);
    expect(Math.max(...v.map((p) => p.y))).toBeCloseTo(3);
    expect(Math.min(...v.map((p) => p.y))).toBeCloseTo(2);
    const ridge = v.filter((p) => Math.abs(p.y - 3) < 1e-6);
    expect(ridge.every((p) => Math.abs(p.z + 2) < 1e-6)).toBe(true);
  });

  it('keeps a slope to 10 vertices, high on the north (+z) edge and low on the south', () => {
    const v = vertices(slope);
    expect(v).toHaveLength(10);
    for (const p of v) {
      if (p.y > 2.2) expect(p.z).toBeCloseTo(0);
    }
    expect(Math.min(...v.map((p) => p.y))).toBeCloseTo(0.4);
    const south = v.filter((p) => Math.abs(p.z + 4) < 1e-6);
    expect(south.every((p) => Math.abs(p.y - 0.4) < 1e-6)).toBe(true);
  });

  it('gives every vertex a unit normal and every triangle both windings', () => {
    for (const roof of [gable, slope]) {
      const { normals, indices } = roofMesh(roof);
      expect(indices.length % 6).toBe(0);
      for (let v = 0; v < normals.length; v += 3) {
        const length = Math.hypot(normals[v] ?? 0, normals[v + 1] ?? 0, normals[v + 2] ?? 0);
        expect(length).toBeCloseTo(1);
      }
    }
    const { normals } = roofMesh(slope);
    // The slope's face looks up and south: +y and -z in Babylon's frame.
    expect(normals[1]).toBeGreaterThan(0);
    expect(normals[2]).toBeLessThan(0);
  });
});
