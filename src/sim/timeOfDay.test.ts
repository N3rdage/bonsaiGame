import { describe, expect, it } from 'vitest';
import {
  DAY_PHASES,
  DAY_PHASE_STARTS,
  SECONDS_PER_DAY,
  TIME_SPEEDS,
  nextTimeSpeed,
  parseTimeSpeed,
  realSecondsPerDay,
  timeOfDay,
} from './timeOfDay';

describe('time speed', () => {
  it('offers 1x, 2x and 4x, cycling back to 1x', () => {
    expect(TIME_SPEEDS).toEqual([1, 2, 4]);
    expect(TIME_SPEEDS.map(nextTimeSpeed)).toEqual([2, 4, 1]);
  });

  it('takes 900, 450 and 225 real seconds a day', () => {
    expect(TIME_SPEEDS.map(realSecondsPerDay)).toEqual([900, 450, 225]);
  });

  it('parses only the offered speeds', () => {
    expect([1, 2, 4].map(parseTimeSpeed)).toEqual([1, 2, 4]);
    expect([0, 3, '2', null].map(parseTimeSpeed)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe('timeOfDay', () => {
  it('a day is 900 game seconds, 15 real minutes at the base time scale', () => {
    expect(SECONDS_PER_DAY).toBe(900);
  });

  it('runs dawn, day, dusk, night in order, starting at 0, 60, 600 and 690 s', () => {
    expect(DAY_PHASES).toEqual(['dawn', 'day', 'dusk', 'night']);
    expect(DAY_PHASE_STARTS).toEqual({ dawn: 0, day: 60, dusk: 600, night: 690 });
  });

  it.each([
    [0, 'dawn'],
    [59.999, 'dawn'],
    [60, 'day'],
    [599.999, 'day'],
    [600, 'dusk'],
    [689.999, 'dusk'],
    [690, 'night'],
    [899.999, 'night'],
  ] as const)('%d s into the day is %s', (seconds, phase) => {
    expect(timeOfDay(seconds).phase).toBe(phase);
  });

  it('gives the fraction of the day, 0 at morning', () => {
    expect(timeOfDay(0).fraction).toBe(0);
    expect(timeOfDay(450).fraction).toBe(0.5);
    expect(timeOfDay(675).fraction).toBe(0.75);
  });

  it('wraps seconds outside the day into it', () => {
    expect(timeOfDay(SECONDS_PER_DAY)).toEqual({ fraction: 0, phase: 'dawn' });
    expect(timeOfDay(SECONDS_PER_DAY + 60)).toEqual(timeOfDay(60));
    expect(timeOfDay(-210)).toEqual(timeOfDay(690));
  });
});
