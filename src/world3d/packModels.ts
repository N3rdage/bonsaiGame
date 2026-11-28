/**
 * The furniture the 3D world draws from a ready-made pack, as pure data: three
 * KayKit Furniture Bits models (CC0, Kay Lousberg, src/world3d/furniture/),
 * each a .glb of one mesh whose feet stand on y 0 and which is centred over
 * the footprint. A piece's kind (furnitureModels.ts) is drawn at the model's
 * own `size`, so the instance matrix that scales a kind's nominal size to its
 * footprint and height scales the model to them, and the model's top lands on
 * the piece's height, which is where a displayed tree stands (trees.ts).
 * Nothing here imports Babylon; `packGeometry` turns the file's accessors into
 * the arrays the renderer draws.
 */

import { accessorFloats, accessorIndices, type Glb } from './glb';

/** The kinds of furniture drawn from a pack model. */
export type PackKind = 'side_table' | 'desk' | 'low_bookcase';

/** A pack model: its file in src/world3d/furniture/, the extent of its mesh in the file's metres and the vertices it draws. */
export interface PackModel {
  readonly file: string;
  /** East-west, north-south and vertical extent of the model's bounds, as in the file's POSITION accessor. */
  readonly size: { readonly w: number; readonly d: number; readonly h: number };
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
  side_table: { file: 'table_small.glb', size: { w: 1, d: 1, h: 1 }, vertices: 260 },
  desk: { file: 'table_medium_long.glb', size: { w: 3, d: 2, h: 1 }, vertices: 260 },
  low_bookcase: { file: 'cabinet_medium.glb', size: { w: 2, d: 1.0016, h: 1 }, vertices: 648 },
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
 * both, so they are kept.
 */
export function packGeometry(glb: Glb): PackGeometry {
  const primitive = glb.json.meshes?.[0]?.primitives[0];
  if (primitive?.indices === undefined) throw new Error('the model has no mesh');
  const { POSITION, NORMAL, TEXCOORD_0 } = primitive.attributes;
  if (POSITION === undefined || NORMAL === undefined || TEXCOORD_0 === undefined) {
    throw new Error('the model lacks positions, normals or texture coordinates');
  }
  const positions = accessorFloats(glb, POSITION);
  const normals = accessorFloats(glb, NORMAL);
  for (let i = 2; i < positions.length; i += 3) {
    positions[i] = -(positions[i] ?? 0);
    normals[i] = -(normals[i] ?? 0);
  }
  return {
    positions,
    normals,
    uvs: accessorFloats(glb, TEXCOORD_0),
    indices: accessorIndices(glb, primitive.indices),
  };
}
