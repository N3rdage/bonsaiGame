import { describe, expect, it } from 'vitest';
import {
  CARRIED,
  DISPLAYED_PREFIX,
  addBranch,
  carriedTree,
  createTree,
  displayedPedestalKey,
  isDisplayed,
  isSold,
  markDirty,
  needsWater,
  pickUpTree,
  placeTree,
  putDownTree,
  spawnTree,
  treeOnPedestal,
  treesInRoom,
} from './tree';
import type { BonsaiTree, GameState } from './types';

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

describe('carrying, placing and putting down', () => {
  const world = (...locations: string[]) => {
    const trees: BonsaiTree[] = locations.map((location, id) => ({
      ...createTree('juniper', 'seed', id),
      location,
    }));
    const pick = (i: number): BonsaiTree => {
      const t = trees[i];
      if (!t) throw new Error(String(i));
      return t;
    };
    return { state: { trees } as unknown as GameState, trees, pick };
  };

  it('carries in the inventory location', () => {
    expect(CARRIED).toBe('inventory');
  });

  it('finds the floor trees of a room in order, the carried and the displayed trees', () => {
    const { state, trees } = world(
      'shed',
      'displayed:shed_main',
      'inventory',
      'sold',
      'garden',
      'shed',
    );
    expect(treesInRoom(state, 'shed')).toEqual([trees[0], trees[5]]);
    expect(treeOnPedestal(state, 'shed_main')).toBe(trees[1]);
    expect(treeOnPedestal(state, 'shed_window')).toBeUndefined();
    expect(carriedTree(state)).toBe(trees[2]);
    expect(carriedTree(world('shed').state)).toBeUndefined();
  });

  it('picks up from the floor or a pedestal without touching the revision', () => {
    const { state, pick } = world('shed', 'displayed:shed_main');
    expect(pickUpTree(state, pick(0))).toBe(true);
    expect(pick(0).location).toBe('inventory');
    expect(pick(0).revision).toBe(0);
    expect(putDownTree(pick(0), 'shed')).toBe(true);
    expect(pickUpTree(state, pick(1))).toBe(true);
    expect(pick(1).location).toBe('inventory');
  });

  it('refuses a second pickup and changes nothing', () => {
    const { state, trees, pick } = world('shed', 'displayed:shed_main');
    expect(pickUpTree(state, pick(0))).toBe(true);
    expect(pickUpTree(state, pick(1))).toBe(false);
    expect(trees.map((t) => t.location)).toEqual(['inventory', 'displayed:shed_main']);
  });

  it('places only a carried tree, only on an empty pedestal', () => {
    const { state, pick } = world('shed', 'displayed:shed_main');
    const floor = pick(0);
    expect(placeTree(state, floor, 'shed_window')).toBe(false);
    expect(floor.location).toBe('shed');
    pickUpTree(state, floor);
    expect(placeTree(state, floor, 'shed_main')).toBe(false);
    expect(floor.location).toBe('inventory');
    expect(placeTree(state, floor, 'shed_window')).toBe(true);
    expect(floor.location).toBe('displayed:shed_window');
    expect(carriedTree(state)).toBeUndefined();
  });

  it('puts down only a carried tree', () => {
    const { state, pick } = world('displayed:shed_main');
    const shown = pick(0);
    expect(putDownTree(shown, 'shed')).toBe(false);
    expect(shown.location).toBe('displayed:shed_main');
    pickUpTree(state, shown);
    expect(putDownTree(shown, 'shed')).toBe(true);
    expect(shown.location).toBe('shed');
  });
});
