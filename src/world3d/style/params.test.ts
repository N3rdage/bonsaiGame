import { describe, expect, it } from 'vitest';
import { parseStyleParams } from './params';

describe('parseStyleParams', () => {
  it('is today look by day with no bench when absent', () => {
    expect(parseStyleParams('')).toEqual({ take: null, time: 'day', bench: false });
  });

  it('reads a take, dusk and the bench', () => {
    expect(parseStyleParams('?style=b&time=dusk&bench=1')).toEqual({
      take: 'b',
      time: 'dusk',
      bench: true,
    });
  });

  it('ignores an unknown take', () => {
    expect(parseStyleParams('?style=z').take).toBeNull();
  });
});
