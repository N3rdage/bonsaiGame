/**
 * Shared data model for the simulation. Plain data only: everything here is
 * JSON-serialisable and has no methods, so it can be saved, loaded, diffed and
 * unit-tested without any rendering code. Behaviour lives in the sibling
 * modules (growth, training, scoring, ...), which take these values as inputs.
 *
 * Units are real: trunk height in cm, girth in mm, branch length in cm.
 * Scaling to display units happens in geometry.ts / the viewer only.
 *
 * Ported from archive/gamemaker/scripts/scr_bonsai_struct and the globals it
 * relied on (global.game_day, global.money, global.inventory, global.all_trees).
 */

import type { Season } from './seasons';

export type SpeciesKey = 'juniper' | 'maple' | 'pine';

export type StyleKey =
  'formal_upright' | 'informal_upright' | 'slanting' | 'cascade' | 'broom' | 'windswept';

export type Origin = 'cutting' | 'seed';

/** 0 = standard terracotta, 1 = fancy glazed (1.25x display revenue). */
export type PotTier = 0 | 1;

/** 0 = basic, 1 = premium akadama (slower vigor drift, softer water stress). */
export type SoilTier = 0 | 1;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A sampled point on a curve with its parallel-transported basis. */
export interface Frame {
  pos: Vec3;
  tangent: Vec3;
  normal: Vec3;
  binormal: Vec3;
}

/** One trunk-wire bend event: at height `y` cm, deflect toward `angleDeg`. */
export interface TrunkMovement {
  y: number;
  angleDeg: number;
}

export interface Trunk {
  heightCm: number;
  girthMm: number;
  /** 0..1, fraction of base girth lost by the apex. */
  taper: number;
  movement: TrunkMovement[];
}

export interface Branch {
  /** Index in `tree.branches`; renumbered on prune. */
  id: number;
  /** -1 for trunk-attached (the only case so far). */
  parentId: number;
  /** Attachment height up the trunk, cm. */
  originY: number;
  /** Attachment angle around the trunk, degrees. */
  angle: number;
  /** cm */
  length: number;
  /** mm-ish, used for wire safety and rendering. */
  girth: number;
  wired: boolean;
  /** Horizontal sweep, degrees, around world +z. */
  bend: number;
  /** Vertical sweep, degrees, around the horizontal axis perpendicular to the initial direction. */
  bendV: number;
}

export interface WireRecord {
  branchId: number;
  appliedDay: number;
  /** -1 while still on the branch. */
  removedDay: number;
  bendTarget: number;
  bendTargetV: number;
}

export interface ClipRecord {
  branchId: number;
  day: number;
  amount: number;
}

export interface PruneRecord {
  branchId: number;
  day: number;
}

export interface RepotRecord {
  day: number;
  toTier: PotTier;
  soilTier: SoilTier;
}

/**
 * The tree. `location` is a tagged string, not an enum: a room name
 * ("shed", "garden"), "inventory", "sold" (soft-deleted, kept for history), or
 * "displayed:<pedestalKey>". See tree.ts for the helpers that read it.
 *
 * `revision` replaces the prototype's mesh_dirty flag: every morphology
 * mutation increments it, and renderers rebuild when it changes.
 */
export interface BonsaiTree {
  id: number;
  speciesKey: SpeciesKey;
  origin: Origin;
  name: string;

  ageDays: number;
  /** 0..100 */
  vitality: number;
  /** 0..100, growth speed; drifts down, reset to 50 by repotting. */
  vigor: number;
  /** 0..100 */
  waterLevel: number;
  lastWateredDay: number;
  lastFedDay: number;
  /** gameDay < this => 1.5x growth. */
  fertilizedUntilDay: number;
  potTier: PotTier;
  soilTier: SoilTier;
  lastRepotDay: number;
  location: string;
  timeAccel: number;

  trunk: Trunk;
  branches: Branch[];
  /** 0..1 */
  foliageDensity: number;

  wiresApplied: WireRecord[];
  clipsHistory: ClipRecord[];
  prunesHistory: PruneRecord[];
  repotsHistory: RepotRecord[];

  styleTags: string[];
  /** '' = no target. Feeds the style-conformance score criterion. */
  targetStyle: StyleKey | '';

  revision: number;
}

export interface Species {
  key: SpeciesKey;
  displayName: string;
  growthRate: number;
  waterNeed: number;
  /** CSS hex, e.g. '#4a6741'. Fallback when a season has no entry. */
  leafColor: string;
  leafShape: 'needle' | 'palmate';
  maxTrunkCm: number;
  suitableStyles: StyleKey[];
  propagation: Origin[];
  seasonsActive: Season[];
  /** CSS hex per season; `undefined` means drop foliage entirely (deciduous winter-bare). */
  seasonal: Record<Season, string | undefined>;
}

export interface Style {
  key: StyleKey;
  displayName: string;
  description: string;
  /** 0..1 conformance of the tree to this style. */
  score: (tree: BonsaiTree) => number;
}

export type InventoryKey =
  | 'clay'
  | 'pot'
  | 'fancy_pot'
  | 'soil_premium'
  | 'wire'
  | 'fertilizer'
  | 'seed_juniper'
  | 'seed_maple'
  | 'cutting_juniper'
  | 'cutting_maple';

export type Inventory = Record<InventoryKey, number>;

/**
 * Everything the prototype kept in globals. Simulation functions take this
 * explicitly instead of reaching for a global, which is what makes them
 * testable. Functions mutate it in place, mirroring the prototype.
 */
export interface GameState {
  /** Game day. A new game starts at 0, as in the prototype; `seasonForDay` treats 0 as day 1. */
  day: number;
  money: number;
  inventory: Inventory;
  trees: BonsaiTree[];
  nextTreeId: number;
  /** See tutorial.ts; TUTORIAL_DONE (-1) when finished or skipped. */
  tutorialStep: number;
  /**
   * The prototype's `global.game_paused`: true while the 3D viewer is open, and
   * `advanceDayAllTrees` does nothing while it is. Transient, never persisted.
   */
  paused: boolean;
}

/** Random source in [0, 1). Defaults to Math.random; tests pass a seeded one. */
export type Rng = () => number;

export interface ScoreCriterion {
  label: string;
  /** 0..1 */
  value: number;
  weight: number;
  /** Contribution to the 0..100 total. */
  points: number;
  isMultiplier: boolean;
}

export interface TreeScore {
  /** 0..100, floored. */
  total: number;
  breakdown: ScoreCriterion[];
}
