import { describe, expect, it } from 'vitest';
import {
  DAYS_PER_SEASON,
  dayOfSeason,
  seasonForDay,
  seasonGrowthMultiplier,
  seasonLabel,
  seasonWaterMultiplier,
} from './seasons';

describe('seasonForDay', () => {
  it('starts the year in spring on day 1', () => {
    expect(seasonForDay(1)).toBe('spring');
  });

  it('changes season every DAYS_PER_SEASON days', () => {
    expect(seasonForDay(DAYS_PER_SEASON)).toBe('spring');
    expect(seasonForDay(DAYS_PER_SEASON + 1)).toBe('summer');
    expect(seasonForDay(DAYS_PER_SEASON * 2 + 1)).toBe('autumn');
    expect(seasonForDay(DAYS_PER_SEASON * 3 + 1)).toBe('winter');
  });

  it('wraps around to spring after a full year', () => {
    expect(seasonForDay(DAYS_PER_SEASON * 4)).toBe('winter');
    expect(seasonForDay(DAYS_PER_SEASON * 4 + 1)).toBe('spring');
    expect(seasonForDay(DAYS_PER_SEASON * 9 + 1)).toBe('summer');
  });

  it('treats day 0 and negatives as day 1, matching the GameMaker clamp', () => {
    expect(seasonForDay(0)).toBe('spring');
    expect(seasonForDay(-40)).toBe('spring');
  });

  it('ignores fractional days', () => {
    expect(seasonForDay(DAYS_PER_SEASON + 0.9)).toBe('spring');
  });
});

describe('dayOfSeason', () => {
  it('counts from 1 within each season', () => {
    expect(dayOfSeason(1)).toBe(1);
    expect(dayOfSeason(DAYS_PER_SEASON)).toBe(DAYS_PER_SEASON);
    expect(dayOfSeason(DAYS_PER_SEASON + 1)).toBe(1);
    expect(dayOfSeason(0)).toBe(1);
  });
});

describe('seasonLabel', () => {
  it('capitalises the key', () => {
    expect(seasonLabel('spring')).toBe('Spring');
    expect(seasonLabel('winter')).toBe('Winter');
  });
});

describe('seasonGrowthMultiplier', () => {
  const evergreen = ['spring', 'summer', 'autumn', 'winter'] as const;
  const deciduous = ['spring', 'summer', 'autumn'] as const;

  it('is dormant (0) outside the active seasons', () => {
    expect(seasonGrowthMultiplier(deciduous, 'winter')).toBe(0);
    expect(seasonGrowthMultiplier([], 'spring')).toBe(0);
  });

  it('matches the GameMaker values for active seasons', () => {
    expect(seasonGrowthMultiplier(evergreen, 'spring')).toBe(1.3);
    expect(seasonGrowthMultiplier(evergreen, 'summer')).toBe(1.0);
    expect(seasonGrowthMultiplier(evergreen, 'autumn')).toBe(0.5);
    expect(seasonGrowthMultiplier(evergreen, 'winter')).toBe(0.4);
  });
});

describe('seasonWaterMultiplier', () => {
  it('pulls hardest in summer and least in winter', () => {
    expect(seasonWaterMultiplier('spring')).toBe(1.0);
    expect(seasonWaterMultiplier('summer')).toBe(1.5);
    expect(seasonWaterMultiplier('autumn')).toBe(0.7);
    expect(seasonWaterMultiplier('winter')).toBe(0.3);
  });
});
