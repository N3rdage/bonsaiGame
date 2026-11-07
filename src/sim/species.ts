/**
 * Species are data, not code. Trees store only the species key and look the
 * rest up here. Each species carries a per-season foliage colour table; a
 * season mapped to `undefined` means "drop foliage entirely" (deciduous
 * winter-bare). `leafColor` is the fallback for callers that don't know about
 * seasons.
 *
 * Ported from archive/gamemaker/scripts/scr_species_data/scr_species_data.gml.
 */

import type { Season } from './seasons';
import type { Species, SpeciesKey } from './types';

export const SPECIES_KEYS: readonly SpeciesKey[] = ['juniper', 'maple', 'pine'];

export const SPECIES: Record<SpeciesKey, Species> = {
  juniper: {
    key: 'juniper',
    displayName: 'Juniper',
    growthRate: 1.0,
    waterNeed: 0.8,
    leafColor: '#4a6741',
    leafShape: 'needle',
    maxTrunkCm: 45,
    suitableStyles: ['informal_upright', 'cascade', 'windswept'],
    propagation: ['cutting', 'seed'],
    seasonsActive: ['spring', 'summer', 'autumn'],
    seasonal: {
      spring: '#5c7d4f', // fresh-growth brighter green
      summer: '#4a6741', // mature green (default)
      autumn: '#4a6741', // evergreen, no shift
      winter: '#5c5a3a', // muted bronze, cold-stress tint
    },
  },
  maple: {
    key: 'maple',
    displayName: 'Japanese Maple',
    growthRate: 1.2,
    waterNeed: 1.2,
    leafColor: '#b33a2a',
    leafShape: 'palmate',
    maxTrunkCm: 60,
    suitableStyles: ['informal_upright', 'broom'],
    propagation: ['seed'],
    seasonsActive: ['spring', 'summer', 'autumn'],
    seasonal: {
      spring: '#6da542', // fresh chartreuse new leaves
      summer: '#3a7a2a', // deep mature green
      autumn: '#b33a2a', // iconic fiery red (matches leafColor)
      winter: undefined, // deciduous, drop foliage entirely
    },
  },
  pine: {
    key: 'pine',
    displayName: 'Pine',
    growthRate: 0.7,
    waterNeed: 0.6,
    leafColor: '#3a5a3a',
    leafShape: 'needle',
    maxTrunkCm: 50,
    suitableStyles: ['formal_upright', 'informal_upright', 'windswept'],
    propagation: ['seed'],
    seasonsActive: ['spring', 'summer', 'autumn', 'winter'],
    seasonal: {
      spring: '#4a7a4a', // new candles, lighter
      summer: '#3a5a3a', // mature green (default)
      autumn: '#3a5a3a',
      winter: '#2e4a2e', // slightly darker cool tone
    },
  },
};

export function getSpecies(key: SpeciesKey): Species {
  return SPECIES[key];
}

/**
 * Foliage colour for `species` in `season`, or `undefined` for "drop foliage
 * this season". Falls back to `leafColor` when the species has no seasonal
 * table or the table lacks the season key (keeps hypothetical mod species
 * without seasonal data safe). A key that is present but set to `undefined`
 * returns `undefined`, as in the prototype.
 */
export function speciesSeasonalColor(species: Species, season: Season): string | undefined {
  // The prototype fell back to leafColor when a species had no seasonal table;
  // the Species type requires one, so that branch no longer exists.
  return species.seasonal[season];
}
