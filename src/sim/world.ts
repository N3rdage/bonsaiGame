/**
 * World-level day advance: ticks every tree and pays display revenue.
 *
 * Ported from `advance_day_all_trees` in
 * archive/gamemaker/scripts/scr_growth/scr_growth.gml (the per-tree tick
 * itself lives in growth.ts).
 */

import { treeDailyTick } from './growth';
import { scoreTree } from './scoring';
import { isDisplayed } from './tree';
import type { GameState, Rng } from './types';

/** Daily display payout per score point. Selling pays score * 2, so display matches it at 20 days. */
export const DISPLAY_REVENUE_RATE = 0.1;
/** Fancy pots (potTier 1) bump the daily display payout. */
export const FANCY_POT_REVENUE_MULT = 1.25;

/**
 * Advance the world `days` days: move the calendar first (as the prototype
 * did), tick every tree `days` times non-isolated, then credit display revenue
 * for each tree on a pedestal. Returns the revenue added to `state.money`.
 */
export function advanceDayAllTrees(state: GameState, days: number, rng: Rng = Math.random): number {
  state.day += days;
  for (const tree of state.trees) {
    for (let d = 0; d < days; d++) {
      treeDailyTick(tree, state, false, rng);
    }
  }

  let revenue = 0;
  for (const tree of state.trees) {
    if (!isDisplayed(tree)) continue;
    const potMult = tree.potTier === 1 ? FANCY_POT_REVENUE_MULT : 1.0;
    revenue += roundHalfToEven(scoreTree(tree).total * DISPLAY_REVENUE_RATE * potMult) * days;
  }
  if (revenue > 0) state.money += revenue;
  return revenue;
}

/**
 * GameMaker's `round()` is banker's rounding: exact halves go to the nearest
 * even integer (round(6.5) = 6, round(7.5) = 8). JavaScript's Math.round goes
 * up, so the prototype's revenue numbers need this to match.
 */
export function roundHalfToEven(x: number): number {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff < 0.5) return f;
  if (diff > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}
