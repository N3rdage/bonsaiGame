import { describe, expect, it } from 'vitest';
import { roundedBox, roundedBoxVertexCount } from './shapes';

type Triple = readonly [number, number, number];

/** The `n`th vertex attribute triple of `flat`. */
function at(flat: readonly number[], n: number): Triple {
  return [flat[3 * n] ?? 0, flat[3 * n + 1] ?? 0, flat[3 * n + 2] ?? 0];
}

const dot = (a: Triple, b: Triple): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Triple, b: Triple): Triple => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Triple, b: Triple): Triple => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const CASES = [
  { w: 1, h: 0.5, d: 0.25, r: 0.05, bands: 2 },
  { w: 0.04, h: 1.2, d: 0.04, r: 0.013, bands: 2 },
  { w: 2, h: 2, d: 2, r: 0.3, bands: 3 },
  { w: 1, h: 1, d: 1, r: 0.2, bands: 1 },
] as const;

describe('roundedBox', () => {
  it('counts its vertices as the helper does', () => {
    const six = roundedBox(1, 1, 1, 0.1, 2);
    expect(six.positions.length / 3).toBe(3 * 2 * 6 * 6);
    for (const { w, h, d, r, bands } of CASES) {
      const shape = roundedBox(w, h, d, r, bands);
      expect(shape.positions.length / 3).toBe(roundedBoxVertexCount(w, h, d, r, bands));
      expect(shape.normals).toHaveLength(shape.positions.length);
      expect(shape.uvs.length / 2).toBe(shape.positions.length / 3);
    }
  });

  it('keeps every vertex inside the box and reaches every face', () => {
    for (const { w, h, d, r, bands } of CASES) {
      const { positions } = roundedBox(w, h, d, r, bands);
      const half = [w / 2, h / 2, d / 2];
      for (let axis = 0; axis < 3; axis++) {
        const coords = positions.filter((_, i) => i % 3 === axis);
        expect(Math.max(...coords)).toBeCloseTo(half[axis] ?? 0, 9);
        expect(Math.min(...coords)).toBeCloseTo(-(half[axis] ?? 0), 9);
      }
    }
  });

  it('has unit normals that point away from the middle', () => {
    for (const { w, h, d, r, bands } of CASES) {
      const { positions, normals } = roundedBox(w, h, d, r, bands);
      for (let n = 0; n < positions.length / 3; n++) {
        const normal = at(normals, n);
        expect(Math.hypot(...normal)).toBeCloseTo(1, 9);
        expect(dot(normal, at(positions, n))).toBeGreaterThan(0);
      }
    }
  });

  it('indexes in range and winds every triangle as CreateBox does, against its normal', () => {
    for (const { w, h, d, r, bands } of CASES) {
      const { positions, normals, indices } = roundedBox(w, h, d, r, bands);
      const count = positions.length / 3;
      expect(indices.length % 3).toBe(0);
      expect(indices.every((i) => Number.isInteger(i) && i >= 0 && i < count)).toBe(true);
      for (let t = 0; t < indices.length; t += 3) {
        const [a, b, c] = [indices[t] ?? 0, indices[t + 1] ?? 0, indices[t + 2] ?? 0];
        const area = cross(
          sub(at(positions, b), at(positions, a)),
          sub(at(positions, c), at(positions, a)),
        );
        const normal = at(normals, a);
        // Babylon's front face is clockwise by the right-hand rule, so its cross product runs into the box.
        const flat = Math.hypot(...area) < 1e-12;
        expect(flat || dot(area, normal) < 0).toBe(true);
      }
    }
  });

  it('is a plain box with a flat middle: a face has a vertex at each corner of its inner rectangle', () => {
    const { positions } = roundedBox(1, 1, 1, 0.1, 2);
    const top = [...Array(positions.length / 3).keys()]
      .map((n) => at(positions, n))
      .filter(([, y]) => Math.abs(y - 0.5) < 1e-9);
    expect(top.some(([x, , z]) => Math.abs(x - 0.4) < 1e-9 && Math.abs(z - 0.4) < 1e-9)).toBe(true);
  });

  it('clamps the rounding to the smallest half-extent', () => {
    const huge = roundedBox(1, 0.2, 0.6, 5, 2);
    const clamped = roundedBox(1, 0.2, 0.6, 0.1, 2);
    expect(huge.positions).toEqual(clamped.positions);
    expect(roundedBoxVertexCount(1, 0.2, 0.6, 5, 2)).toBe(
      roundedBoxVertexCount(1, 0.2, 0.6, 0.1, 2),
    );
    expect(clamped.positions.length / 3).toBeLessThan(
      roundedBox(1, 0.2, 0.6, 0.05, 2).positions.length / 3,
    );
  });

  it('is deterministic', () => {
    expect(roundedBox(0.7, 0.3, 0.5, 0.04)).toEqual(roundedBox(0.7, 0.3, 0.5, 0.04));
  });

  it('refuses a radius that is not above zero', () => {
    expect(() => roundedBox(1, 1, 1, 0)).toThrow(RangeError);
    expect(() => roundedBoxVertexCount(1, 1, 1, -1)).toThrow(RangeError);
  });
});
