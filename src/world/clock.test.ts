import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import { SECONDS_PER_DAY } from '../sim/timeOfDay';
import { createTree } from '../sim/tree';
import type { GameState } from '../sim/types';
import { advanceDayAllTrees } from '../sim/world';
import { BASE_TIME_SCALE, MAX_TIME_SCALE, parseTimeScale, tickClock } from './clock';

/** Never triggers natural branch spawns, so two runs grow the same. */
const rng = () => 0.999;

function displayedState(): GameState {
  const state = createNewGameState();
  const tree = createTree('juniper', 'cutting', 0);
  tree.location = 'displayed:lounge_mantel';
  state.trees = [tree];
  return state;
}

describe('day clock', () => {
  it('runs 900 real seconds a day at the base time scale of 1, from morning', () => {
    expect(SECONDS_PER_DAY).toBe(900);
    expect(BASE_TIME_SCALE).toBe(1);
    const state = createNewGameState();
    expect(state.timeOfDayS).toBe(0);
    expect(tickClock(state, 899.5, 1)).toEqual({ days: 0, revenue: 0 });
    expect([state.day, state.timeOfDayS]).toEqual([0, 899.5]);
    expect(tickClock(state, 0.5, 1)).toMatchObject({ days: 1 });
    expect([state.day, state.timeOfDayS]).toEqual([1, 0]);
  });

  it('carries the remainder: 1850 s from morning is two days and 50 s', () => {
    const state = createNewGameState();
    expect(tickClock(state, 1850, 1)).toMatchObject({ days: 2 });
    expect([state.day, state.timeOfDayS]).toEqual([2, 50]);
  });

  it('carries on from the time of day the state holds', () => {
    const state = createNewGameState();
    state.timeOfDayS = 800;
    expect(tickClock(state, 150, 1)).toMatchObject({ days: 1 });
    expect([state.day, state.timeOfDayS]).toEqual([1, 50]);
  });

  it('scales real seconds by the time scale', () => {
    const state = createNewGameState();
    expect(tickClock(state, 1, 900)).toMatchObject({ days: 1 });
    expect(state.timeOfDayS).toBe(0);
    expect(tickClock(state, 2, 100)).toMatchObject({ days: 0 });
    expect(state.timeOfDayS).toBe(200);
  });

  it('stands still and advances nothing while paused', () => {
    const state = displayedState();
    state.timeOfDayS = 100;
    state.paused = true;
    expect(tickClock(state, 1000, 1, rng)).toEqual({ days: 0, revenue: 0 });
    expect([state.day, state.money, state.timeOfDayS]).toEqual([0, 100, 100]);
  });

  it('advances the world a day at a time, as advanceDayAllTrees(state, 1) per day', () => {
    const state = displayedState();
    const expected = displayedState();
    const want = advanceDayAllTrees(expected, 1, rng) + advanceDayAllTrees(expected, 1, rng);
    const tick = tickClock(state, 1800, 1, rng);
    expect(tick).toEqual({ days: 2, revenue: want });
    expect(want).toBeGreaterThan(0);
    expect([state.day, state.money, state.timeOfDayS]).toEqual([expected.day, expected.money, 0]);
  });
});

describe('parseTimeScale', () => {
  it('takes a finite positive ?timeScale=', () => {
    expect(parseTimeScale('150')).toBe(150);
    expect(parseTimeScale('0.5')).toBe(0.5);
  });

  it.each(['0', '-1', 'Infinity', '1e400', 'abc', ''])('ignores %j', (raw) => {
    expect(parseTimeScale(raw)).toBeUndefined();
  });

  it('ignores a missing parameter', () => {
    expect(parseTimeScale(null)).toBeUndefined();
  });

  it('clamps to 10000 so a frame cannot step through millions of days', () => {
    expect(MAX_TIME_SCALE).toBe(10_000);
    expect(parseTimeScale('10000')).toBe(10_000);
    expect(parseTimeScale('1e300')).toBe(10_000);
  });
});
