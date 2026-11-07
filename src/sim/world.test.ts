import { describe, expect, it } from 'vitest';
import { scoreTree } from './scoring';
import { createNewGameState } from './state';
import { createTree } from './tree';
import type { GameState } from './types';
import { DISPLAY_REVENUE_RATE, FANCY_POT_REVENUE_MULT, advanceDayAllTrees } from './world';

function must<T>(v: T | undefined): T {
  if (v === undefined) throw new Error('expected a value');
  return v;
}

/** Deterministic rng that never triggers natural branch spawns. */
const rng = () => 0.999;

function stateWith(...locations: string[]): GameState {
  const state = createNewGameState();
  state.trees = locations.map((loc, i) => {
    const t = createTree('juniper', 'cutting', i);
    t.location = loc;
    return t;
  });
  state.day = 10;
  return state;
}

describe('advanceDayAllTrees', () => {
  it('moves the calendar and ticks every tree once per day', () => {
    const state = stateWith('shed', 'garden');
    const before = state.trees.map((t) => t.ageDays);
    advanceDayAllTrees(state, 3, rng);
    expect(state.day).toBe(13);
    state.trees.forEach((t, i) => {
      expect(t.ageDays).toBe((before[i] ?? 0) + 3);
    });
  });

  it('pays round(total * 0.1) per day for a displayed tree', () => {
    const state = stateWith('displayed:shed_main');
    const money = state.money;
    const revenue = advanceDayAllTrees(state, 3, rng);
    const tree = must(state.trees[0]);
    const expected = Math.round(scoreTree(tree).total * DISPLAY_REVENUE_RATE) * 3;
    expect(revenue).toBe(expected);
    expect(revenue).toBeGreaterThan(0);
    expect(state.money - money).toBe(revenue);
  });

  it('pays the 1.25x rate for a fancy pot', () => {
    const state = stateWith('displayed:shed_main');
    must(state.trees[0]).potTier = 1;
    const money = state.money;
    const revenue = advanceDayAllTrees(state, 2, rng);
    const total = scoreTree(must(state.trees[0])).total;
    expect(revenue).toBe(Math.round(total * DISPLAY_REVENUE_RATE * FANCY_POT_REVENUE_MULT) * 2);
    expect(state.money - money).toBe(revenue);
  });

  it('pays nothing for trees that are not displayed', () => {
    const state = stateWith('shed', 'inventory', 'sold');
    const money = state.money;
    expect(advanceDayAllTrees(state, 5, rng)).toBe(0);
    expect(state.money).toBe(money);
  });
});
