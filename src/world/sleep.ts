/**
 * Sleep: the HUD menu's global day skip. Sleeping is the day clock running
 * (src/world/clock.ts), nothing more: each slept day is one
 * `advanceDayAllTrees(state, 1)`, so every tree drinks, grows and ages at
 * that day's season and the display pays day by day. Sleep itself costs
 * nothing; the inspector's Skip 7d (skipTreeTime) is the fertiliser-paid skip.
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

/** Advances the world `days` days one at a time, as the clock would; does nothing while `state.paused`. */
export function sleep(state: GameState, days: number, rng: Rng = Math.random): SleepResult {
  if (state.paused) return { days: 0, revenue: 0 };
  let revenue = 0;
  for (let d = 0; d < days; d++) revenue += advanceDayAllTrees(state, 1, rng);
  return { days, revenue };
}
