/**
 * Sleep: the HUD menu's global day skip. Sleeping runs the day clock
 * (src/world/clock.ts) to the next morning, nothing more: each slept day is
 * one `advanceDayAllTrees(state, 1)`, so every tree drinks, grows and ages at
 * that day's season and the display pays day by day, and the player wakes at
 * time of day 0. Sleep itself costs nothing; the inspector's Skip 7d
 * (skipTreeTime) is the fertiliser-paid skip.
 */

import { advanceDayAllTrees } from '../sim/world';
import type { GameState, Rng } from '../sim/types';

/** The menu's Sleep a week. */
export const SLEEP_WEEK_DAYS = 7;

export interface SleepResult {
  /** Days the world advanced: `days`, or 0 while paused. */
  readonly days: number;
  /** Display revenue those days paid, summed. */
  readonly revenue: number;
}

/**
 * Sleeps through `days` mornings: the world advances `days` days one at a
 * time, as the clock would, and the time of day ends at morning (0), however
 * far into the day the sleep began. Does nothing while `state.paused`.
 */
export function sleep(state: GameState, days: number, rng: Rng = Math.random): SleepResult {
  if (state.paused) return { days: 0, revenue: 0 };
  let revenue = 0;
  for (let d = 0; d < days; d++) revenue += advanceDayAllTrees(state, 1, rng);
  state.timeOfDayS = 0;
  return { days, revenue };
}
