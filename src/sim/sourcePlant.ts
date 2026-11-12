/**
 * Taking a cutting from a garden source plant, ported from
 * archive/gamemaker/objects/obj_source_plant/Create_0.gml (`on_interact`),
 * and taking seeds from it in autumn (backlog #93: the prototype had none),
 * under the same per-visit limit and recovery as cuttings.
 *
 * The plant's counters are not part of the game state: the prototype's
 * source plants were room instances, created afresh on every room entry, so
 * the counters reset whenever the player leaves the garden and comes back.
 */

import { inventoryAdd, inventoryCount } from './inventory';
import { DAYS_PER_SEASON, SEASONS, seasonForDay, type Season } from './seasons';
import { getSpecies } from './species';
import { TUTORIAL_TAKE_CUTTING, tutorialAdvanceIf } from './tutorial';
import type { GameState, InventoryKey, SpeciesKey } from './types';

/** Create_0: `max_cuttings = 3`. */
export const MAX_CUTTINGS = 3;
/** Days a plant recovers after its third cutting ("2 weeks to regrow"). */
export const REGROW_DAYS = 14;

/** Seasons a cutting can be taken in (TODO 2e-a). */
export const CUTTING_SEASONS: readonly Season[] = ['spring', 'summer'];

/**
 * First day of the next spring strictly after `day`, on the 1-based calendar
 * of `seasonForDay` (day 0 and below count as day 1).
 */
export function nextCuttingSeasonDay(day: number): number {
  return nextSeasonStart(day, 'spring');
}

/** Seasons seeds can be taken in. */
export const SEED_SEASONS: readonly Season[] = ['autumn'];

/** First day of the next autumn strictly after `day`, on the same calendar as `nextCuttingSeasonDay`. */
export function nextSeedSeasonDay(day: number): number {
  return nextSeasonStart(day, 'autumn');
}

/** First day of the next `season` strictly after `day` (day 0 and below count as day 1). */
function nextSeasonStart(day: number, season: Season): number {
  const yearLength = DAYS_PER_SEASON * SEASONS.length;
  const offset = SEASONS.indexOf(season) * DAYS_PER_SEASON;
  const d = Math.max(1, Math.floor(day));
  return (Math.floor((d - 1 - offset) / yearLength) + 1) * yearLength + offset + 1;
}

/** What E does at a source plant on `day`: seeds in autumn, otherwise a cutting (so winter's refusal names the next spring). */
export function sourcePlantAction(day: number): 'cutting' | 'seed' {
  return SEED_SEASONS.includes(seasonForDay(day)) ? 'seed' : 'cutting';
}

/** The source plant's prompt on `day`. */
export function sourcePlantPrompt(day: number): string {
  return sourcePlantAction(day) === 'seed' ? 'Take Seeds' : 'Take Cutting';
}

/** One source plant's per-visit counters. */
export interface SourcePlantState {
  cuttingsTaken: number;
  /** Day it offers cuttings again; -1 is ready now. */
  regrowDay: number;
}

export function createSourcePlant(): SourcePlantState {
  return { cuttingsTaken: 0, regrowDay: -1 };
}

/** The inventory key a species' cutting goes to (`"cutting_" + species_key`); pine has none. */
export const CUTTING_KEYS: Partial<Record<SpeciesKey, InventoryKey>> = {
  juniper: 'cutting_juniper',
  maple: 'cutting_maple',
};

/** The inventory key of each species' seed (`"seed_" + species_key`); every species grows from seed. */
export const SEED_KEYS: Readonly<Record<SpeciesKey, InventoryKey>> = {
  juniper: 'seed_juniper',
  maple: 'seed_maple',
  pine: 'seed_pine',
};

/**
 * Takes a cutting from `plant` of `speciesKey` and returns the toast: refused
 * while the plant recovers, when the species does not grow from cuttings or
 * outside `CUTTING_SEASONS`, in that order; otherwise one cutting to the
 * inventory, the tutorial's Take a cutting step, and on the third cutting 14
 * days of recovery.
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
  if (!CUTTING_SEASONS.includes(seasonForDay(state.day))) {
    return `Cuttings are taken in spring or summer - try again on day ${String(nextCuttingSeasonDay(state.day))}`;
  }
  tutorialAdvanceIf(state, TUTORIAL_TAKE_CUTTING);
  return take(state, plant, key, `${species.displayName} cutting`);
}

/**
 * Takes seeds from `plant` of `speciesKey` and returns the toast: refused
 * while the plant recovers or outside `SEED_SEASONS`; otherwise one seed to
 * the inventory, counted against the same `MAX_CUTTINGS` and recovery as
 * cuttings. The tutorial's Take a cutting step is not advanced.
 */
export function takeSeeds(
  state: GameState,
  plant: SourcePlantState,
  speciesKey: SpeciesKey,
): string {
  if (plant.regrowDay > state.day) {
    return `This plant is recovering - ready on day ${String(plant.regrowDay)}`;
  }
  if (!SEED_SEASONS.includes(seasonForDay(state.day))) {
    return `Seeds are taken in autumn - try again on day ${String(nextSeedSeasonDay(state.day))}`;
  }
  const key = SEED_KEYS[speciesKey];
  return take(state, plant, key, `${getSpecies(speciesKey).displayName} seed`);
}

/** One `key` to the inventory and the toast; the third take starts the plant's recovery. */
function take(state: GameState, plant: SourcePlantState, key: InventoryKey, what: string): string {
  inventoryAdd(state.inventory, key);
  plant.cuttingsTaken += 1;
  const msg = `Took a ${what}  (${String(inventoryCount(state.inventory, key))} in inventory)`;
  if (plant.cuttingsTaken < MAX_CUTTINGS) return msg;
  plant.regrowDay = state.day + REGROW_DAYS;
  plant.cuttingsTaken = 0;
  return `${msg} - plant now recovering`;
}
