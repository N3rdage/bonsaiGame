/**
 * Curved meshes for the heavy engine spike (backlog #391) as plain triangle
 * arrays in the render frame (x east, y up, z south, right-handed), wound
 * counter-clockwise seen from outside: a lathe (trunks), an ellipsoid with an
 * optional straight middle (canopies, hedges, the character's limbs) and a
 * merge. Normals are analytic and smooth, so the ink hull can push every
 * vertex along its own normal and stay closed. Pure: both engine pages draw
 * exactly these triangles.
 */

import type { MeshArrays } from './meshData';

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

class Arrays {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly indices: number[] = [];

  /** Indexes a `rows` x `cols` grid of vertices pushed row by row, `cols` of them a row. */
  grid(rows: number, cols: number, first: number): void {
    for (let r = 0; r + 1 < rows; r++) {
      for (let c = 0; c + 1 < cols; c++) {
        const a = first + r * cols + c;
        const b = a + 1;
        const d = a + cols;
        const e = d + 1;
        this.indices.push(a, d, b, b, d, e);
      }
    }
  }

  build(): MeshArrays {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
      indices: new Uint32Array(this.indices),
    };
  }
}

export interface EllipsoidSpec {
  readonly center: Vec3;
  readonly radii: Vec3;
  /** Half the length of a straight middle along y: 0 is an ellipsoid, more is a capsule. */
  readonly stretch?: number;
  readonly rings?: number;
  readonly segments?: number;
}

/** An ellipsoid, or with `stretch` a capsule-like rounded bar, poles up and down. */
export function ellipsoid(spec: EllipsoidSpec): MeshArrays {
  const { center: c, radii: r, stretch = 0, rings = 10, segments = 16 } = spec;
  const out = new Arrays();
  for (let i = 0; i <= rings; i++) {
    const theta = (1 - i / rings) * Math.PI;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    for (let j = 0; j <= segments; j++) {
      const phi = (j / segments) * Math.PI * 2;
      const nx = (sinT * Math.cos(phi)) / r.x;
      const ny = cosT / r.y;
      const nz = (sinT * Math.sin(phi)) / r.z;
      const len = Math.hypot(nx, ny, nz);
      out.positions.push(
        c.x + r.x * sinT * Math.cos(phi),
        c.y + r.y * cosT + (cosT >= 0 ? stretch : -stretch),
        c.z + r.z * sinT * Math.sin(phi),
      );
      out.normals.push(nx / len, ny / len, nz / len);
      out.uvs.push(j / segments, i / rings);
    }
  }
  out.grid(rings + 1, segments + 1, 0);
  return out.build();
}

/** One profile point of a lathe: distance from the axis, height. */
export type ProfilePoint = readonly [radius: number, height: number];

/** A surface of revolution about the y axis from a profile climbing from the bottom (on the axis) to the top (on the axis). */
export function lathe(profile: readonly ProfilePoint[], segments = 12): MeshArrays {
  const out = new Arrays();
  const outward = (a: ProfilePoint, b: ProfilePoint): [number, number] => {
    const dr = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dr, dy) || 1;
    return [dy / len, -dr / len];
  };
  profile.forEach((point, i) => {
    const before = profile[i - 1];
    const after = profile[i + 1];
    const [nr0, ny0] = before ? outward(before, point) : [0, 0];
    const [nr1, ny1] = after ? outward(point, after) : [0, 0];
    const nr = nr0 + nr1;
    const ny = ny0 + ny1;
    const len = Math.hypot(nr, ny) || 1;
    for (let j = 0; j <= segments; j++) {
      const phi = (j / segments) * Math.PI * 2;
      out.positions.push(point[0] * Math.cos(phi), point[1], point[0] * Math.sin(phi));
      out.normals.push((nr / len) * Math.cos(phi), ny / len, (nr / len) * Math.sin(phi));
      out.uvs.push(j / segments, i / Math.max(1, profile.length - 1));
    }
  });
  out.grid(profile.length, segments + 1, 0);
  return out.build();
}

/** Meshes joined into one. */
export function merge(parts: readonly MeshArrays[]): MeshArrays {
  const vertices = parts.reduce((n, p) => n + p.positions.length / 3, 0);
  const triangles = parts.reduce((n, p) => n + p.indices.length, 0);
  const out = {
    positions: new Float32Array(vertices * 3),
    normals: new Float32Array(vertices * 3),
    uvs: new Float32Array(vertices * 2),
    indices: new Uint32Array(triangles),
  };
  let v = 0;
  let t = 0;
  for (const p of parts) {
    out.positions.set(p.positions, v * 3);
    out.normals.set(p.normals, v * 3);
    out.uvs.set(p.uvs, v * 2);
    p.indices.forEach((index, k) => {
      out.indices[t + k] = index + v;
    });
    v += p.positions.length / 3;
    t += p.indices.length;
  }
  return out;
}

/** A trunk that flares at its foot and tapers to the crown, 2.2 m tall. */
export function treeTrunk(): MeshArrays {
  return lathe(
    [
      [0, 0],
      [0.26, 0],
      [0.16, 0.25],
      [0.12, 0.8],
      [0.1, 1.5],
      [0.08, 2.2],
      [0, 2.2],
    ],
    10,
  );
}

/** A rounded canopy: a main ellipsoid and three lobes, sitting on the trunk's top. */
export function treeCanopy(): MeshArrays {
  const lobe = (x: number, y: number, z: number, r: number): MeshArrays =>
    ellipsoid({ center: { x, y, z }, radii: { x: r, y: r * 0.85, z: r }, rings: 8, segments: 12 });
  return merge([
    lobe(0, 2.9, 0, 1.25),
    lobe(0.8, 2.5, 0.3, 0.8),
    lobe(-0.6, 2.6, 0.6, 0.85),
    lobe(-0.2, 3.5, -0.4, 0.75),
  ]);
}

/** A clipped hedge: a rounded loaf 2.2 m long, 1 m tall and 0.8 m through. */
export function hedgeBody(): MeshArrays {
  return ellipsoid({
    center: { x: 0, y: 0.45, z: 0 },
    radii: { x: 1.1, y: 0.55, z: 0.4 },
    rings: 10,
    segments: 16,
  });
}
