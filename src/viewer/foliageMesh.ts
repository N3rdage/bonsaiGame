/**
 * Foliage clusters as flat textured triangle-list arrays. Pure: no three.js
 * import, so it is unit-tested in Node.
 *
 * Ported from `add_foliage_cluster`, `_add_quad_xz`, `_add_quad_yz` and the
 * foliage gate at the end of `build_branch` in
 * archive/gamemaker/scripts/scr_bonsai_mesh/scr_bonsai_mesh.gml. Each leaf is
 * two crossed quads textured with the foliage sprite and tinted by the
 * species' seasonal colour through the vertex colour. The season is an input:
 * nothing here reads a day counter.
 */

import type { BonsaiTree, Branch, Vec3 } from '../sim/types';
import { DISPLAY_SCALE, branchPoint } from '../sim/geometry';
import type { Season } from '../sim/seasons';
import { getSpecies, speciesSeasonalColor } from '../sim/species';
import { clamp } from '../sim/vec3';
import { TriangleList, type MeshArrays } from './meshArrays';
import type { Rgb } from './potPalette';
import { seededRandom } from './seededRandom';

/** Branches whose origin sits at or below this fraction of trunk height carry no foliage. */
export const FOLIAGE_MIN_ORIGIN_FRACTION = 0.3;
/** Leaves per cluster: floor(base + density * per-density). */
export const LEAF_COUNT_BASE = 4;
export const LEAF_COUNT_PER_DENSITY = 6;
/** Leaf half-size in display units: (base + density * per-density) * DISPLAY_SCALE. */
export const LEAF_SIZE_BASE = 0.008;
export const LEAF_SIZE_PER_DENSITY = 0.006;
/** Horizontal leaf scatter around the branch tip; vertical is half this. */
export const LEAF_SPREAD = 0.025 * DISPLAY_SCALE;
/** Two crossed quads of two triangles each. */
export const VERTICES_PER_LEAF = 12;

/** Parses a `#rrggbb` colour into 0..255 channels. */
export function hexToRgb(hex: string): Rgb {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m?.[1] || !m[2] || !m[3]) throw new Error(`not a #rrggbb colour: ${hex}`);
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

export function leafCount(density: number): number {
  return Math.floor(LEAF_COUNT_BASE + density * LEAF_COUNT_PER_DENSITY);
}

export function leafHalfSize(density: number): number {
  return (LEAF_SIZE_BASE + density * LEAF_SIZE_PER_DENSITY) * DISPLAY_SCALE;
}

/** The `build_branch` gate: only branches starting above 30% of trunk height leaf out. */
export function branchCarriesFoliage(tree: BonsaiTree, branch: Branch): boolean {
  return clamp(branch.originY / tree.trunk.heightCm, 0, 1) > FOLIAGE_MIN_ORIGIN_FRACTION;
}

/** Stable per-branch seed, so rebuilds never reroll the leaves (the prototype's jitter fix). */
export function foliageSeed(tree: BonsaiTree, branch: Branch): number {
  return tree.id * 1000 + branch.id;
}

const UV = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 0],
  [1, 1],
  [0, 1],
] as const;

function addQuad(list: TriangleList, corners: readonly [Vec3, Vec3, Vec3, Vec3], c: Rgb): void {
  const [p1, p2, p3, p4] = corners;
  [p1, p2, p3, p1, p3, p4].forEach((p, i) => {
    const [u, v] = UV[i] ?? [0, 0];
    list.vertex(p, c, u, v);
  });
}

/** One leaf: `_add_quad_xz` then `_add_quad_yz` around `c` with half-size `s`. */
export function addLeaf(list: TriangleList, c: Vec3, s: number, col: Rgb): void {
  addQuad(
    list,
    [
      { x: c.x - s, y: c.y, z: c.z - s },
      { x: c.x + s, y: c.y, z: c.z - s },
      { x: c.x + s, y: c.y, z: c.z + s },
      { x: c.x - s, y: c.y, z: c.z + s },
    ],
    col,
  );
  addQuad(
    list,
    [
      { x: c.x, y: c.y - s, z: c.z - s },
      { x: c.x, y: c.y + s, z: c.z - s },
      { x: c.x, y: c.y + s, z: c.z + s },
      { x: c.x, y: c.y - s, z: c.z + s },
    ],
    col,
  );
}

/** `add_foliage_cluster`: a seeded scatter of leaves around `centre`. */
export function addFoliageCluster(
  list: TriangleList,
  centre: Vec3,
  col: Rgb,
  density: number,
  seed: number,
): void {
  const rng = seededRandom(seed);
  const count = leafCount(density);
  const size = leafHalfSize(density);
  for (let i = 0; i < count; i++) {
    const ox = rng.range(-LEAF_SPREAD, LEAF_SPREAD);
    const oy = rng.range(-LEAF_SPREAD, LEAF_SPREAD);
    const oz = rng.range(-LEAF_SPREAD * 0.5, LEAF_SPREAD * 0.5);
    addLeaf(list, { x: centre.x + ox, y: centre.y + oy, z: centre.z + oz }, size, col);
  }
}

/** Every branch's foliage cluster for `season`; empty when the species is bare that season. */
export function buildFoliageMesh(tree: BonsaiTree, season: Season): MeshArrays {
  const list = new TriangleList();
  const hex = speciesSeasonalColor(getSpecies(tree.speciesKey), season);
  if (hex === undefined) return list.build();
  const col = hexToRgb(hex);
  for (const branch of tree.branches) {
    if (!branchCarriesFoliage(tree, branch)) continue;
    const tip = branchPoint(tree, branch, 1);
    addFoliageCluster(list, tip, col, tree.foliageDensity, foliageSeed(tree, branch));
  }
  return list.build();
}
