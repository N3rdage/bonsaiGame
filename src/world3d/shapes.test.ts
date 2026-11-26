import { describe, expect, it } from 'vitest';
import {
  ball,
  ballVertexCount,
  cone,
  coneVertexCount,
  cylinder,
  cylinderVertexCount,
  RIM_LEAN,
  roundedBox,
  roundedBoxVertexCount,
  type ShapeData,
} from './shapes';

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
const unit = (a: Triple): Triple => {
  const length = Math.hypot(...a);
  return [a[0] / length, a[1] / length, a[2] / length];
};

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

const ROUND_CASES: readonly (readonly [string, () => ShapeData, number])[] = [
  ['a cylinder', () => cylinder(0.4, 1.2, 0.4), cylinderVertexCount()],
  ['a wide cylinder on 7 sides', () => cylinder(1, 0.2, 0.6, 7), cylinderVertexCount(7)],
  ['a cone', () => cone(0.6, 0.9, 0.6), coneVertexCount()],
  ['a frustum', () => cone(0.5, 0.3, 0.4, 12, 0.55), coneVertexCount(12, 0.55)],
  ['a ball', () => ball(0.5, 0.5, 0.5), ballVertexCount()],
  ['an ellipsoid', () => ball(0.6, 0.3, 0.9, 8, 4), ballVertexCount(8, 4)],
];

describe.each(ROUND_CASES)('%s', (_name, build, count) => {
  it('has the vertices its count says, and a normal and uv for each', () => {
    const shape = build();
    expect(shape.positions.length / 3).toBe(count);
    expect(shape.normals).toHaveLength(shape.positions.length);
    expect(shape.uvs.length / 2).toBe(count);
  });

  it('has unit normals that point away from the middle', () => {
    const { positions, normals } = build();
    for (let n = 0; n < positions.length / 3; n++) {
      expect(Math.hypot(...at(normals, n))).toBeCloseTo(1, 9);
      expect(dot(at(normals, n), at(positions, n))).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('indexes in range and winds every triangle into the shape, as CreateBox does', () => {
    const { positions, indices } = build();
    const total = positions.length / 3;
    expect(indices.length % 3).toBe(0);
    expect(indices.every((i) => Number.isInteger(i) && i >= 0 && i < total)).toBe(true);
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [indices[t] ?? 0, indices[t + 1] ?? 0, indices[t + 2] ?? 0];
      const [pa, pb, pc] = [at(positions, a), at(positions, b), at(positions, c)];
      const area = cross(sub(pb, pa), sub(pc, pa));
      const middle: Triple = [
        (pa[0] + pb[0] + pc[0]) / 3,
        (pa[1] + pb[1] + pc[1]) / 3,
        (pa[2] + pb[2] + pc[2]) / 3,
      ];
      // Every shape is convex and centred on the origin, so a triangle facing out has its middle on the side its cross product leaves.
      expect(dot(area, middle)).toBeLessThan(1e-12);
    }
  });

  it('is deterministic', () => {
    expect(build()).toEqual(build());
  });
});

describe('round shapes', () => {
  it('fill the box they are given', () => {
    const boxes: [ShapeData, Triple][] = [
      [cylinder(0.4, 1.2, 0.6, 12), [0.4, 1.2, 0.6]],
      [cone(0.4, 1.2, 0.6, 12), [0.4, 1.2, 0.6]],
      [ball(0.4, 1.2, 0.6, 12, 6), [0.4, 1.2, 0.6]],
    ];
    for (const [{ positions }, size] of boxes) {
      for (let axis = 0; axis < 3; axis++) {
        const coords = positions.filter((_, i) => i % 3 === axis);
        expect(Math.max(...coords)).toBeCloseTo((size[axis] ?? 0) / 2, 9);
        expect(Math.min(...coords)).toBeCloseTo(-(size[axis] ?? 0) / 2, 9);
      }
    }
  });

  it('count a cone as a ring, an apex and a base middle, and a cylinder as two rings and two middles', () => {
    expect(coneVertexCount(10)).toBe(12);
    expect(cylinderVertexCount(10)).toBe(22);
    expect(ballVertexCount(10, 5)).toBe(42);
  });

  it('narrow a frustum to its taper at the top', () => {
    const { positions } = cone(1, 1, 1, 8, 0.5);
    const topRing = [...Array(positions.length / 3).keys()]
      .map((n) => at(positions, n))
      .filter(([x, y, z]) => y > 0.49 && Math.hypot(x, z) > 0.1);
    expect(topRing).toHaveLength(8);
    for (const [x, , z] of topRing) expect(Math.hypot(x, z)).toBeCloseTo(0.25, 9);
  });

  it('give a sphere normals that run out from its middle through each vertex', () => {
    const { positions, normals } = ball(0.46, 0.46, 0.46);
    for (let n = 0; n < positions.length / 3; n++) {
      const expected = unit(at(positions, n));
      at(normals, n).forEach((v, axis) => {
        expect(v).toBeCloseTo(expected[axis] ?? 0, 9);
      });
    }
  });

  it('give an ellipsoid normals along its gradient (x / a², y / b², z / c²)', () => {
    const [a, b, c] = [0.3, 0.15, 0.45];
    const { positions, normals } = ball(2 * a, 2 * b, 2 * c, 8, 4);
    for (let n = 0; n < positions.length / 3; n++) {
      const [x, y, z] = at(positions, n);
      const expected = unit([x / a ** 2, y / b ** 2, z / c ** 2]);
      at(normals, n).forEach((v, axis) => {
        expect(v).toBeCloseTo(expected[axis] ?? 0, 9);
      });
    }
  });

  it.each([
    ['a cylinder', 0.4, 1.2, 0.6, 1],
    ['a cone', 0.6, 0.9, 0.4, 0],
    ['a lamp-shade frustum', 0.5, 0.3, 0.4, 0.55],
  ] as const)(
    'give %s rims the side’s true normal leaning RIM_LEAN toward the cap',
    (_name, w, h, d, taper) => {
      const segments = 12;
      const { positions, normals } = cone(w, h, d, segments, taper);
      const [a, c] = [w / 2, d / 2];
      for (let i = 0; i < segments; i++) {
        const base = at(positions, i);
        const top = at(positions, taper > 0 ? segments + i : segments);
        // The side through this vertex holds the slant edge up to the top and the ring's tangent.
        const tangent: Triple = [-(a ** 2) * base[2], 0, c ** 2 * base[0]];
        const side = unit(cross(sub(top, base), tangent));
        expect(dot(side, [base[0], 0, base[2]])).toBeGreaterThan(0);
        const rims: [number, number][] = [[i, -1]];
        if (taper > 0) rims.push([segments + i, 1]);
        for (const [vertex, cap] of rims) {
          const expected = unit([side[0], side[1] + RIM_LEAN * cap, side[2]]);
          at(normals, vertex).forEach((v, axis) => {
            expect(v).toBeCloseTo(expected[axis] ?? 0, 9);
          });
        }
      }
    },
  );

  it('refuse a taper outside 0 to 1', () => {
    expect(() => cone(1, 1, 1, 8, 1.5)).toThrow(RangeError);
    expect(() => cone(1, 1, 1, 8, -0.1)).toThrow(RangeError);
  });
});
