import { describe, expect, it } from 'vitest';
import { seededRandom } from './seededRandom';

describe('seededRandom (mulberry32)', () => {
  it('pins the first outputs for a fixed seed (the reference mulberry32 sequence)', () => {
    const rng = seededRandom(42);
    expect([rng.next(), rng.next(), rng.next()]).toEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099,
    ]);
  });

  it('range maps next() linearly onto [lo, hi]', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect(a.range(-2, 2)).toBeCloseTo(-2 + b.next() * 4, 12);
  });

  it('repeats the same sequence for the same seed and differs across seeds', () => {
    const a = seededRandom(1001);
    const b = seededRandom(1001);
    const c = seededRandom(2001);
    const seqA = Array.from({ length: 8 }, () => a.next());
    expect(Array.from({ length: 8 }, () => b.next())).toEqual(seqA);
    expect(Array.from({ length: 8 }, () => c.next())).not.toEqual(seqA);
  });

  it('next stays in [0, 1) and range stays inside its bounds', () => {
    const rng = seededRandom(7);
    for (let i = 0; i < 10_000; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      const r = rng.range(-0.1, 0.05);
      expect(r).toBeGreaterThanOrEqual(-0.1);
      expect(r).toBeLessThanOrEqual(0.05);
    }
  });
});
