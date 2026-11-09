/**
 * Making pots and planting cuttings, ported from
 * archive/gamemaker/objects/obj_workbench/Create_0.gml (`on_interact`) and
 * archive/gamemaker/objects/obj_ui_plant_cutting/Create_0.gml (`do_plant`).
 */

import { inventoryAdd, inventoryCount, inventoryHas, inventoryRemove } from './inventory';
import { CUTTING_KEYS } from './sourcePlant';
import { getSpecies } from './species';
import { spawnTree } from './tree';
import { TUTORIAL_PLANT, tutorialAdvanceIf } from './tutorial';
import type { BonsaiTree, GameState, SpeciesKey } from './types';

/** Where a planted cutting stands: the planting table's room. */
export const PLANTED_LOCATION = 'shed';

/** The workbench: one clay into one pot, and the toast (two spaces, as in the GML). */
export function makePot(state: GameState): string {
  if (!inventoryRemove(state.inventory, 'clay', 1)) return 'Not enough clay to make a pot';
  inventoryAdd(state.inventory, 'pot', 1);
  const pots = String(inventoryCount(state.inventory, 'pot'));
  const clay = String(inventoryCount(state.inventory, 'clay'));
  return `Made a pot  (${pots} pots, ${clay} clay left)`;
}

/**
 * `do_plant`: refuses (undefined, nothing consumed) without the pot kind or
 * the cutting; otherwise uses one pot (fancy when asked), the cutting, and
 * premium soil only when asked and in stock, and adds `New <Display name>`
 * to the shed, advancing the tutorial's Plant step.
 */
export function plantCutting(
  state: GameState,
  speciesKey: SpeciesKey,
  useFancyPot: boolean,
  usePremiumSoil: boolean,
): BonsaiTree | undefined {
  const potKey = useFancyPot ? 'fancy_pot' : 'pot';
  const cuttingKey = CUTTING_KEYS[speciesKey];
  if (!inventoryHas(state.inventory, potKey, 1)) return undefined;
  if (cuttingKey === undefined || !inventoryHas(state.inventory, cuttingKey, 1)) return undefined;
  const useSoil = usePremiumSoil && inventoryHas(state.inventory, 'soil_premium', 1);

  inventoryRemove(state.inventory, potKey, 1);
  inventoryRemove(state.inventory, cuttingKey, 1);
  if (useSoil) inventoryRemove(state.inventory, 'soil_premium', 1);

  const tree = spawnTree(state, speciesKey, 'cutting');
  tree.name = `New ${getSpecies(speciesKey).displayName}`;
  tree.potTier = useFancyPot ? 1 : 0;
  tree.soilTier = useSoil ? 1 : 0;
  tree.location = PLANTED_LOCATION;
  state.trees.push(tree);
  tutorialAdvanceIf(state, TUTORIAL_PLANT);
  return tree;
}
