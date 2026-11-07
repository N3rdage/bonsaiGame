/**
 * Daily growth tick and the care actions that feed it: watering, fertilising,
 * repotting and the fertiliser-paid time skip.
 *
 * Ported from archive/gamemaker/scripts/scr_growth/scr_growth.gml.
 * Skipped: `advance_day_all_trees` (lives in world.ts, it needs scoring) and
 * `pot_palette` (rendering). `mesh_dirty = true` becomes `markDirty(tree)`.
 */

import { clamp } from './vec3';
import { inventoryHas, inventoryRemove } from './inventory';
import { seasonForDay, seasonGrowthMultiplier, seasonWaterMultiplier } from './seasons';
import { getSpecies } from './species';
import { addBranch, markDirty } from './tree';
import type { BonsaiTree, GameState, InventoryKey, PotTier, Rng, SoilTier } from './types';

/**
 * Vigor slowly falls as the pot ages; repotting resets it to 50. Floored so a
 * neglected tree goes sluggish (growth scales with vigor/50) but never freezes.
 * Time-based like ageDays, so it applies on isolated/skip ticks too.
 */
export const VIGOR_DRIFT_PER_DAY = 0.2;
export const VIGOR_FLOOR = 10;

/** Premium soil (soilTier 1) ages slower and softens water-stress penalties. */
export const PREMIUM_SOIL_DRIFT_MULT = 0.5;
export const PREMIUM_SOIL_STRESS_MULT = 0.5;

/** Minimum days between repots. */
export const REPOT_COOLDOWN_DAYS = 60;

/** Natural branch spawning stops once a tree has this many branches. */
export const MAX_NATURAL_BRANCHES = 15;

/** A fertiliser dose lasts this many days and multiplies growth by FERTILIZER_MULT. */
export const FERTILIZER_DAYS = 7;
export const FERTILIZER_MULT = 1.5;

/** GML random_range(a, b) over a [0, 1) source. */
function randomRange(rng: Rng, a: number, b: number): number {
  return a + rng() * (b - a);
}

/**
 * Advance one tree by one day. `isolated` ticks (time skip) skip water decay.
 * Uses `state.day` for the fertiliser window and the season.
 */
export function treeDailyTick(
  tree: BonsaiTree,
  state: GameState,
  isolated = false,
  rng: Rng = Math.random,
): void {
  const species = getSpecies(tree.speciesKey);
  const season = seasonForDay(state.day);
  tree.ageDays++;

  const driftMult = tree.soilTier === 1 ? PREMIUM_SOIL_DRIFT_MULT : 1;
  tree.vigor = Math.max(VIGOR_FLOOR, tree.vigor - VIGOR_DRIFT_PER_DAY * driftMult);

  if (!isolated) {
    // Water pulls harder in summer, barely in winter.
    tree.waterLevel = Math.max(
      0,
      tree.waterLevel - species.waterNeed * 5 * seasonWaterMultiplier(season),
    );
  }

  const stressMult = tree.soilTier === 1 ? PREMIUM_SOIL_STRESS_MULT : 1;
  if (tree.waterLevel < 10) tree.vitality -= 2 * stressMult;
  else if (tree.waterLevel > 90) tree.vitality -= 1 * stressMult;
  else tree.vitality = Math.min(100, tree.vitality + 0.3);
  tree.vitality = clamp(tree.vitality, 0, 100);

  // 0 = dormant (no morphology change this tick).
  let growthMult =
    (tree.vitality / 100) *
    (tree.vigor / 50) *
    species.growthRate *
    seasonGrowthMultiplier(species.seasonsActive, season);
  if (state.day < tree.fertilizedUntilDay) growthMult *= FERTILIZER_MULT;

  if (tree.trunk.heightCm < species.maxTrunkCm) {
    tree.trunk.heightCm += 0.02 * growthMult;
  }
  tree.trunk.girthMm += 0.05 * growthMult;

  for (const branch of tree.branches) {
    branch.length += 0.1 * growthMult;
    branch.girth += 0.01 * growthMult;
  }

  // rng is drawn before the branch-count check, matching GML evaluation order.
  if (rng() < 0.1 * growthMult && tree.branches.length < MAX_NATURAL_BRANCHES) {
    spawnBranchNaturally(tree, rng);
  }

  tree.foliageDensity = clamp(tree.foliageDensity + 0.01 * growthMult, 0, 1);
  markDirty(tree);
}

/** Add a trunk branch at a height/angle that spreads branches up and around. */
export function spawnBranchNaturally(tree: BonsaiTree, rng: Rng = Math.random): void {
  const count = tree.branches.length;
  const trunkH = tree.trunk.heightCm;

  let targetT = 0.3 + count * 0.08 + randomRange(rng, -0.05, 0.05);
  targetT = clamp(targetT, 0.2, 0.95);
  const y = targetT * trunkH;

  let baseAngle = count % 2 === 0 ? 0 : 180;
  if (count > 2 && count % 3 === 2) baseAngle = 90;

  const angle = baseAngle + randomRange(rng, -30, 30);
  const length = randomRange(rng, 2, 4);

  addBranch(tree, -1, y, angle, length);
}

export function waterTree(tree: BonsaiTree, state: GameState): void {
  tree.waterLevel = 100;
  tree.lastWateredDay = state.day;
}

/**
 * Consume 1 fertiliser for a FERTILIZER_DAYS-day growth window. Refuses
 * (without consuming) when the species is dormant this season, or when there
 * is no fertiliser.
 */
export function fertilizeTree(tree: BonsaiTree, state: GameState): boolean {
  const species = getSpecies(tree.speciesKey);
  if (seasonGrowthMultiplier(species.seasonsActive, seasonForDay(state.day)) <= 0) return false;
  if (!inventoryRemove(state.inventory, 'fertilizer', 1)) return false;
  tree.fertilizedUntilDay = state.day + FERTILIZER_DAYS;
  tree.lastFedDay = state.day;
  return true;
}

export type RepotStatus = 'ok' | 'out_of_season' | 'cooldown';

/** Whether the tree can be repotted now: spring only, REPOT_COOLDOWN_DAYS apart. */
export function repotCheck(tree: BonsaiTree, state: GameState): RepotStatus {
  if (seasonForDay(state.day) !== 'spring') return 'out_of_season';
  if (state.day - tree.lastRepotDay < REPOT_COOLDOWN_DAYS) return 'cooldown';
  return 'ok';
}

/**
 * Repot into a pot of `newTier`, optionally with premium soil. The single
 * mutation site for pot tier. Premium soil silently downgrades to basic if
 * none is in stock; the pot is checked before anything is consumed.
 */
export function repotTree(
  tree: BonsaiTree,
  state: GameState,
  newTier: PotTier,
  soilTier: SoilTier = 0,
): boolean {
  if (repotCheck(tree, state) !== 'ok') return false;
  const potKey: InventoryKey = newTier === 1 ? 'fancy_pot' : 'pot';
  let soil: SoilTier = soilTier;
  if (soil === 1 && !inventoryHas(state.inventory, 'soil_premium', 1)) soil = 0;
  if (!inventoryHas(state.inventory, potKey, 1)) return false;
  inventoryRemove(state.inventory, potKey, 1);
  if (soil === 1) inventoryRemove(state.inventory, 'soil_premium', 1);

  tree.potTier = newTier;
  tree.soilTier = soil;
  tree.vigor = 50; // baseline reset; no full-100 boost
  tree.lastRepotDay = state.day;
  tree.repotsHistory.push({ day: state.day, toTier: newTier, soilTier: soil });
  markDirty(tree);
  return true;
}

/**
 * Spend fertiliser to fast-forward one tree by `days` isolated ticks (no water
 * decay; the world day does not advance). Cost max(1, ceil(days * 0.5)).
 */
export function skipTreeTime(
  tree: BonsaiTree,
  state: GameState,
  days: number,
  rng: Rng = Math.random,
): boolean {
  const cost = Math.max(1, Math.ceil(days * 0.5));
  if (!inventoryRemove(state.inventory, 'fertilizer', cost)) return false;
  for (let i = 0; i < days; i++) {
    treeDailyTick(tree, state, true, rng);
  }
  return true;
}
