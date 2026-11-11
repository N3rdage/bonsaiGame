/**
 * The first-dormancy tip: the first time the season turns to one in which a
 * tree the player owns is dormant, a one-off note points at the season badge.
 * It sits beside the linear tutorial, not in it: `state.seasonTipShown` (saved
 * from version 3) keeps it to once a game, tutorial done or not.
 */

import { SEASONS, seasonForDay, seasonGrowthMultiplier, seasonLabel, type Season } from './seasons';
import { getSpecies } from './species';
import { isSold } from './tree';
import type { GameState, Species } from './types';

/** Whether `species` rests (does not grow) in `season`. */
export function isDormant(species: Species, season: Season): boolean {
  return seasonGrowthMultiplier(species.seasonsActive, season) <= 0;
}

/** The first season after `season`, cycling through the year, in which `species` grows again. */
export function nextActiveSeason(species: Species, season: Season): Season {
  const from = SEASONS.indexOf(season);
  for (let i = 1; i <= SEASONS.length; i++) {
    const next = SEASONS[(from + i) % SEASONS.length] ?? season;
    if (!isDormant(species, next)) return next;
  }
  return season;
}

/**
 * The tip's text when it is due: the day moved from `previousDay` into a new
 * season, a tree the player still owns (not sold) is dormant in it, and the
 * tip has not fired yet this game; otherwise undefined. Names the first
 * dormant tree's species and the season it wakes in. The caller sets
 * `seasonTipShown` when it shows the tip.
 */
export function seasonTipFor(state: GameState, previousDay: number): string | undefined {
  if (state.seasonTipShown) return undefined;
  const season = seasonForDay(state.day);
  if (season === seasonForDay(previousDay)) return undefined;
  const tree = state.trees.find((t) => !isSold(t) && isDormant(getSpecies(t.speciesKey), season));
  if (!tree) return undefined;
  const species = getSpecies(tree.speciesKey);
  return (
    `${seasonLabel(season)}: ${species.displayName} is dormant. ` +
    `Growth and fertilising pause until ${nextActiveSeason(species, season)}. ` +
    'Watch the badge top-left.'
  );
}
