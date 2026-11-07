import { describe, expect, it } from 'vitest';
import {
  DISPLAYED_PREFIX,
  addBranch,
  createTree,
  displayedPedestalKey,
  isDisplayed,
  isSold,
  markDirty,
  needsWater,
  spawnTree,
} from './tree';
import type { GameState } from './types';

describe('createTree', () => {
  it('applies the prototype defaults', () => {
    const t = createTree('pine', 'seed', 7);
    expect(t.id).toBe(7);
    expect(t.name).toBe('');
    expect(t.ageDays).toBe(0);
    expect(t.vitality).toBe(100);
    expect(t.vigor).toBe(50);
    expect(t.waterLevel).toBe(50);
    expect(t.fertilizedUntilDay).toBe(0);
    expect(t.location).toBe('inventory');
    expect(t.timeAccel).toBe(1.0);
    expect(t.trunk.taper).toBe(0.7);
    expect(t.trunk.movement).toEqual([]);
    expect(t.potTier).toBe(0);
    expect(t.soilTier).toBe(0);
    expect(t.targetStyle).toBe('');
    expect(t.revision).toBe(0);
  });

  it('gives cuttings a small structure', () => {
    const t = createTree('juniper', 'cutting', 0);
    expect(t.trunk.heightCm).toBe(8);
    expect(t.trunk.girthMm).toBe(4);
    expect(t.foliageDensity).toBe(0.25);
    expect(t.branches).toEqual([
      {
        id: 0,
        parentId: -1,
        originY: 3,
        angle: 45,
        length: 3,
        girth: 2,
        wired: false,
        bend: 0,
        bendV: 0,
      },
      {
        id: 1,
        parentId: -1,
        originY: 5,
        angle: 225,
        length: 2.5,
        girth: 2,
        wired: false,
        bend: 0,
        bendV: 0,
      },
    ]);
    // The constructor's own addBranch calls bump the counter, as they set mesh_dirty in GML.
    expect(t.revision).toBe(2);
  });

  it('starts seeds bare', () => {
    const t = createTree('maple', 'seed', 0);
    expect(t.trunk.heightCm).toBe(2);
    expect(t.trunk.girthMm).toBe(1.5);
    expect(t.foliageDensity).toBe(0.1);
    expect(t.branches).toEqual([]);
  });
});

describe('addBranch', () => {
  it('uses girth = max(2, length * 0.3) and bumps revision', () => {
    const t = createTree('pine', 'seed', 0);
    expect(addBranch(t, -1, 8, 30, 12)).toBe(0);
    expect(addBranch(t, -1, 9, 90, 5)).toBe(1);
    expect(t.branches[0]?.girth).toBeCloseTo(3.6);
    expect(t.branches[1]?.girth).toBe(2);
    expect(t.revision).toBe(2);
  });
});

describe('markDirty / needsWater', () => {
  it('markDirty increments revision', () => {
    const t = createTree('pine', 'seed', 0);
    markDirty(t);
    expect(t.revision).toBe(1);
  });

  it('needsWater below 30 only', () => {
    const t = createTree('pine', 'seed', 0);
    t.waterLevel = 30;
    expect(needsWater(t)).toBe(false);
    t.waterLevel = 29.9;
    expect(needsWater(t)).toBe(true);
  });
});

describe('spawnTree', () => {
  it('takes the next id and post-increments, without pushing', () => {
    const state = { nextTreeId: 4, trees: [] } as unknown as GameState;
    const a = spawnTree(state, 'juniper', 'cutting');
    const b = spawnTree(state, 'maple', 'seed');
    expect(a.id).toBe(4);
    expect(b.id).toBe(5);
    expect(state.nextTreeId).toBe(6);
    expect(state.trees).toEqual([]);
  });
});

describe('location helpers', () => {
  const at = (location: string) => ({ ...createTree('juniper', 'seed', 0), location });

  it('shed is neither displayed nor sold', () => {
    const t = at('shed');
    expect(isDisplayed(t)).toBe(false);
    expect(displayedPedestalKey(t)).toBeUndefined();
    expect(isSold(t)).toBe(false);
  });

  it('displayed:shed_main exposes the pedestal key', () => {
    const t = at(DISPLAYED_PREFIX + 'shed_main');
    expect(isDisplayed(t)).toBe(true);
    expect(displayedPedestalKey(t)).toBe('shed_main');
    expect(isSold(t)).toBe(false);
  });

  it('sold is sold', () => {
    const t = at('sold');
    expect(isSold(t)).toBe(true);
    expect(isDisplayed(t)).toBe(false);
  });
});
