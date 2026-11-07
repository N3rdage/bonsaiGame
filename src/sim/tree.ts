/**
 * The BonsaiTree constructor and its small helpers, as plain functions over
 * the `BonsaiTree` data in types.ts. `revision` replaces the prototype's
 * `mesh_dirty` flag: every morphology mutation increments it.
 *
 * Ported from archive/gamemaker/scripts/scr_bonsai_struct/scr_bonsai_struct.gml.
 * Skipped: `get_mesh` / `mesh_cache` (rendering) and the unused `in_pot` field
 * (always `undefined` in the prototype, never read). `get_species` lives in
 * species.ts as `getSpecies(tree.speciesKey)`.
 */

import type { BonsaiTree, GameState, Origin, SpeciesKey } from './types';

export const DISPLAYED_PREFIX = 'displayed:';

/** Build a tree with the prototype's defaults and origin-specific morphology. */
export function createTree(speciesKey: SpeciesKey, origin: Origin, id: number): BonsaiTree {
  // Cuttings come with a small existing structure; seeds start bare.
  const cutting = origin === 'cutting';
  const tree: BonsaiTree = {
    id,
    speciesKey,
    origin,
    name: '',

    ageDays: 0,
    vitality: 100,
    vigor: 50,
    waterLevel: 50,
    lastWateredDay: 0,
    lastFedDay: 0,
    fertilizedUntilDay: 0,
    potTier: 0,
    soilTier: 0,
    lastRepotDay: 0,
    location: 'inventory',
    timeAccel: 1.0,

    trunk: {
      heightCm: cutting ? 8 : 2,
      girthMm: cutting ? 4 : 1.5,
      taper: 0.7,
      movement: [],
    },
    branches: [],
    foliageDensity: cutting ? 0.25 : 0.1,

    wiresApplied: [],
    clipsHistory: [],
    prunesHistory: [],
    repotsHistory: [],

    styleTags: [],
    targetStyle: '',

    revision: 0,
  };

  if (cutting) {
    addBranch(tree, -1, 3, 45, 3);
    addBranch(tree, -1, 5, 225, 2.5);
  }

  return tree;
}

/**
 * Create a tree with the next id from `state` (post-increment, like
 * `global.next_tree_id++`). Does NOT push it into `state.trees`: callers do
 * that, as in the prototype.
 */
export function spawnTree(state: GameState, speciesKey: SpeciesKey, origin: Origin): BonsaiTree {
  const id = state.nextTreeId++;
  return createTree(speciesKey, origin, id);
}

/** Append a branch and return its id (its index in `tree.branches`). */
export function addBranch(
  tree: BonsaiTree,
  parentId: number,
  yCm: number,
  angleDeg: number,
  lengthCm: number,
): number {
  const id = tree.branches.length;
  tree.branches.push({
    id,
    parentId,
    originY: yCm,
    angle: angleDeg,
    length: lengthCm,
    girth: Math.max(2, lengthCm * 0.3),
    wired: false,
    bend: 0, // horizontal sweep (degrees, around world +z)
    bendV: 0, // vertical sweep (degrees, around horizontal axis perpendicular to initial direction)
  });
  tree.revision++;
  return id;
}

export function markDirty(tree: BonsaiTree): void {
  tree.revision++;
}

export function needsWater(tree: BonsaiTree): boolean {
  return tree.waterLevel < 30;
}

export function isDisplayed(tree: BonsaiTree): boolean {
  return tree.location.startsWith(DISPLAYED_PREFIX);
}

/** The pedestal key for a displayed tree, or `undefined` if not displayed. */
export function displayedPedestalKey(tree: BonsaiTree): string | undefined {
  return isDisplayed(tree) ? tree.location.slice(DISPLAYED_PREFIX.length) : undefined;
}

export function isSold(tree: BonsaiTree): boolean {
  return tree.location === 'sold';
}
