/**
 * The furniture the 3D world draws from a ready-made pack, as pure data: seven
 * KayKit Furniture Bits models (CC0, Kay Lousberg, src/world3d/furniture/),
 * each a .glb of one mesh whose feet stand on y 0. `packGeometry` centres the
 * mesh over the footprint, turns it to face the way the piece does and scales
 * it to the piece's own `size` in metres (footprint and drawn height), so a
 * kind's nominal size is the piece's and its instance scale is 1, as for the
 * code-made kinds; the ink outline,
 * which Babylon offsets in model space, is then as thick as theirs. The
 * model's top lands on the piece's height, which is where a displayed tree
 * stands (trees.ts). Nothing here imports Babylon; `packGeometry` turns the
 * file's accessors into the arrays the renderer draws.
 */

import { accessorFloats, accessorIndices, type Glb } from './glb';

/** The kinds of furniture drawn from a pack model. */
export type PackKind =
  'side_table' | 'desk' | 'low_bookcase' | 'sofa' | 'armchair' | 'coffee_table' | 'floor_lamp';

/** The way a model's front faces in the plan: south, toward the camera, as the file has it, or turned a quarter to the east or the west. */
export type Facing = 'south' | 'east' | 'west';

/** A box's east-west, north-south and vertical size in metres. */
export interface Extent {
  readonly w: number;
  readonly d: number;
  readonly h: number;
}

/** A pack model: its file in src/world3d/furniture/, the extent of its mesh in the file's metres, the size the piece is drawn at and the vertices it draws. */
export interface PackModel {
  readonly file: string;
  /** Extent of the model's bounds, as in the file's POSITION accessor: `w` along the file's x, `d` along its z, before it is turned. */
  readonly extent: Extent;
  /** The way the piece faces; the file's own front is south. */
  readonly faces: Facing;
  /** The piece's footprint (`w` east-west, `d` north-south, once turned) and drawn height in metres, which `packGeometry` scales the mesh to. */
  readonly size: Extent;
  readonly vertices: number;
  /** For a seat: the top of its cushion over the feet in the file's own units, where a sitter's hips rest. */
  readonly seat?: number;
}

/**
 * The model of each kind, the closest of the pack to the piece's footprint and height, with the
 * file's size in metres (width x height x depth) beside the piece's:
 * the lounge's side table (0.5 m square, 0.375 m) is the 1 m cube of `table_small`; the
 * study's desk (1.0 x 0.5 m, 0.65 m) is `table_medium_long`, a 3 x 2 m table; the low
 * bookcase (1.5 x 0.5 m, 0.5625 m) is `cabinet_medium`, a 2 x 1 x 1 m cabinet, the one
 * floor piece of the pack with a flat top wide enough for it and doors for a front; the
 * sofa (0.875 x 1.875 m, 0.9375 m) is `couch`, 3 x 1.224 x 1.6 m, turned to face east; the
 * armchair (0.75 m square, 0.9375 m) is `armchair`, 1.8 x 1.224 x 1.6 m, turned to face west;
 * the coffee table (0.625 x 1 m, 0.375 m) is `table_low`, 2.4 x 0.5 x 1.5 m, turned a quarter
 * so its long side runs north-south and drawn at three quarters of its height; the floor
 * lamp (0.4375 m square, 1.5 m) is `lamp_standing`, 1 x 2.52 x 1 m. The tall bookcase stays
 * code-made: the pack's `shelf_*` models are 2 x 0.4 x 0.5 m wall planks that start below the
 * floor and have no body to stand on it.
 */
export const PACK_MODELS: Readonly<Record<PackKind, PackModel>> = {
  side_table: {
    file: 'table_small.glb',
    extent: { w: 1, d: 1, h: 1 },
    faces: 'south',
    size: { w: 0.5, d: 0.5, h: 0.375 },
    vertices: 260,
  },
  desk: {
    file: 'table_medium_long.glb',
    extent: { w: 3, d: 2, h: 1 },
    faces: 'south',
    size: { w: 1, d: 0.5, h: 0.65 },
    vertices: 260,
  },
  low_bookcase: {
    file: 'cabinet_medium.glb',
    extent: { w: 2, d: 1.00156, h: 1 },
    faces: 'south',
    size: { w: 1.5, d: 0.5, h: 0.5625 },
    vertices: 648,
  },
  sofa: {
    file: 'couch.glb',
    extent: { w: 3, d: 1.6, h: 1.22406 },
    faces: 'east',
    size: { w: 0.875, d: 1.875, h: 0.9375 },
    vertices: 550,
    seat: 0.5,
  },
  armchair: {
    file: 'armchair.glb',
    extent: { w: 1.8, d: 1.6, h: 1.22406 },
    faces: 'west',
    size: { w: 0.75, d: 0.75, h: 0.9375 },
    vertices: 442,
    seat: 0.5,
  },
  coffee_table: {
    file: 'table_low.glb',
    extent: { w: 2.4, d: 1.5, h: 0.5 },
    faces: 'east',
    size: { w: 0.625, d: 1, h: 0.375 },
    vertices: 336,
  },
  floor_lamp: {
    file: 'lamp_standing.glb',
    extent: { w: 1, d: 1, h: 2.52 },
    faces: 'south',
    size: { w: 0.4375, d: 0.4375, h: 1.5 },
    vertices: 304,
  },
};

/** The height of a seat's cushion over the floor as the piece is drawn, metres: the model's `seat`, scaled to the piece's height. */
export function seatHeight(model: PackModel): number {
  if (model.seat === undefined) throw new Error(`${model.file} is not a seat`);
  return (model.seat * model.size.h) / model.extent.h;
}

/** Whether `kind` is drawn from a pack model. */
export function isPackKind(kind: string): kind is PackKind {
  return kind in PACK_MODELS;
}

/** A model's mesh in Babylon's frame (left-handed, y up), ready for a vertex buffer. */
export interface PackGeometry {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
}

/**
 * The first primitive of `glb`'s first mesh as Babylon draws it. glTF's frame is right-handed
 * with the model's front on +z, which is the plan's south, toward a camera in the south. The
 * mesh is centred over its footprint, turned about the vertical to the model's `faces` (a
 * quarter turn to the east takes the file's front, +z, to +x; to the west, to -x) and scaled
 * per axis from its extent to the model's `size`; normals take the turn and the inverse
 * transpose of the scale, renormalised. Negating z turns the plan's frame into Babylon's, with
 * the front on -z; the mirror turns glTF's counter-clockwise front faces into Babylon's
 * clockwise ones, so the indices are kept. Texture coordinates start at the image's top in
 * both, so they are kept.
 */
export function packGeometry(glb: Glb, model: PackModel): PackGeometry {
  const primitive = glb.json.meshes?.[0]?.primitives[0];
  if (primitive?.indices === undefined) throw new Error('the model has no mesh');
  const { POSITION, NORMAL, TEXCOORD_0 } = primitive.attributes;
  if (POSITION === undefined || NORMAL === undefined || TEXCOORD_0 === undefined) {
    throw new Error('the model lacks positions, normals or texture coordinates');
  }
  const positions = accessorFloats(glb, POSITION);
  const normals = accessorFloats(glb, NORMAL);
  const { extent, size, faces } = model;
  const quarter = faces !== 'south';
  const [sx, sy, sd] = [
    size.w / (quarter ? extent.d : extent.w),
    size.h / extent.h,
    size.d / (quarter ? extent.w : extent.d),
  ];
  const middle = (k: number): number => {
    const values = positions.filter((_, i) => i % 3 === k);
    return (Math.min(...values) + Math.max(...values)) / 2;
  };
  const [mx, mz] = [middle(0), middle(2)];
  // The file's (x, z) as the plan's (x, y): turned about the vertical to face `faces`.
  const turn = (x: number, z: number): [number, number] =>
    faces === 'east' ? [z, -x] : faces === 'west' ? [-z, x] : [x, z];
  for (let i = 0; i < positions.length; i += 3) {
    const [px, py] = turn((positions[i] ?? 0) - mx, (positions[i + 2] ?? 0) - mz);
    const [nx, nz] = turn(normals[i] ?? 0, normals[i + 2] ?? 0);
    const n = [nx / sx, (normals[i + 1] ?? 0) / sy, -nz / sd];
    const length = Math.hypot(...n) || 1;
    positions[i] = px * sx;
    positions[i + 1] = (positions[i + 1] ?? 0) * sy;
    positions[i + 2] = -py * sd;
    for (let k = 0; k < 3; k++) normals[i + k] = (n[k] ?? 0) / length;
  }
  return {
    positions,
    normals,
    uvs: accessorFloats(glb, TEXCOORD_0),
    indices: accessorIndices(glb, primitive.indices),
  };
}
