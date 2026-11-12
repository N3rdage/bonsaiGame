import { describe, expect, it } from 'vitest';
import { fertilizeTree, treeDailyTick, waterTree } from '../sim/growth';
import { seasonWaterMultiplier } from '../sim/seasons';
import { getSpecies } from '../sim/species';
import { createNewGameState } from '../sim/state';
import { createTree } from '../sim/tree';
import type { BonsaiTree, GameState } from '../sim/types';
import { advanceDayAllTrees } from '../sim/world';
import { SLEEP_WEEK_DAYS, sleep } from './sleep';

/** Deterministic rng that never triggers natural branch spawns. */
const rng = () => 0.999;

function must<T>(v: T | undefined): T {
  if (v === undefined) throw new Error('expected a value');
  return v;
}

/** Day 10 (spring), one juniper per location. */
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

/** `tree` after `days` clock days from `day`: the calendar moves, then the tree ticks. */
function ticked(tree: BonsaiTree, state: GameState, days: number): BonsaiTree {
  const ref = structuredClone(tree);
  const at = structuredClone(state);
  for (let d = 0; d < days; d++) {
    at.day += 1;
    treeDailyTick(ref, at, false, rng);
  }
  return ref;
}

describe('sleep', () => {
  it('advances the day by 1 and ticks every tree once', () => {
    const state = stateWith('shed', 'garden');
    const ages = state.trees.map((t) => t.ageDays);
    expect(sleep(state, 1, rng)).toEqual({ days: 1, revenue: 0 });
    expect(state.day).toBe(11);
    state.trees.forEach((t, i) => {
      expect(t.ageDays).toBe(must(ages[i]) + 1);
    });
  });

  it('a week advances 7 days and pays seven days of display revenue, day by day', () => {
    const state = stateWith('displayed:lounge_mantel');
    const ref = structuredClone(state);
    let expected = 0;
    for (let d = 0; d < 7; d++) expected += advanceDayAllTrees(ref, 1, rng);
    const money = state.money;
    const result = sleep(state, SLEEP_WEEK_DAYS, rng);
    expect(SLEEP_WEEK_DAYS).toBe(7);
    expect(result).toEqual({ days: 7, revenue: expected });
    expect(result.revenue).toBeGreaterThan(0);
    expect(state.day).toBe(17);
    expect(state.money - money).toBe(expected);
  });

  it('a week grows a watered, fertilised tree and uses its water and fertilised days', () => {
    const state = stateWith('shed');
    const tree = must(state.trees[0]);
    state.inventory.fertilizer = 1;
    waterTree(tree, state);
    expect(fertilizeTree(tree, state)).toBe(true);
    expect(tree.fertilizedUntilDay).toBe(17);
    const height = tree.trunk.heightCm;
    const expected = ticked(tree, state, 7);
    sleep(state, 7, rng);
    expect(tree).toEqual(expected);
    expect(tree.trunk.heightCm).toBeGreaterThan(height);
    const drink = getSpecies('juniper').waterNeed * 5 * seasonWaterMultiplier('spring');
    expect(tree.waterLevel).toBeCloseTo(100 - 7 * drink);
    expect(state.day).toBeGreaterThanOrEqual(tree.fertilizedUntilDay);
  });

  it('an unwatered tree loses 2 vitality a day', () => {
    const state = stateWith('shed');
    const tree = must(state.trees[0]);
    tree.waterLevel = 0;
    tree.vitality = 80;
    sleep(state, 7, rng);
    expect(tree.vitality).toBe(66);
  });

  it('debits no consumable and no money for the sleep itself', () => {
    const state = stateWith('shed');
    state.inventory.fertilizer = 3;
    const inventory = structuredClone(state.inventory);
    const money = state.money;
    sleep(state, 7, rng);
    expect(state.inventory).toEqual(inventory);
    expect(state.money).toBe(money);
  });

  it('does nothing while paused', () => {
    const state = stateWith('shed', 'displayed:lounge_mantel');
    state.paused = true;
    const before = structuredClone(state);
    expect(sleep(state, 7, rng)).toEqual({ days: 0, revenue: 0 });
    expect(state).toEqual(before);
  });
});
