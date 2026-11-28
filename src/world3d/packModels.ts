/**
 * The furniture the 3D world draws from a ready-made pack, as pure data: three
 * KayKit Furniture Bits models (CC0, Kay Lousberg, src/world3d/furniture/),
 * each a .glb of one mesh whose feet stand on y 0 and which is centred over
 * the footprint. `packGeometry` scales the mesh to the piece's own `size` in
 * metres (footprint and drawn height), so a kind's nominal size is the piece's
 * and its instance scale is 1, as for the code-made kinds; the ink outline,
 * which Babylon offsets in model space, is then as thick as theirs. The
 * model's top lands on the piece's height, which is where a displayed tree
 * stands (trees.ts). Nothing here imports Babylon; `packGeometry` turns the
 * file's accessors into the arrays the renderer draws.
 */

import { accessorFloats, accessorIndices, type Glb } from './glb';

/** The kinds of furniture drawn from a pack model. */
export type PackKind = 'side_table' | 'desk' | 'low_bookcase';

/** A box's east-west, north-south and vertical size in metres. */
export interface Extent {
  readonly w: number;
  readonly d: number;
  readonly h: number;
}

/** A pack model: its file in src/world3d/furniture/, the extent of its mesh in the file's metres, the size the piece is drawn at and the vertices it draws. */
export interface PackModel {
  readonly file: string;
  /** Extent of the model's bounds, as in the file's POSITION accessor. */
  readonly extent: Extent;
  /** The piece's footprint and drawn height in metres, which `packGeometry` scales the mesh to. */
  readonly size: Extent;
  readonly vertices: number;
}

/**
 * The model of each kind, the closest of the pack to the piece's footprint and height:
 * the lounge's side table (0.5 m square, 0.375 m) is the 1 m cube of `table_small`; the
 * study's desk (1.0 x 0.5 m, 0.65 m) is `table_medium_long`, a 3 x 2 m table; the low
 * bookcase (1.5 x 0.5 m, 0.5625 m) is `cabinet_medium`, a 2 x 1 x 1 m cabinet, the one
 * floor piece of the pack with a flat top wide enough for it and doors for a front.
 */
export const PACK_MODELS: Readonly<Record<PackKind, PackModel>> = {
  side_table: {
    file: 'table_small.glb',
    extent: { w: 1, d: 1, h: 1 },
    size: { w: 0.5, d: 0.5, h: 0.375 },
    vertices: 260,
  },
  desk: {
    file: 'table_medium_long.glb',
    extent: { w: 3, d: 2, h: 1 },
    size: { w: 1, d: 0.5, h: 0.65 },
    vertices: 260,
  },
  low_bookcase: {
    file: 'cabinet_medium.glb',
    extent: { w: 2, d: 1.00156, h: 1 },
    size: { w: 1.5, d: 0.5, h: 0.5625 },
    vertices: 648,
  },
};

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
 * with the model's front on +z; negating z turns it into Babylon's, with the front on -z, toward
 * a camera in the south; the mirror turns glTF's counter-clockwise front faces into Babylon's
 * clockwise ones, so the indices are kept. Texture coordinates start at the image's top in
 * both, so they are kept. Positions are scaled from the file's extent to the model's `size`
 * per axis, and normals by the inverse transpose of that scale, renormalised.
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
  const { extent, size } = model;
  // Per axis x, y, z: the scale of positions; normals take its inverse.
  const scale = [size.w / extent.w, size.h / extent.h, size.d / extent.d];
  for (let i = 0; i < positions.length; i += 3) {
    const n = [0, 1, 2].map((k) => (normals[i + k] ?? 0) / (scale[k] ?? 1));
    const length = Math.hypot(...n) || 1;
    for (let k = 0; k < 3; k++) {
      const flip = k === 2 ? -1 : 1;
      positions[i + k] = (positions[i + k] ?? 0) * (scale[k] ?? 1) * flip;
      normals[i + k] = (flip * (n[k] ?? 0)) / length;
    }
  }
  return {
    positions,
    normals,
    uvs: accessorFloats(glb, TEXCOORD_0),
    indices: accessorIndices(glb, primitive.indices),
  };
}
