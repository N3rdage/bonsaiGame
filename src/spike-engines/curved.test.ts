import { describe, expect, it } from 'vitest';
import { ellipsoid, hedgeBody, lathe, merge, treeCanopy, treeTrunk } from './curved';
import type { MeshArrays } from './meshData';

/** The share of triangles whose winding agrees with their vertices' normals. */
function outwardShare(m: MeshArrays): number {
  let good = 0;
  let counted = 0;
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [m.indices[t] ?? 0, m.indices[t + 1] ?? 0, m.indices[t + 2] ?? 0];
    const p = (i: number, k: number): number => m.positions[i * 3 + k] ?? 0;
    const e1 = [0, 1, 2].map((k) => p(b, k) - p(a, k));
    const e2 = [0, 1, 2].map((k) => p(c, k) - p(a, k));
    const cross = [
      (e1[1] ?? 0) * (e2[2] ?? 0) - (e1[2] ?? 0) * (e2[1] ?? 0),
      (e1[2] ?? 0) * (e2[0] ?? 0) - (e1[0] ?? 0) * (e2[2] ?? 0),
      (e1[0] ?? 0) * (e2[1] ?? 0) - (e1[1] ?? 0) * (e2[0] ?? 0),
    ];
    if (Math.hypot(...cross) < 1e-9) continue;
    const n = [0, 1, 2].map((k) => (m.normals[a * 3 + k] ?? 0) + (m.normals[b * 3 + k] ?? 0));
    counted++;
    if (cross.reduce((s, v, k) => s + v * (n[k] ?? 0), 0) > 0) good++;
  }
  return good / counted;
}

describe('curved meshes', () => {
  it('builds an ellipsoid with unit normals and consistent counts', () => {
    const m = ellipsoid({
      center: { x: 1, y: 2, z: 3 },
      radii: { x: 1, y: 2, z: 3 },
      rings: 6,
      segments: 8,
    });
    const vertices = 7 * 9;
    expect(m.positions.length).toBe(vertices * 3);
    expect(m.normals.length).toBe(vertices * 3);
    expect(m.uvs.length).toBe(vertices * 2);
    expect(m.indices.length).toBe(6 * 8 * 6);
    for (let i = 0; i < vertices; i++) {
      expect(
        Math.hypot(m.normals[i * 3] ?? 0, m.normals[i * 3 + 1] ?? 0, m.normals[i * 3 + 2] ?? 0),
      ).toBeCloseTo(1, 5);
    }
  });

  it('winds every curved mesh counter-clockwise from outside', () => {
    for (const m of [
      ellipsoid({ center: { x: 0, y: 0, z: 0 }, radii: { x: 1, y: 1, z: 2 }, stretch: 0.5 }),
      treeTrunk(),
      treeCanopy(),
      hedgeBody(),
    ]) {
      expect(outwardShare(m)).toBeGreaterThan(0.99);
    }
  });

  it('stretches a capsule by twice its stretch', () => {
    const m = ellipsoid({
      center: { x: 0, y: 0, z: 0 },
      radii: { x: 0.1, y: 0.1, z: 0.1 },
      stretch: 0.4,
    });
    const ys = Array.from(
      { length: m.positions.length / 3 },
      (_, i) => m.positions[i * 3 + 1] ?? 0,
    );
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(1, 5);
  });

  it('lathes a profile about the y axis', () => {
    const m = lathe(
      [
        [0, 0],
        [1, 0],
        [1, 2],
        [0, 2],
      ],
      6,
    );
    expect(m.positions.length / 3).toBe(4 * 7);
    for (let i = 0; i < m.positions.length / 3; i++) {
      expect(Math.hypot(m.positions[i * 3] ?? 0, m.positions[i * 3 + 2] ?? 0)).toBeLessThanOrEqual(
        1 + 1e-6,
      );
    }
  });

  it('merges meshes with indices offset', () => {
    const a = hedgeBody();
    const b = treeTrunk();
    const m = merge([a, b]);
    expect(m.positions.length).toBe(a.positions.length + b.positions.length);
    expect(m.indices.length).toBe(a.indices.length + b.indices.length);
    const lastIndex = Math.max(...m.indices.slice(a.indices.length));
    expect(lastIndex).toBe(m.positions.length / 3 - 1);
  });
});
