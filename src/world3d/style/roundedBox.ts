/**
 * A box with rounded edges and corners as plain arrays: the shape the
 * finished look builds furniture from, so the toon ramp rolls light over its
 * edges and the ink outline, which pushes the surface out along its normals,
 * stays closed at the corners (a sharp box's split normals tear it open).
 * Pure; y up, centred on the origin. UVs are box-projected in metres.
 */

export interface ShapeData {
  readonly positions: number[];
  readonly normals: number[];
  readonly uvs: number[];
  readonly indices: number[];
}

/** Coordinates along one axis of half-extent `h`, crowded into the rounded band of radius `r` at each end. */
function axisStops(h: number, r: number, bands: number): number[] {
  const inner = Math.max(h - r, 0);
  const out: number[] = [];
  for (let k = bands; k >= 1; k--) out.push(-inner - r * Math.tan(((Math.PI / 4) * k) / bands));
  out.push(-inner);
  if (inner > 0) out.push(inner);
  for (let k = 1; k <= bands; k++) out.push(inner + r * Math.tan(((Math.PI / 4) * k) / bands));
  return out;
}

/** A `w` x `h` x `d` box (x, y, z) whose edges are rounded to `r`, each round in `bands` steps. */
export function roundedBox(
  w: number,
  h: number,
  d: number,
  r: number,
  bands = 3,
  flip = true,
): ShapeData {
  const half = [w / 2, h / 2, d / 2];
  const rad = Math.min(r, ...half);
  const inner = half.map((v) => Math.max(v - rad, 0));
  const stops = half.map((v) => axisStops(v, rad, bands));
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  // Each face: the axis it faces along, its sign, and the two axes across it.
  const faces: [number, number, number, number][] = [
    [0, 1, 2, 1],
    [0, -1, 1, 2],
    [1, 1, 0, 2],
    [1, -1, 2, 0],
    [2, 1, 1, 0],
    [2, -1, 0, 1],
  ];
  for (const [axis, sign, ua, va] of faces) {
    const us = stops[ua] ?? [];
    const vs = stops[va] ?? [];
    const first = positions.length / 3;
    for (const v of vs) {
      for (const u of us) {
        const p = [0, 0, 0];
        p[axis] = sign * (half[axis] ?? 0);
        p[ua] = u;
        p[va] = v;
        const c = p.map((x, i) => Math.max(-(inner[i] ?? 0), Math.min(inner[i] ?? 0, x)));
        const n = p.map((x, i) => x - (c[i] ?? 0));
        const len = Math.hypot(...n) || 1;
        const q = n.map((x, i) => (c[i] ?? 0) + (rad * x) / len);
        positions.push(...q);
        normals.push(...n.map((x) => x / len));
        // Box projection: the face's two across axes in metres.
        uvs.push(q[ua] ?? 0, q[va] ?? 0);
      }
    }
    const nu = us.length;
    // cross(u, v) points along +axis when (u, v, axis) is a cyclic order of (x, y, z).
    const cyclic = (va - ua + 3) % 3 === 1 ? 1 : -1;
    const outward = cyclic * sign > 0 !== flip;
    for (let j = 0; j < vs.length - 1; j++) {
      for (let i = 0; i < nu - 1; i++) {
        const a = first + j * nu + i;
        const b = a + 1;
        const c = a + nu;
        const e = c + 1;
        if (outward) indices.push(a, b, c, b, e, c);
        else indices.push(a, c, b, b, c, e);
      }
    }
  }
  return { positions, normals, uvs, indices };
}
