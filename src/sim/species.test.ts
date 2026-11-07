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
