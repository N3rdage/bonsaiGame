import { describe, expect, it } from 'vitest';
import { inkedWashes } from '../testing/inkedWashes';
import { SPECIES, SPECIES_KEYS, getSpecies, speciesSeasonalColor } from './species';
import type { SpeciesKey } from './types';

describe('SPECIES', () => {
  it('has every key, each self-describing', () => {
    expect([...SPECIES_KEYS]).toEqual(['juniper', 'maple', 'pine']);
    for (const key of SPECIES_KEYS) {
      expect(SPECIES[key].key).toBe(key);
      expect(getSpecies(key)).toBe(SPECIES[key]);
    }
  });

  it('keeps the prototype numbers', () => {
    expect(SPECIES.juniper.growthRate).toBe(1.0);
    expect(SPECIES.maple.waterNeed).toBe(1.2);
    expect(SPECIES.pine.maxTrunkCm).toBe(50);
    expect(SPECIES.juniper.propagation).toEqual(['cutting', 'seed']);
    expect(SPECIES.pine.seasonsActive).toContain('winter');
    expect(SPECIES.maple.seasonsActive).not.toContain('winter');
  });

  it("pins each species' look; the juniper's leaf shape is the prototype's", () => {
    expect(SPECIES.juniper.look).toEqual({
      trunkBark: '#8c5e42',
      branchBark: '#9e6e4e',
      spriteTrunk: '#8c5e42',
      leafAspect: 1,
      leafSizeScale: 1,
      leafCountScale: 1,
    });
    expect(SPECIES.maple.look).toEqual({
      trunkBark: '#969288',
      branchBark: '#a6a296',
      spriteTrunk: '#969288',
      leafAspect: 1.6,
      leafSizeScale: 1.3,
      leafCountScale: 0.8,
    });
    expect(SPECIES.pine.look).toEqual({
      trunkBark: '#704a3a',
      branchBark: '#805844',
      spriteTrunk: '#704a3a',
      leafAspect: 0.35,
      leafSizeScale: 1.1,
      leafCountScale: 1.6,
    });
  });

  it("mirrors art/inked/style.mjs's WASHES entry each colour names", () => {
    const washes = inkedWashes();
    const mirrors: Record<SpeciesKey, Record<string, string | undefined>> = {
      juniper: {
        spring: 'juniperSpring',
        summer: 'foliage',
        autumn: 'foliage',
        winter: 'juniperWinter',
        leafColor: 'foliage',
        trunkBark: 'barkJuniper',
        branchBark: 'barkJuniperBranch',
        spriteTrunk: 'barkJuniper',
      },
      maple: {
        spring: 'mapleSpring',
        summer: 'mapleSummer',
        autumn: 'leafRed',
        winter: undefined,
        leafColor: 'leafRed',
        trunkBark: 'barkMaple',
        branchBark: 'barkMapleBranch',
        spriteTrunk: 'barkMaple',
      },
      pine: {
        spring: 'pineSpring',
        summer: 'pineSummer',
        autumn: 'pineSummer',
        winter: 'pineWinter',
        leafColor: 'pineSummer',
        trunkBark: 'barkPine',
        branchBark: 'barkPineBranch',
        spriteTrunk: 'barkPine',
      },
    };
    const hex = (colour: string | undefined): number | undefined =>
      colour === undefined ? undefined : Number.parseInt(colour.slice(1), 16);
    for (const key of SPECIES_KEYS) {
      const { seasonal, leafColor, look } = SPECIES[key];
      const colours: Record<string, string | undefined> = {
        ...seasonal,
        leafColor,
        trunkBark: look.trunkBark,
        branchBark: look.branchBark,
        spriteTrunk: look.spriteTrunk,
      };
      for (const [field, wash] of Object.entries(mirrors[key])) {
        const expected = wash === undefined ? undefined : washes[wash];
        if (wash !== undefined) expect(expected, `${key} ${field}: ${wash}`).toBeDefined();
        expect(hex(colours[field]), `${key} ${field}`).toBe(expected);
      }
    }
  });

  it("keeps leafColor the summer colour, the maple's its autumn red", () => {
    expect(SPECIES.juniper.leafColor).toBe(SPECIES.juniper.seasonal.summer);
    expect(SPECIES.pine.leafColor).toBe(SPECIES.pine.seasonal.summer);
    expect(SPECIES.maple.leafColor).toBe(SPECIES.maple.seasonal.autumn);
  });

  it('leaves maple bare in winter', () => {
    expect(SPECIES.maple.seasonal.winter).toBeUndefined();
    expect('winter' in SPECIES.maple.seasonal).toBe(true);
  });
});

describe('speciesSeasonalColor', () => {
  it('returns the seasonal colour', () => {
    expect(speciesSeasonalColor(SPECIES.juniper, 'spring')).toBe('#7cac60');
    expect(speciesSeasonalColor(SPECIES.pine, 'winter')).toBe('#40685a');
  });

  it('returns undefined for a season explicitly set to undefined', () => {
    expect(speciesSeasonalColor(SPECIES.maple, 'winter')).toBeUndefined();
  });
});
