/**
 * A roof's mesh for the 3D world, as pure data: the roof (plan.ts) is a
 * cross-section, a gable's two slopes or a slope's one, extruded along the
 * ridge, with a triangle closing each end. Each face is flat shaded; each
 * triangle is given in both windings so it draws from either side.
 */

import { toBabylon, type Vec3 } from './meshes';
import type { Roof } from './plan';

export interface RoofMesh {
  /** The mesh's origin in Babylon's frame: the middle of the roof's footprint and of its heights, `low` to `high`. */
  readonly center: Vec3;
  /** Relative to `center`, Babylon's frame. */
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
}

type Point = readonly [number, number, number];

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** The unit normal of the triangle `a`, `b`, `c` in the plan's frame, turned to face `outward`. */
function normalOf(a: Point, b: Point, c: Point, outward: Point): Point {
  const u = sub(b, a);
  const v = sub(c, a);
  const n: Point = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const length = Math.hypot(...n);
  const sign = n[0] * outward[0] + n[1] * outward[1] + n[2] * outward[2] < 0 ? -1 : 1;
  return [(sign * n[0]) / length, (sign * n[1]) / length, (sign * n[2]) / length];
}

export function roofMesh(roof: Roof): RoofMesh {
  const { x0, x1, y0, y1, low, high, form } = roof;
  const alongX = form.kind === 'gable' ? form.axis === 'x' : form.high === 'N' || form.high === 'S';
  const [l0, l1] = alongX ? [x0, x1] : [y0, y1];
  const [c0, c1] = alongX ? [y0, y1] : [x0, x1];
  const highFirst = form.kind === 'slope' && (form.high === 'N' || form.high === 'W');
  const profile: readonly (readonly [number, number])[] =
    form.kind === 'gable'
      ? [
          [c0, low],
          [(c0 + c1) / 2, high],
          [c1, low],
        ]
      : [
          [c0, highFirst ? high : low],
          [c1, highFirst ? low : high],
        ];
  const at = (l: number, [c, z]: readonly [number, number]): Point =>
    alongX ? [l, c, z] : [c, l, z];
  const centre: Vec3 = toBabylon({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (low + high) / 2 });

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const face = (corners: readonly Point[], outward: Point): void => {
    const [a, b, c] = corners as readonly [Point, Point, Point];
    const normal = normalOf(a, b, c, outward);
    const first = positions.length / 3;
    for (const corner of corners) {
      const p = toBabylon({ x: corner[0], y: corner[1], z: corner[2] });
      positions.push(p.x - centre.x, p.y - centre.y, p.z - centre.z);
      const n = toBabylon({ x: normal[0], y: normal[1], z: normal[2] });
      normals.push(n.x, n.y, n.z);
    }
    for (let k = 1; k + 1 < corners.length; k += 1) {
      indices.push(first, first + k, first + k + 1, first, first + k + 1, first + k);
    }
  };

  const up: Point = [0, 0, 1];
  for (const [k, p] of profile.entries()) {
    const q = profile[k + 1];
    if (q !== undefined) face([at(l0, p), at(l0, q), at(l1, q), at(l1, p)], up);
  }
  // Each end closes the cross-section: a gable's is its profile, a slope's has the high edge's foot added.
  const foot: readonly [number, number] = [highFirst ? c0 : c1, low];
  const section = form.kind === 'gable' ? profile : [...profile, foot];
  const along: Point = alongX ? [1, 0, 0] : [0, 1, 0];
  const behind: Point = alongX ? [-1, 0, 0] : [0, -1, 0];
  face(
    section.map((pt) => at(l0, pt)),
    behind,
  );
  face(
    section.map((pt) => at(l1, pt)),
    along,
  );

  return {
    center: centre,
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}
