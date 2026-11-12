import { describe, expect, it } from 'vitest';
import { SPECIES, SPECIES_KEYS, getSpecies, speciesSeasonalColor } from './species';

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

  it("pins each species' look; the juniper's is the prototype's one look", () => {
    expect(SPECIES.juniper.look).toEqual({
      trunkBark: '#5a3c28',
      branchBark: '#6e4b32',
      spriteTrunk: '#4b321e',
      leafAspect: 1,
      leafSizeScale: 1,
      leafCountScale: 1,
    });
    expect(SPECIES.maple.look).toEqual({
      trunkBark: '#6e6a62',
      branchBark: '#7c7870',
      spriteTrunk: '#5a5650',
      leafAspect: 1.6,
      leafSizeScale: 1.3,
      leafCountScale: 0.8,
    });
    expect(SPECIES.pine.look).toEqual({
      trunkBark: '#3e2a1e',
      branchBark: '#4c3626',
      spriteTrunk: '#32221a',
      leafAspect: 0.35,
      leafSizeScale: 1.1,
      leafCountScale: 1.6,
    });
  });

  it('leaves maple bare in winter', () => {
    expect(SPECIES.maple.seasonal.winter).toBeUndefined();
    expect('winter' in SPECIES.maple.seasonal).toBe(true);
  });
});

describe('speciesSeasonalColor', () => {
  it('returns the seasonal colour', () => {
    expect(speciesSeasonalColor(SPECIES.juniper, 'spring')).toBe('#5c7d4f');
    expect(speciesSeasonalColor(SPECIES.pine, 'winter')).toBe('#2e4a2e');
  });

  it('returns undefined for a season explicitly set to undefined', () => {
    expect(speciesSeasonalColor(SPECIES.maple, 'winter')).toBeUndefined();
  });
});
