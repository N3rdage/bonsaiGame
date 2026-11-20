import { describe, expect, it } from 'vitest';
import { sceneBatches } from './meshData';
import { MATERIALS, buildScene, type SceneBox, type SpikeScene } from './scene';

const box = (over: Partial<SceneBox>): SceneBox => ({
  name: 'b',
  wash: 'wood',
  material: 'wood',
  ground: false,
  solid: true,
  x0: 0,
  x1: 2,
  y0: 0,
  y1: 1,
  z0: 0,
  z1: 3,
  ...over,
});

const only = (boxes: SceneBox[]): SpikeScene => ({ ...buildScene(), boxes, materials: MATERIALS });

describe('the scene as triangles', () => {
  it('gives a box 24 vertices and 12 triangles in the render frame, x east, y up, z south', () => {
    const { fills } = sceneBatches(only([box({})]));
    expect(fills).toHaveLength(1);
    const mesh = fills[0]?.mesh;
    expect(mesh?.positions.length).toBe(24 * 3);
    expect(mesh?.indices.length).toBe(36);
    const ps = [...(mesh?.positions ?? [])];
    const ys = ps.filter((_, i) => i % 3 === 1);
    const zs = ps.filter((_, i) => i % 3 === 2);
    expect(Math.max(...ys)).toBe(3);
    expect(Math.max(...zs)).toBe(1);
  });

  it('winds every face counter-clockwise seen from outside', () => {
    const mesh = sceneBatches(only([box({})])).fills[0]?.mesh;
    if (!mesh) throw new Error('no mesh');
    const p = (i: number) => {
      const k = (mesh.indices[i] ?? 0) * 3;
      return [mesh.positions[k] ?? 0, mesh.positions[k + 1] ?? 0, mesh.positions[k + 2] ?? 0];
    };
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const [a, b, c] = [p(t), p(t + 1), p(t + 2)];
      const u = [0, 1, 2].map((i) => (b[i] ?? 0) - (a[i] ?? 0));
      const v = [0, 1, 2].map((i) => (c[i] ?? 0) - (a[i] ?? 0));
      const cx = (u[1] ?? 0) * (v[2] ?? 0) - (u[2] ?? 0) * (v[1] ?? 0);
      const cy = (u[2] ?? 0) * (v[0] ?? 0) - (u[0] ?? 0) * (v[2] ?? 0);
      const cz = (u[0] ?? 0) * (v[1] ?? 0) - (u[1] ?? 0) * (v[0] ?? 0);
      const k = (mesh.indices[t] ?? 0) * 3;
      const [nx = 0, ny = 0, nz = 0] = mesh.normals.subarray(k, k + 3);
      expect(cx * nx + cy * ny + cz * nz).toBeGreaterThan(0);
    }
  });

  it('tiles uvs in world metres, so a 2.4 m wall face runs v 0..1', () => {
    const wall = box({ material: 'shedWall', x0: 0, x1: 1, y0: 0, y1: 0.1, z0: 0, z1: 2.4 });
    const mesh = sceneBatches(only([wall])).fills[0]?.mesh;
    // The +z (south) face is the fifth: u along x over 0.5 m, v up over 2.4 m.
    const face = [...(mesh?.uvs ?? [])].slice(4 * 4 * 2, 5 * 4 * 2);
    expect(face).toEqual([0, 0, 2, 0, 2, 1, 0, 1].map((v) => expect.closeTo(v, 6) as unknown));
  });

  it('batches fills by material, occluder and ground, and ink by occluder', () => {
    const { fills, inks } = sceneBatches(
      only([
        box({}),
        box({ x0: 5, x1: 6 }),
        box({ occluder: 'house' }),
        box({ material: 'stone' }),
        box({ ground: true, z1: 0.05 }),
      ]),
    );
    expect(fills).toHaveLength(4);
    expect(inks.map((i) => i.occluder)).toEqual([undefined, 'house']);
    // Five boxes' creases, 12 edges each; hulls for the four standing.
    const rest = inks[0];
    expect(rest?.edges.length).toBe(4 * 12 * 6);
    expect(rest?.hull.positions.length).toBe(3 * 24 * 3);
  });

  it("points the hull's normals along each corner's diagonal", () => {
    const hull = sceneBatches(only([box({})])).inks[0]?.hull;
    const k = 1 / Math.sqrt(3);
    for (const v of hull?.normals ?? []) expect(Math.abs(v)).toBeCloseTo(k, 6);
  });

  it('batches the whole scene into a few dozen buffers', () => {
    const { fills, inks } = sceneBatches(buildScene());
    expect(fills.length).toBeLessThan(40);
    expect(inks.length).toBe(11);
  });
});
