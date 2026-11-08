import { DAYS_PER_SEASON, dayOfSeason, seasonForDay, seasonLabel } from '../sim/seasons';
import type { GameState } from '../sim/types';

/**
 * The world HUD badge (obj_game_controller Draw_64): season, day of season,
 * game day and money. The game day is shown raw, so a new game reads Day 0
 * while its season day reads 1, as in the prototype.
 */
export function hudText(state: Pick<GameState, 'day' | 'money'>): string {
  const season = seasonLabel(seasonForDay(state.day));
  return `${season} ${String(dayOfSeason(state.day))}/${String(DAYS_PER_SEASON)}  |  Day ${String(state.day)}  |  $${String(state.money)}`;
}
