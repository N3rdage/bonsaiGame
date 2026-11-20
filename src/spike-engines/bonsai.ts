/**
 * The one real bonsai on the shed's pedestal (backlog #378): a tree made by
 * the simulation (the viewer's maple fixture, src/viewer/viewerFixtures.ts)
 * meshed by the 3D viewer's own pure builders (treeMesh.ts, foliageMesh.ts,
 * potGeometry.ts), untouched, then carried from the viewer's space into the
 * scene's. Pure and engine-neutral.
 *
 * The viewer's space is z-up display units (DISPLAY_SCALE a metre) with the
 * soil at z 0, drawn mirrored in y (TreeViewer.ts). Site metres are x east, y
 * south, z up, and `toRender` swaps y and z, a mirror itself, so a viewer
 * point lands at `origin + p / DISPLAY_SCALE` in site metres and comes out
 * mirrored exactly as the viewer draws it. Real size: a 20 cm maple.
 */

import { DISPLAY_SCALE } from '../sim/geometry';
import type { Season } from '../sim/seasons';
import type { BonsaiTree } from '../sim/types';
import { buildFoliageMesh } from '../viewer/foliageMesh';
import type { MeshArrays as ViewerArrays } from '../viewer/meshArrays';
import { buildPotGeometry } from '../viewer/potGeometry';
import { bothWindings } from '../viewer/toon';
import { buildTreeMesh } from '../viewer/treeMesh';
import { VIEWER_FIXTURES } from '../viewer/viewerFixtures';
import type { SiteVec, SpikeScene } from './scene';

/** The season the foliage is shown in. */
export const TREE_SEASON: Season = 'summer';

/** A viewer mesh in the render frame: positions and normals moved, colours and uvs as built, indexed in both windings (toon.ts `bothWindings`). */
export interface TreeMesh {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
}

export interface BonsaiMeshes {
  readonly tree: BonsaiTree;
  /** The pot, vertex-coloured. */
  readonly pot: TreeMesh;
  /** Trunk and branches: vertex colour over the viewer's bark texture (src/viewer/bark.png, mirrored repeat). */
  readonly bark: TreeMesh;
  /** Leaves: vertex colour over src/viewer/foliage.png, alpha-tested at 0.5. */
  readonly foliage: TreeMesh;
}

/** The lowest z in a viewer mesh, display units: the pot's feet. */
export function lowestZ(m: ViewerArrays): number {
  let low = Infinity;
  for (let i = 2; i < m.positions.length; i += 3) low = Math.min(low, m.positions[i] ?? Infinity);
  return low;
}

/** A viewer mesh at `origin` (site metres) in the render frame (x east, y up, z south). */
export function toRenderMesh(m: ViewerArrays, origin: SiteVec): TreeMesh {
  const n = m.positions.length;
  const positions = new Float32Array(n);
  const normals = new Float32Array(n);
  for (let i = 0; i < n; i += 3) {
    const x = m.positions[i] ?? 0;
    const y = m.positions[i + 1] ?? 0;
    const z = m.positions[i + 2] ?? 0;
    // Site (origin + p / S), then render: x, up, south.
    positions[i] = origin.x + x / DISPLAY_SCALE;
    positions[i + 1] = origin.z + z / DISPLAY_SCALE;
    positions[i + 2] = origin.y + y / DISPLAY_SCALE;
    normals[i] = m.normals[i] ?? 0;
    normals[i + 1] = m.normals[i + 2] ?? 0;
    normals[i + 2] = m.normals[i + 1] ?? 0;
  }
  return { positions, normals, colors: m.colors, uvs: m.uvs, indices: bothWindings(n / 3) };
}

/** The tree, its pot's feet on the pedestal's top. */
export function bonsaiMeshes(scene: SpikeScene): BonsaiMeshes {
  const tree = VIEWER_FIXTURES.maple();
  const pot = buildPotGeometry(tree.potTier);
  const origin = { ...scene.pedestal, z: scene.pedestal.z - lowestZ(pot) / DISPLAY_SCALE };
  return {
    tree,
    pot: toRenderMesh(pot, origin),
    bark: toRenderMesh(buildTreeMesh(tree), origin),
    foliage: toRenderMesh(buildFoliageMesh(tree, TREE_SEASON), origin),
  };
}
