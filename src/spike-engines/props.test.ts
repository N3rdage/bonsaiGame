import { describe, expect, it } from 'vitest';
import { GARDEN_PROPS, MAX_PROPS, PROPS, propMatrices, splitProps } from './props';

describe('props', () => {
  it('holds the garden first and fills to the maximum', () => {
    expect(PROPS).toHaveLength(MAX_PROPS);
    expect(PROPS.slice(0, GARDEN_PROPS).every((p) => p.y > -3 && p.y < 16)).toBe(true);
  });

  it('keeps every spiral prop outside the garden', () => {
    for (const p of PROPS.slice(GARDEN_PROPS)) {
      const inside = p.x > -6 && p.x < 17 && p.y > -9 && p.y < 18.5;
      expect(inside).toBe(false);
    }
  });

  it('does not stand any two props on top of each other', () => {
    let nearest = Infinity;
    for (let i = 0; i < PROPS.length; i++) {
      for (let j = i + 1; j < PROPS.length; j++) {
        const a = PROPS[i];
        const b = PROPS[j];
        if (a && b) nearest = Math.min(nearest, Math.hypot(a.x - b.x, a.y - b.y));
      }
    }
    expect(nearest).toBeGreaterThan(1.5);
  });

  it('splits the first n props into trees and hedges', () => {
    expect(splitProps(0)).toEqual({ trees: 0, hedges: 0 });
    expect(splitProps(GARDEN_PROPS)).toEqual({ trees: 5, hedges: 4 });
    const all = splitProps(MAX_PROPS);
    expect(all.trees + all.hedges).toBe(MAX_PROPS);
    expect(splitProps(GARDEN_PROPS + 40).trees + splitProps(GARDEN_PROPS + 40).hedges).toBe(
      GARDEN_PROPS + 40,
    );
  });

  it('gives each prop one matrix of its kind, translated to its site', () => {
    const trees = propMatrices('tree');
    const hedges = propMatrices('hedge');
    expect(trees.length / 16 + hedges.length / 16).toBe(MAX_PROPS);
    const first = PROPS[0];
    expect(trees[12]).toBeCloseTo(first?.x ?? NaN);
    expect(trees[13]).toBe(0);
    expect(trees[14]).toBeCloseTo(first?.y ?? NaN);
    expect(trees[15]).toBe(1);
    // Scale: the columns have the prop's scale as their length.
    expect(Math.hypot(trees[0] ?? 0, trees[1] ?? 0, trees[2] ?? 0)).toBeCloseTo(
      first?.scale ?? NaN,
    );
  });
});
