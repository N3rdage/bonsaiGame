/**
 * Taking a cutting from a garden source plant, ported from
 * archive/gamemaker/objects/obj_source_plant/Create_0.gml (`on_interact`).
 *
 * The plant's counters are not part of the game state: the prototype's
 * source plants were room instances, created afresh on every room entry, so
 * the counters reset whenever the player leaves the garden and comes back.
 */

import { inventoryAdd, inventoryCount } from './inventory';
import { getSpecies } from './species';
import { TUTORIAL_TAKE_CUTTING, tutorialAdvanceIf } from './tutorial';
import type { GameState, InventoryKey, SpeciesKey } from './types';

/** Create_0: `max_cuttings = 3`. */
export const MAX_CUTTINGS = 3;
/** Days a plant recovers after its third cutting ("2 weeks to regrow"). */
export const REGROW_DAYS = 14;

/** One source plant's per-visit counters. */
export interface SourcePlantState {
  cuttingsTaken: number;
  /** Day it offers cuttings again; -1 is ready now. */
  regrowDay: number;
}

export function createSourcePlant(): SourcePlantState {
  return { cuttingsTaken: 0, regrowDay: -1 };
}

/** The inventory key a species' cutting goes to (`"cutting_" + species_key`). */
const CUTTING_KEYS: Partial<Record<SpeciesKey, InventoryKey>> = {
  juniper: 'cutting_juniper',
  maple: 'cutting_maple',
};

/**
 * Takes a cutting from `plant` of `speciesKey` and returns the toast: refused
 * while the plant recovers or when the species does not grow from cuttings;
 * otherwise one cutting to the inventory, the tutorial's Take a cutting step,
 * and on the third cutting 14 days of recovery.
 */
export function takeCutting(
  state: GameState,
  plant: SourcePlantState,
  speciesKey: SpeciesKey,
): string {
  if (plant.regrowDay > state.day) {
    return `This plant is recovering - ready on day ${String(plant.regrowDay)}`;
  }
  const species = getSpecies(speciesKey);
  const key = CUTTING_KEYS[speciesKey];
  if (!species.propagation.includes('cutting') || key === undefined) {
    return `${species.displayName} can't be grown from cuttings - try seeds`;
  }
  inventoryAdd(state.inventory, key);
  tutorialAdvanceIf(state, TUTORIAL_TAKE_CUTTING);
  plant.cuttingsTaken += 1;
  const msg = `Took a ${species.displayName} cutting  (${String(inventoryCount(state.inventory, key))} in inventory)`;
  if (plant.cuttingsTaken < MAX_CUTTINGS) return msg;
  plant.regrowDay = state.day + REGROW_DAYS;
  plant.cuttingsTaken = 0;
  return `${msg} - plant now recovering`;
}
