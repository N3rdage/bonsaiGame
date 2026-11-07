import { describe, expect, it } from 'vitest';
import { scoreBand, scoreGauss, scoreTree } from './scoring';
import { createTree } from './tree';

function must<T>(v: T | undefined): T {
  if (v === undefined) throw new Error('expected a value');
  return v;
}

describe('scoreGauss', () => {
  it('is 1 at the target and exp(-0.5) one sigma away', () => {
    expect(scoreGauss(0.6, 0.6, 0.2)).toBe(1);
    expect(scoreGauss(0.8, 0.6, 0.2)).toBeCloseTo(Math.exp(-0.5), 12);
    expect(scoreGauss(0.4, 0.6, 0.2)).toBeCloseTo(Math.exp(-0.5), 12);
  });
});

describe('scoreBand', () => {
  it('is 1 inside the band, falls off linearly, and is 0 beyond the falloff', () => {
    expect(scoreBand(3, 3, 7, 4)).toBe(1);
    expect(scoreBand(5, 3, 7, 4)).toBe(1);
    expect(scoreBand(7, 3, 7, 4)).toBe(1);
    expect(scoreBand(2, 3, 7, 4)).toBeCloseTo(0.75, 12);
    expect(scoreBand(9, 3, 7, 4)).toBeCloseTo(0.5, 12);
    expect(scoreBand(11, 3, 7, 4)).toBe(0);
    expect(scoreBand(-5, 3, 7, 4)).toBe(0);
  });
});

describe('scoreTree', () => {
  it('scores a fresh cutting at the hand-computed total', () => {
    // taper 0.7 -> exp(-0.125) = 0.8825; proportion 8*10/4 = 20 -> 0;
    // 2 branches -> 0.75; angles 45/225 opposite -> 1; originY 3/8, 5/8 sd 0.125
    // -> exp(-0.175^2/0.045) = 0.5063; foliage 0.25 -> 1 - 0.05/0.3 = 0.8333.
    // Sum 3.9722 / 6 = 0.6620 -> 66.2 at vitality 100 -> floor 66.
    const t = createTree('juniper', 'cutting', 0);
    const s = scoreTree(t);
    expect(s.total).toBe(66);
    const values = s.breakdown.map((c) => c.value);
    expect(values[0]).toBeCloseTo(Math.exp(-0.125), 12);
    expect(values[1]).toBe(0);
    expect(values[2]).toBeCloseTo(0.75, 12);
    expect(values[3]).toBeCloseTo(1, 12);
    expect(values[4]).toBeCloseTo(Math.exp(-(0.175 * 0.175) / 0.045), 12);
    expect(values[5]).toBeCloseTo(0.25 / 0.3, 12);
  });

  it('lists the six base criteria at weight 1 then the vitality multiplier', () => {
    const s = scoreTree(createTree('juniper', 'cutting', 0));
    expect(s.breakdown.map((c) => c.label)).toEqual([
      'Trunk taper',
      'Trunk proportion',
      'Branch count',
      'Angular spread',
      'Vertical spread',
      'Foliage',
      'Vitality',
    ]);
    for (const c of s.breakdown.slice(0, 6)) {
      expect(c.weight).toBe(1);
      expect(c.isMultiplier).toBe(false);
    }
    expect(s.breakdown.at(-1)).toEqual({
      label: 'Vitality',
      value: 1,
      weight: 0,
      points: 0,
      isMultiplier: true,
    });
    const pointSum = s.breakdown.reduce((acc, c) => acc + c.points, 0);
    expect(Math.floor(pointSum)).toBe(s.total);
  });

  it('gives bunched branches 0 angular spread and spread branches near 1', () => {
    const bunched = createTree('juniper', 'cutting', 0);
    for (const b of bunched.branches) b.angle = 0;
    expect(scoreTree(bunched).breakdown[3]?.value).toBeCloseTo(0, 12);

    const spread = createTree('juniper', 'cutting', 0);
    spread.branches.push({ ...must(spread.branches[0]), id: 2, angle: 135 });
    spread.branches.push({ ...must(spread.branches[0]), id: 3, angle: 315 });
    expect(scoreTree(spread).breakdown[3]?.value).toBeCloseTo(1, 12);
  });

  it('scales the total by vitality', () => {
    const t = createTree('juniper', 'cutting', 0);
    t.vitality = 50;
    const s = scoreTree(t);
    expect(s.total).toBe(33); // floor(66.2 / 2)
    expect(s.breakdown.at(-1)?.value).toBe(0.5);
  });

  it('adds a weighted style criterion without the parenthetical name', () => {
    const t = createTree('juniper', 'cutting', 0);
    t.targetStyle = 'windswept';
    const s = scoreTree(t);
    expect(s.breakdown).toHaveLength(8);
    const style = s.breakdown[6];
    expect(style?.label).toBe('Style: Windswept');
    expect(style?.weight).toBe(1.5);
    expect(s.breakdown.at(-1)?.isMultiplier).toBe(true);
  });
});
