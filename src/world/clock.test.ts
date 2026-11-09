import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import { createTree } from '../sim/tree';
import type { GameState } from '../sim/types';
import { advanceDayAllTrees } from '../sim/world';
import { BASE_TIME_SCALE, SECONDS_PER_DAY, tickClock } from './clock';

/** Never triggers natural branch spawns, so two runs grow the same. */
const rng = () => 0.999;

function displayedState(): GameState {
  const state = createNewGameState();
  const tree = createTree('juniper', 'cutting', 0);
  tree.location = 'displayed:shed_main';
  state.trees = [tree];
  return state;
}

describe('day clock', () => {
  it('runs 300 real seconds a day at the base time scale of 1', () => {
    expect(SECONDS_PER_DAY).toBe(300);
    expect(BASE_TIME_SCALE).toBe(1);
    const state = createNewGameState();
    expect(tickClock(state, 0, 299.5, 1)).toMatchObject({ accumulatorS: 299.5, days: 0 });
    expect(state.day).toBe(0);
    expect(tickClock(state, 299.5, 0.5, 1)).toMatchObject({ accumulatorS: 0, days: 1 });
    expect(state.day).toBe(1);
  });

  it('carries the remainder: an accumulator of 650 s is two days and 50 s', () => {
    const state = createNewGameState();
    expect(tickClock(state, 650, 0, 1)).toMatchObject({ accumulatorS: 50, days: 2 });
    expect(state.day).toBe(2);
  });

  it('scales real seconds by the time scale', () => {
    const state = createNewGameState();
    expect(tickClock(state, 0, 1, 300)).toMatchObject({ accumulatorS: 0, days: 1 });
    expect(tickClock(state, 0, 2, 100)).toMatchObject({ accumulatorS: 200, days: 0 });
  });

  it('accumulates and advances nothing while paused', () => {
    const state = displayedState();
    state.paused = true;
    expect(tickClock(state, 100, 1000, 1, rng)).toEqual({ accumulatorS: 100, days: 0, revenue: 0 });
    expect([state.day, state.money]).toEqual([0, 100]);
  });

  it('advances the world a day at a time, as advanceDayAllTrees(state, 1) per day', () => {
    const state = displayedState();
    const expected = displayedState();
    const want = advanceDayAllTrees(expected, 1, rng) + advanceDayAllTrees(expected, 1, rng);
    const tick = tickClock(state, 0, 600, 1, rng);
    expect(tick).toEqual({ accumulatorS: 0, days: 2, revenue: want });
    expect(want).toBeGreaterThan(0);
    expect([state.day, state.money]).toEqual([expected.day, expected.money]);
  });
});
