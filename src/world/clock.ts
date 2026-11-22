/**
 * The real-time day clock, ported from obj_game_controller/Step_0.gml lines
 * 6-15: unless the game is paused, real seconds times `base_time_scale`
 * accumulate, and each time a day's worth (SECONDS_PER_DAY, src/sim/timeOfDay.ts)
 * has built up it is taken off and the world advances a day. What has built up
 * toward the next day is the state's time of day (`state.timeOfDayS`), saved
 * with the game.
 */

import { SECONDS_PER_DAY, type TimeSpeed } from '../sim/timeOfDay';
import { advanceDayAllTrees } from '../sim/world';
import type { GameState, Rng } from '../sim/types';

/** Create_0: `global.base_time_scale = 1.0`; `?timeScale=` overrides it for tests. */
export const BASE_TIME_SCALE = 1;
/** Cap on `?timeScale=`: tickClock steps day by day, so a huge finite scale would hang the tab too; at 10000 a one-second hitch is still only ~11 days. */
export const MAX_TIME_SCALE = 10_000;

/**
 * Parses the `?timeScale=` test override: a finite number above 0, clamped to
 * MAX_TIME_SCALE; anything else (missing, zero, negative, Infinity, not a
 * number) is `undefined`, as if the parameter were absent.
 */
export function parseTimeScale(raw: string | null): number | undefined {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_TIME_SCALE) : undefined;
}

/**
 * The clock's rate: the `?timeScale=` override (or BASE_TIME_SCALE) times the
 * player's time speed, so the two multiply.
 */
export function effectiveTimeScale(override: number | undefined, speed: TimeSpeed): number {
  return (override ?? BASE_TIME_SCALE) * speed;
}

export interface ClockTick {
  /** Days the world advanced in this tick. */
  readonly days: number;
  /** Display revenue those days paid, summed. */
  readonly revenue: number;
}

/**
 * Adds `deltaS` real seconds at `timeScale` to `state.timeOfDayS` and advances
 * the world one day (`advanceDayAllTrees(state, 1)`, as the prototype's while
 * loop) for every whole day built up, leaving the rest as the new time of day.
 * While `state.paused` the time of day stands still.
 */
export function tickClock(
  state: GameState,
  deltaS: number,
  timeScale: number,
  rng: Rng = Math.random,
): ClockTick {
  if (state.paused) return { days: 0, revenue: 0 };
  let acc = state.timeOfDayS + deltaS * timeScale;
  let days = 0;
  let revenue = 0;
  while (acc >= SECONDS_PER_DAY) {
    acc -= SECONDS_PER_DAY;
    days += 1;
    revenue += advanceDayAllTrees(state, 1, rng);
  }
  state.timeOfDayS = acc;
  return { days, revenue };
}
