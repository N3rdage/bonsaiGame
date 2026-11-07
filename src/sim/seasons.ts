/**
 * Seasons are a pure function of the game day. Nothing is persisted, so old
 * saves keep working. The year starts in spring on day 1 and has four seasons
 * of DAYS_PER_SEASON days each.
 *
 * Ported from archive/gamemaker/scripts/scr_seasons/scr_seasons.gml.
 */

export const DAYS_PER_SEASON = 28;

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

const YEAR_LENGTH = DAYS_PER_SEASON * SEASONS.length;

/** Season for a 1-based game day. Days below 1 are treated as day 1. */
export function seasonForDay(day: number): Season {
  const d = Math.max(1, Math.floor(day));
  const index = Math.floor(((d - 1) % YEAR_LENGTH) / DAYS_PER_SEASON);
  return SEASONS[index] ?? 'spring';
}

/** Day within the current season, 1..DAYS_PER_SEASON. */
export function dayOfSeason(day: number): number {
  const d = Math.max(1, Math.floor(day));
  return ((d - 1) % DAYS_PER_SEASON) + 1;
}

export function seasonLabel(season: Season): string {
  return season.charAt(0).toUpperCase() + season.slice(1);
}

/**
 * Growth multiplier for a species in a season. Returns 0 (dormant) when the
 * season is not in the species' active list. Spring strongest, summer baseline,
 * autumn slowing, winter only meaningful for winter-active species.
 *
 * This is the single source of truth for "is this species growing right now";
 * fertiliser gating and the daily tick must both consult it.
 */
export function seasonGrowthMultiplier(seasonsActive: readonly Season[], season: Season): number {
  if (!seasonsActive.includes(season)) return 0;
  switch (season) {
    case 'spring':
      return 1.3;
    case 'summer':
      return 1.0;
    case 'autumn':
      return 0.5;
    case 'winter':
      return 0.4;
  }
}

/**
 * Water decay multiplier. Species-agnostic: even dormant deciduous trees
 * transpire a little through bark, so winter is reduced but not zero.
 */
export function seasonWaterMultiplier(season: Season): number {
  switch (season) {
    case 'spring':
      return 1.0;
    case 'summer':
      return 1.5;
    case 'autumn':
      return 0.7;
    case 'winter':
      return 0.3;
  }
}
