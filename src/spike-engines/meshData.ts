/**
 * The scene's boxes as triangle arrays in the render frame (scene.ts
 * `toRender`: x east, y up, z south, right-handed), batched so an engine
 * uploads a handful of buffers, not one per box (backlog #378). Pure: both
 * engine pages draw exactly these triangles, so their draw calls and triangle
 * counts compare like for like.
 *
 * Per batch an engine draws the fill (`fill`, toon-lit, textured by its
 * material), the ink hull (`hull`, the front garden spike's outline: the same
 * box with each vertex's normal along its corner's diagonal, ink.ts
 * `cornerNormals`) and the crease lines (`edges`, line-segment pairs).
 */

import { cornerNormals } from './ink';
import type { MaterialKey, OccluderKey, SceneBox, SiteVec, SpikeScene } from './scene';

/** Triangles: 3 floats per vertex position and normal, 2 per uv, and a triangle list of indices. */
export interface MeshArrays {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
}

/** Faces as [normal, u axis, v axis] in the render frame, u x v = normal, so each quad winds counter-clockwise seen from outside. */
const FACES: readonly (readonly [SiteVec, SiteVec, SiteVec])[] = [
  [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: -1 },
    { x: 0, y: 1, z: 0 },
  ],
  [
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 1, z: 0 },
  ],
  [
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: -1 },
  ],
  [
    { x: 0, y: -1, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
  ],
  [
    { x: 0, y: 0, z: 1 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  ],
  [
    { x: 0, y: 0, z: -1 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  ],
];

const dot = (a: SiteVec, b: SiteVec): number => a.x * b.x + a.y * b.y + a.z * b.z;

class Builder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly indices: number[] = [];

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  vertex(p: SiteVec, n: SiteVec, u: number, v: number): void {
    this.positions.push(p.x, p.y, p.z);
    this.normals.push(n.x, n.y, n.z);
    this.uvs.push(u, v);
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

/** The box's centre and half sizes in the render frame, and its tilt about x as a rotation of the render frame's y and z. */
function frame(b: SceneBox): { c: SiteVec; h: SiteVec; turn: (p: SiteVec) => SiteVec } {
  const c = { x: (b.x0 + b.x1) / 2, y: (b.z0 + b.z1) / 2, z: (b.y0 + b.y1) / 2 };
  const h = { x: (b.x1 - b.x0) / 2, y: (b.z1 - b.z0) / 2, z: (b.y1 - b.y0) / 2 };
  // scene.ts `blockCorners`: a positive tilt raises the south (+z here) end.
  const t = b.tilt ?? 0;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const turn = (p: SiteVec): SiteVec => ({
    x: p.x,
    y: p.y * cos + p.z * sin,
    z: -p.y * sin + p.z * cos,
  });
  return { c, h, turn };
}

/**
 * One box's 24 vertices (4 a face, so each face keeps its own normal and uv),
 * the uvs laid in world metres over `tile` so neighbouring boxes' tiles line
 * up. With `hull`, each vertex's normal is its corner's diagonal instead.
 */
function addBox(out: Builder, b: SceneBox, tile: { u: number; v: number }, hull: boolean): void {
  const { c, h, turn } = frame(b);
  for (const [n, u, v] of FACES) {
    const base = out.vertexCount;
    for (const [su, sv] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      // The corner's offset from the centre, before the tilt.
      const signed = {
        x: (n.x + su * u.x + sv * v.x) * h.x,
        y: (n.y + su * u.y + sv * v.y) * h.y,
        z: (n.z + su * u.z + sv * v.z) * h.z,
      };
      const r = turn(signed);
      const p = { x: c.x + r.x, y: c.y + r.y, z: c.z + r.z };
      const world = { x: c.x + signed.x, y: c.y + signed.y, z: c.z + signed.z };
      const normal = hull ? turn(cornerNormal(signed)) : turn(n);
      out.vertex(p, normal, dot(world, u) / tile.u, dot(world, v) / tile.v);
    }
    out.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function cornerNormal(p: SiteVec): SiteVec {
  const [x = 0, y = 0, z = 0] = cornerNormals([p.x, p.y, p.z]);
  return { x, y, z };
}

/** The box's 12 edges as line-segment pairs (24 points, 72 floats). */
function addEdges(out: number[], b: SceneBox): void {
  const { c, h, turn } = frame(b);
  const corner = (sx: number, sy: number, sz: number): SiteVec => {
    const r = turn({ x: sx * h.x, y: sy * h.y, z: sz * h.z });
    return { x: c.x + r.x, y: c.y + r.y, z: c.z + r.z };
  };
  const push = (a: SiteVec, d: SiteVec): void => {
    out.push(a.x, a.y, a.z, d.x, d.y, d.z);
  };
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) {
      push(corner(-1, s, t), corner(1, s, t));
      push(corner(s, -1, t), corner(s, 1, t));
      push(corner(s, t, -1), corner(s, t, 1));
    }
  }
}

/** One material's boxes in one occluder (or none), lying on the ground or standing. */
export interface FillBatch {
  readonly material: MaterialKey;
  readonly occluder: OccluderKey | undefined;
  readonly ground: boolean;
  readonly mesh: MeshArrays;
}

/** One occluder's (or the unfading rest's) ink: its hull and its crease lines. */
export interface InkBatch {
  readonly occluder: OccluderKey | undefined;
  readonly hull: MeshArrays;
  readonly edges: Float32Array;
}

export interface SceneBatches {
  readonly fills: readonly FillBatch[];
  readonly inks: readonly InkBatch[];
}

/**
 * The scene's boxes batched: fills by material, occluder and ground, inks by
 * occluder, so an occluder fades by changing its own batches' opacity.
 * Ground boxes get no ink hull (it would only show as a rim round the lawn)
 * but keep their creases.
 */
export function sceneBatches(scene: SpikeScene): SceneBatches {
  const fills = new Map<string, { batch: Omit<FillBatch, 'mesh'>; out: Builder }>();
  const inks = new Map<
    string,
    { occluder: OccluderKey | undefined; hull: Builder; edges: number[] }
  >();
  for (const b of scene.boxes) {
    const fillKey = `${b.material}|${b.occluder ?? ''}|${String(b.ground)}`;
    let fill = fills.get(fillKey);
    if (!fill) {
      fill = {
        batch: { material: b.material, occluder: b.occluder, ground: b.ground },
        out: new Builder(),
      };
      fills.set(fillKey, fill);
    }
    addBox(fill.out, b, scene.materials[b.material].tile, false);

    const inkKey = b.occluder ?? '';
    let ink = inks.get(inkKey);
    if (!ink) {
      ink = { occluder: b.occluder, hull: new Builder(), edges: [] };
      inks.set(inkKey, ink);
    }
    if (!b.ground) addBox(ink.hull, b, { u: 1, v: 1 }, true);
    addEdges(ink.edges, b);
  }
  return {
    fills: [...fills.values()].map(({ batch, out }) => ({ ...batch, mesh: out.build() })),
    inks: [...inks.values()].map(({ occluder, hull, edges }) => ({
      occluder,
      hull: hull.build(),
      edges: new Float32Array(edges),
    })),
  };
}
