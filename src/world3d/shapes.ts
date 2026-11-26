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

/** The steps each rounded edge is cut in: enough to roll the light, few enough to keep furniture light. */
export const ROUND_BANDS = 2;

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
  bands = ROUND_BANDS,
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
export function roundedBox(
  w: number,
  h: number,
  d: number,
  r: number,
  bands = ROUND_BANDS,
): ShapeData {
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

/** The sides a cylinder or cone is cut in, and the bands of a ball: enough to read as round, few enough to keep furniture light. */
export const ROUND_SEGMENTS = 10;
export const BALL_STACKS = 5;

/** How far a cone's rim normals lean from the side's true normal toward the cap's: the cap's unit normal is added at this weight. */
export const RIM_LEAN = 0.5;

/** `n` scaled to unit length. */
function unit(n: Triple): Triple {
  const length = Math.hypot(...n);
  return [n[0] / length, n[1] / length, n[2] / length];
}

/** The angle of side `i` of `n`. */
function theta(i: number, n: number): number {
  return (2 * Math.PI * i) / n;
}

/** Collects a round shape's vertices one at a time, each normal scaled to unit length, uvs projected from above. */
function collector(): ShapeData & { add(p: Triple, n: Triple): number } {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  return {
    positions,
    normals,
    uvs,
    indices: [],
    add(p, n) {
      positions.push(...p);
      normals.push(...unit(n));
      uvs.push(p[0], p[2]);
      return positions.length / 3 - 1;
    },
  };
}

/** The vertices of `cone(w, h, d, segments, taper)`, without building it. */
export function coneVertexCount(segments = ROUND_SEGMENTS, taper = 0): number {
  return taper > 0 ? 2 * segments + 2 : segments + 2;
}

/**
 * A cone of base `w` x `d` and height `h` (y up, centred on the origin) whose
 * top ring is `taper` times as wide as its base: a frustum, a point at 0 and a
 * cylinder at 1. The base and top caps are fans that share their rings with
 * the side, so the ink outline stays closed at the rims: a rim's normal is the
 * side's true normal there plus `RIM_LEAN` of the cap's.
 */
export function cone(
  w: number,
  h: number,
  d: number,
  segments = ROUND_SEGMENTS,
  taper = 0,
): ShapeData {
  if (!(taper >= 0 && taper <= 1))
    throw new RangeError(`a taper runs 0 to 1, got ${String(taper)}`);
  const [a, c] = [w / 2, d / 2];
  const shape = collector();
  // The side is (a r cos, y, c r sin), r falling from 1 to `taper` over the
  // height, so its normal is (cos / a, (1 - taper) / h, sin / c).
  const ring = (y: number, scale: number, cap: number): number[] =>
    Array.from({ length: segments }, (_, i) => {
      const [x, z] = [Math.cos(theta(i, segments)), Math.sin(theta(i, segments))];
      const side = unit([x / a, (1 - taper) / h, z / c]);
      return shape.add(
        [a * scale * x, y, c * scale * z],
        [side[0], side[1] + RIM_LEAN * cap, side[2]],
      );
    });
  const base = ring(-h / 2, 1, -1);
  const top = taper > 0 ? ring(h / 2, taper, 1) : [shape.add([0, h / 2, 0], [0, 1, 0])];
  const middle = shape.add([0, -h / 2, 0], [0, -1, 0]);
  const cap = taper > 0 ? shape.add([0, h / 2, 0], [0, 1, 0]) : 0;
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    const [b0, b1] = [base[i] ?? 0, base[j] ?? 0];
    shape.indices.push(middle, b1, b0);
    if (taper > 0) {
      const [t0, t1] = [top[i] ?? 0, top[j] ?? 0];
      shape.indices.push(b0, b1, t0, b1, t1, t0, cap, t0, t1);
    } else {
      shape.indices.push(b0, b1, top[0] ?? 0);
    }
  }
  return {
    positions: shape.positions,
    normals: shape.normals,
    uvs: shape.uvs,
    indices: shape.indices,
  };
}

/** The vertices of `cylinder(w, h, d, segments)`, without building it. */
export function cylinderVertexCount(segments = ROUND_SEGMENTS): number {
  return coneVertexCount(segments, 1);
}

/** A cylinder of width `w`, depth `d` and height `h` (y up, centred on the origin): a `cone` as wide at the top as at the base. */
export function cylinder(w: number, h: number, d: number, segments = ROUND_SEGMENTS): ShapeData {
  return cone(w, h, d, segments, 1);
}

/** The vertices of `ball(w, h, d, segments, stacks)`, without building it: a ring for each band between the poles, and the two poles. */
export function ballVertexCount(segments = ROUND_SEGMENTS, stacks = BALL_STACKS): number {
  return segments * (stacks - 1) + 2;
}

/** An ellipsoid of width `w`, height `h` and depth `d` (y up, centred on the origin), cut in `stacks` bands of `segments` sides. */
export function ball(
  w: number,
  h: number,
  d: number,
  segments = ROUND_SEGMENTS,
  stacks = BALL_STACKS,
): ShapeData {
  const [a, b, c] = [w / 2, h / 2, d / 2];
  const shape = collector();
  const south = shape.add([0, -b, 0], [0, -1, 0]);
  const rings = Array.from({ length: stacks - 1 }, (_, s) => {
    const latitude = -Math.PI / 2 + (Math.PI * (s + 1)) / stacks;
    return Array.from({ length: segments }, (_, i) => {
      const [x, y, z] = [
        Math.cos(latitude) * Math.cos(theta(i, segments)),
        Math.sin(latitude),
        Math.cos(latitude) * Math.sin(theta(i, segments)),
      ];
      // The surface is (a x, b y, c z) for the unit sphere's (x, y, z), so its normal is (x / a, y / b, z / c).
      return shape.add([a * x, b * y, c * z], [x / a, y / b, z / c]);
    });
  });
  const north = shape.add([0, b, 0], [0, 1, 0]);
  const first = rings[0] ?? [];
  const last = rings[rings.length - 1] ?? [];
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    shape.indices.push(south, first[j] ?? 0, first[i] ?? 0, north, last[i] ?? 0, last[j] ?? 0);
  }
  for (let s = 0; s + 1 < rings.length; s++) {
    const [p, q] = [rings[s] ?? [], rings[s + 1] ?? []];
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      shape.indices.push(p[i] ?? 0, p[j] ?? 0, q[i] ?? 0, p[j] ?? 0, q[j] ?? 0, q[i] ?? 0);
    }
  }
  return {
    positions: shape.positions,
    normals: shape.normals,
    uvs: shape.uvs,
    indices: shape.indices,
  };
}
