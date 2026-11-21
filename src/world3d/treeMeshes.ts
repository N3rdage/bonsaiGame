/**
 * A tree's meshes for the 3D world, as pure data: the tree viewer's own
 * builders (src/viewer: the pot, the trunk and branches, the foliage) bring
 * the shape, and `worldMeshData` puts their arrays in the world's frame and
 * scale for Babylon. There is no second tree model: a tree is the same
 * triangles here as in the viewer.
 */

import { DISPLAY_SCALE } from '../sim/geometry';
import type { Season } from '../sim/seasons';
import type { BonsaiTree } from '../sim/types';
import { buildFoliageMesh } from '../viewer/foliageMesh';
import type { MeshArrays } from '../viewer/meshArrays';
import { buildPotGeometry } from '../viewer/potGeometry';
import { bothWindings } from '../viewer/toon';
import { buildTreeMesh } from '../viewer/treeMesh';

/** A mesh in Babylon's frame (y up) and metres, ready for `VertexData`. */
export interface WorldMeshData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  /** RGBA, alpha 1; sRGB as the palette gives it. */
  readonly colors: Float32Array;
  /** Each triangle in both windings, so it draws from both sides with its normal as built (as the viewer does). */
  readonly indices: Uint32Array;
}

/**
 * The viewer's arrays (display units, z up, `DISPLAY_SCALE` of them to the
 * metre, soil at z 0) in Babylon's: metres, y up, raised by `lift` display
 * units. The viewer is right-handed
 * and Babylon left-handed, so swapping y and z (a reflection) keeps the tree
 * looking as it does there, not mirrored.
 */
export function worldMeshData({ positions, normals, colors }: MeshArrays, lift = 0): WorldMeshData {
  const count = positions.length / 3;
  const world = new Float32Array(positions.length);
  const worldNormals = new Float32Array(normals.length);
  const rgba = new Float32Array(count * 4);
  for (let v = 0; v < count; v += 1) {
    const [x = 0, y = 0, z = 0] = positions.subarray(v * 3, v * 3 + 3);
    world.set([x / DISPLAY_SCALE, (z + lift) / DISPLAY_SCALE, y / DISPLAY_SCALE], v * 3);
    const [nx = 0, ny = 0, nz = 0] = normals.subarray(v * 3, v * 3 + 3);
    worldNormals.set([nx, nz, ny], v * 3);
    rgba.set([...colors.subarray(v * 3, v * 3 + 3), 1], v * 4);
  }
  return {
    positions: world,
    normals: worldNormals,
    colors: rgba,
    indices: bothWindings(count),
  };
}

export type TreePart = 'pot' | 'trunk' | 'foliage';

/** The lowest z of a mesh, display units; 0 for an empty one. */
function lowestZ({ positions }: MeshArrays): number {
  let low = Infinity;
  for (let i = 2; i < positions.length; i += 3) low = Math.min(low, positions[i] ?? 0);
  return Number.isFinite(low) ? low : 0;
}

/**
 * The parts a tree is drawn in, each its viewer mesh; foliage is left out when
 * the species is bare in `season`. The viewer puts the soil at z 0 with the pot
 * below it, so every part is lifted by the depth of the pot (feet included):
 * the lowest point of the pot is y 0, the surface it stands on, and the tree
 * stays in its pot.
 */
export function treeMeshData(
  tree: BonsaiTree,
  season: Season,
): { readonly part: TreePart; readonly data: WorldMeshData }[] {
  const pot = buildPotGeometry(tree.potTier);
  const lift = -lowestZ(pot);
  const parts: [TreePart, MeshArrays][] = [
    ['pot', pot],
    ['trunk', buildTreeMesh(tree)],
    ['foliage', buildFoliageMesh(tree, season)],
  ];
  return parts
    .filter(([, arrays]) => arrays.positions.length > 0)
    .map(([part, arrays]) => ({ part, data: worldMeshData(arrays, lift) }));
}
