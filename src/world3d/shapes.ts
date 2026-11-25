/**
 * A box with rounded edges and corners as plain arrays: the shape furniture is
 * built from, so the toon ramp rolls light over its edges and the ink outline,
 * which pushes the surface out along its normals, stays closed at the corners
 * (a sharp box's split normals tear it open). Pure, with no Babylon import.
 *
 * The frame is Babylon's, as `CreateBox` gives it: centred on the origin, y up,
 * `w` along x, `h` along y and `d` along z. Triangles are wound as `CreateBox`
 * winds them, which is Babylon's front face (left-handed): the right-handed
 * cross product of a triangle's edges points into the box.
 */

export interface ShapeData {
  readonly positions: number[];
  readonly normals: number[];
  /** Box-projected: each face's two across axes in metres. */
  readonly uvs: number[];
  readonly indices: number[];
}

type Axis = 0 | 1 | 2;
type Triple = [number, number, number];

/** Each face: the axis it faces along, its sign, and the two axes across it (u, then v). */
const FACES: readonly (readonly [Axis, 1 | -1, Axis, Axis])[] = [
  [0, 1, 2, 1],
  [0, -1, 1, 2],
  [1, 1, 0, 2],
  [1, -1, 2, 0],
  [2, 1, 1, 0],
  [2, -1, 0, 1],
];

/** The half-extents of a `w` x `h` x `d` box and the radius `r` clamped to the smallest of them. */
function dimensions(
  w: number,
  h: number,
  d: number,
  r: number,
): { half: Triple; radius: number; inner: Triple } {
  if (!(r > 0)) throw new RangeError(`a rounded box needs a radius above 0, got ${String(r)}`);
  const half: Triple = [w / 2, h / 2, d / 2];
  const radius = Math.min(r, ...half);
  const inner: Triple = [half[0] - radius, half[1] - radius, half[2] - radius];
  return { half, radius, inner };
}

/** Coordinates along one axis of half-extent `half`, crowded into the rounded band of radius `r` at each end. */
function axisStops(half: number, r: number, bands: number): number[] {
  const inner = half - r;
  const stops: number[] = [];
  for (let k = bands; k >= 1; k--) stops.push(-inner - r * Math.tan(((Math.PI / 4) * k) / bands));
  stops.push(-inner);
  if (inner > 0) stops.push(inner);
  for (let k = 1; k <= bands; k++) stops.push(inner + r * Math.tan(((Math.PI / 4) * k) / bands));
  return stops;
}

/** The vertices of `roundedBox(w, h, d, r, bands)`, without building it. */
export function roundedBoxVertexCount(
  w: number,
  h: number,
  d: number,
  r: number,
  bands = 2,
): number {
  const { half, radius } = dimensions(w, h, d, r);
  const [nx, ny, nz] = half.map((v) => axisStops(v, radius, bands).length) as Triple;
  return 2 * (nx * ny + nx * nz + ny * nz);
}

/**
 * A `w` x `h` x `d` box whose edges are rounded to `r` (clamped to the
 * smallest half-extent), each round in `bands` steps. Faces share no vertices,
 * but where two meet their vertices coincide with equal normals, so shading is
 * smooth over the edge.
 */
export function roundedBox(w: number, h: number, d: number, r: number, bands = 2): ShapeData {
  const { half, radius, inner } = dimensions(w, h, d, r);
  const stops = half.map((v) => axisStops(v, radius, bands));
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const [axis, sign, ua, va] of FACES) {
    const us = stops[ua] ?? [];
    const vs = stops[va] ?? [];
    const first = positions.length / 3;
    for (const v of vs) {
      for (const u of us) {
        const p: Triple = [0, 0, 0];
        p[axis] = sign * half[axis];
        p[ua] = u;
        p[va] = v;
        // The nearest point of the inner box, and the direction out of it.
        const c = p.map((x, i) => Math.max(-inner[i as Axis], Math.min(inner[i as Axis], x)));
        const n = p.map((x, i) => x - (c[i] ?? 0));
        const length = Math.hypot(...n);
        const unit = n.map((x) => x / length);
        const q = c.map((x, i) => x + radius * (unit[i] ?? 0));
        positions.push(...q);
        normals.push(...unit);
        uvs.push(q[ua] ?? 0, q[va] ?? 0);
      }
    }
    const row = us.length;
    // (u, v, axis) is a right-handed order when `cyclic` is 1, so cross(u, v) then points along `sign`.
    const cyclic = (va - ua + 3) % 3 === 1 ? 1 : -1;
    const reversed = cyclic * sign > 0;
    for (let j = 0; j < vs.length - 1; j++) {
      for (let i = 0; i < row - 1; i++) {
        const a = first + j * row + i;
        const b = a + 1;
        const c = a + row;
        const e = c + 1;
        if (reversed) indices.push(a, c, b, b, c, e);
        else indices.push(a, b, c, b, e, c);
      }
    }
  }
  return { positions, normals, uvs, indices };
}
