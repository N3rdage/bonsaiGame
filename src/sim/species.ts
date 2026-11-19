/**
 * Species are data, not code. Trees store only the species key and look the
 * rest up here. Each species carries a per-season foliage colour table; a
 * season mapped to `undefined` means "drop foliage entirely" (deciduous
 * winter-bare). `leafColor` is the fallback for callers that don't know about
 * seasons. `look` carries the bark colours and leaf shape the renderers draw.
 * Every colour is an Inked wash, the `WASHES` entry in art/inked/style.mjs
 * named beside it (this module stays pure, so it keeps the hex).
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
    leafColor: '#589654', // foliage
    // Warm brown bark; the prototype's leaf shape.
    look: {
      trunkBark: '#8c5e42', // barkJuniper
      branchBark: '#9e6e4e', // barkJuniperBranch
      spriteTrunk: '#8c5e42', // barkJuniper
      leafAspect: 1,
      leafSizeScale: 1,
      leafCountScale: 1,
    },
    maxTrunkCm: 45,
    suitableStyles: ['informal_upright', 'cascade', 'windswept'],
    propagation: ['cutting', 'seed'],
    seasonsActive: ['spring', 'summer', 'autumn'],
    seasonal: {
      spring: '#7cac60', // juniperSpring: fresh-growth brighter green
      summer: '#589654', // foliage: mature green (default)
      autumn: '#589654', // foliage: evergreen, no shift
      winter: '#867c52', // juniperWinter: muted bronze, cold-stress tint
    },
  },
  maple: {
    key: 'maple',
    displayName: 'Japanese Maple',
    growthRate: 1.2,
    waterNeed: 1.2,
    leafColor: '#d25a28', // leafRed
    // Smooth grey bark; fewer, larger, broad palmate leaves.
    look: {
      trunkBark: '#969288', // barkMaple
      branchBark: '#a6a296', // barkMapleBranch
      spriteTrunk: '#969288', // barkMaple
      leafAspect: 1.6,
      leafSizeScale: 1.3,
      leafCountScale: 0.8,
    },
    maxTrunkCm: 60,
    suitableStyles: ['informal_upright', 'broom'],
    propagation: ['seed'],
    seasonsActive: ['spring', 'summer', 'autumn'],
    seasonal: {
      spring: '#9cb454', // mapleSpring: fresh chartreuse new leaves
      summer: '#467e46', // mapleSummer: deep mature green
      autumn: '#d25a28', // leafRed: iconic fiery red (matches leafColor)
      winter: undefined, // deciduous, drop foliage entirely
    },
  },
  pine: {
    key: 'pine',
    displayName: 'Pine',
    growthRate: 0.7,
    waterNeed: 0.6,
    leafColor: '#508068', // pineSummer
    // Dark red-brown plated bark; many tall, narrow needle tufts.
    look: {
      trunkBark: '#704a3a', // barkPine
      branchBark: '#805844', // barkPineBranch
      spriteTrunk: '#704a3a', // barkPine
      leafAspect: 0.35,
      leafSizeScale: 1.1,
      leafCountScale: 1.6,
    },
    maxTrunkCm: 50,
    suitableStyles: ['formal_upright', 'informal_upright', 'windswept'],
    propagation: ['seed'],
    seasonsActive: ['spring', 'summer', 'autumn', 'winter'],
    seasonal: {
      spring: '#70a47c', // pineSpring: new candles, lighter
      summer: '#508068', // pineSummer: mature cool green (default)
      autumn: '#508068', // pineSummer
      winter: '#40685a', // pineWinter: slightly darker cool tone
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
