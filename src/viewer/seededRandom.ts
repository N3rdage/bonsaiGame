/**
 * A small seeded pseudo-random generator (mulberry32) for mesh jitter that
 * must regenerate identically on every rebuild. GameMaker's `random_set_seed`
 * plus `random_range` cannot be reproduced bit for bit, so the port keeps the
 * prototype's guarantee (same seed, same sequence) rather than its numbers.
 */

export interface SeededRandom {
  /** Next value, uniform in [0, 1). */
  next(): number;
  /** Next value, uniform between lo and hi and never outside [lo, hi] (`random_range`). */
  range(lo: number, hi: number): number;
}

export function seededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
  };
}
