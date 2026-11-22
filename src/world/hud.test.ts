import { describe, expect, it } from 'vitest';
import { timeText } from './hud';

describe('timeText', () => {
  it('names the phase of the day, from morning', () => {
    expect([0, 59, 60, 599, 600, 689, 690, 899].map((s) => timeText(s, 1))).toEqual([
      'Dawn',
      'Dawn',
      'Day',
      'Day',
      'Dusk',
      'Dusk',
      'Night',
      'Night',
    ]);
  });

  it('adds the speed above 1x', () => {
    expect(timeText(0, 2)).toBe('Dawn  2x');
    expect(timeText(700, 4)).toBe('Night  4x');
  });
});
