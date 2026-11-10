import { describe, expect, it } from 'vitest';
import { seasonForDay } from './seasons';
import { createNewGameState } from './state';
import { addBranch, createTree } from './tree';
import {
  activeWireForBranch,
  applyWire,
  clipBranch,
  maxSafeBendDeg,
  pruneBranch,
  pruneCheck,
  removeWire,
  wireTrunk,
} from './training';
import { TUTORIAL_TAKE_CUTTING, TUTORIAL_TRAIN } from './tutorial';
import type { BonsaiTree, GameState } from './types';

function fixture(): { state: GameState; tree: BonsaiTree } {
  const state = createNewGameState();
  state.day = 10;
  const tree = createTree('juniper', 'seed', 99);
  // girth = max(2, length * 0.3) = 2 mm, so maxSafe = 60 - 0.2 * 20 = 56.
  addBranch(tree, -1, 1, 0, 5);
  addBranch(tree, -1, 1.5, 180, 4);
  addBranch(tree, -1, 1.8, 90, 6);
  return { state, tree };
}

describe('applyWire', () => {
  it('consumes 1 wire, sets both bends and records the wire', () => {
    const { state, tree } = fixture();
    const rev = tree.revision;
    expect(applyWire(tree, state, 1, 15, 5)).toBe(true);
    expect(state.inventory.wire).toBe(9);
    const b = tree.branches[1];
    expect(b?.wired).toBe(true);
    expect(b?.bend).toBe(15);
    expect(b?.bendV).toBe(5);
    expect(tree.wiresApplied).toEqual([
      { branchId: 1, appliedDay: 10, removedDay: -1, bendTarget: 15, bendTargetV: 5 },
    ]);
    expect(tree.revision).toBe(rev + 1);
  });

  it('refuses with no wire', () => {
    const { state, tree } = fixture();
    state.inventory.wire = 0;
    expect(applyWire(tree, state, 0, 15)).toBe(false);
    expect(tree.branches[0]?.wired).toBe(false);
    expect(tree.wiresApplied).toEqual([]);
  });

  it('refuses invalid branch ids without consuming wire', () => {
    const { state, tree } = fixture();
    expect(applyWire(tree, state, -1, 15)).toBe(false);
    expect(applyWire(tree, state, 3, 15)).toBe(false);
    expect(state.inventory.wire).toBe(10);
  });

  it('costs 10 vitality on crossing the safe threshold, once', () => {
    const { state, tree } = fixture();
    applyWire(tree, state, 0, 56);
    expect(tree.vitality).toBe(100);
    applyWire(tree, state, 0, 57);
    expect(tree.vitality).toBe(90);
    applyWire(tree, state, 0, 80);
    expect(tree.vitality).toBe(90);
  });

  it('judges the threshold on the combined magnitude', () => {
    const { state, tree } = fixture();
    // sqrt(40^2 + 40^2) ~ 56.6 > 56
    applyWire(tree, state, 0, 40, 40);
    expect(tree.vitality).toBe(90);
  });

  it('lets a young branch take the first 15-degree click without cost', () => {
    const { state, tree } = fixture();
    applyWire(tree, state, 0, 15);
    applyWire(tree, state, 0, 30);
    applyWire(tree, state, 0, 45);
    expect(tree.vitality).toBe(100);
  });

  it('tightens the safe bend as the branch thickens', () => {
    const { state, tree } = fixture();
    const branch = tree.branches[0];
    if (branch === undefined) throw new Error('fixture has no branch 0');
    branch.girth = 25; // 2.5 cm: maxSafe = 60 - 2.5 * 20 = 10
    applyWire(tree, state, 0, 10);
    expect(tree.vitality).toBe(100);
    applyWire(tree, state, 0, 11);
    expect(tree.vitality).toBe(90);
  });

  it('advances the tutorial from the train step', () => {
    const { state, tree } = fixture();
    state.tutorialStep = TUTORIAL_TRAIN;
    applyWire(tree, state, 0, 10);
    expect(state.tutorialStep).toBe(TUTORIAL_TAKE_CUTTING);
  });
});

describe('maxSafeBendDeg', () => {
  it('reads girth in centimetres: 60 minus 20 per cm', () => {
    expect(maxSafeBendDeg(0)).toBe(60);
    expect(maxSafeBendDeg(2)).toBe(56);
    expect(maxSafeBendDeg(3.6)).toBeCloseTo(52.8, 10);
    expect(maxSafeBendDeg(25)).toBe(10);
    expect(maxSafeBendDeg(30)).toBe(0);
  });

  it('is negative past 3 cm, so any wire there costs vitality', () => {
    expect(maxSafeBendDeg(40)).toBeLessThan(0);
  });
});

describe('removeWire', () => {
  it('springs both bends back to 30% when removed inside 56 days', () => {
    const { state, tree } = fixture();
    applyWire(tree, state, 0, 30, -20);
    state.day += 55;
    removeWire(tree, state, 0);
    const b = tree.branches[0];
    expect(b?.wired).toBe(false);
    expect(b?.bend).toBeCloseTo(9, 10);
    expect(b?.bendV).toBeCloseTo(-6, 10);
    expect(tree.wiresApplied[0]?.removedDay).toBe(65);
    expect(activeWireForBranch(tree, 0)).toBeUndefined();
  });

  it('keeps the bend once the wire has been on 56 days', () => {
    const { state, tree } = fixture();
    applyWire(tree, state, 0, 30, -20);
    state.day += 56;
    removeWire(tree, state, 0);
    expect(tree.branches[0]?.bend).toBe(30);
    expect(tree.branches[0]?.bendV).toBe(-20);
  });

  it('only closes the active record', () => {
    const { state, tree } = fixture();
    applyWire(tree, state, 0, 10);
    removeWire(tree, state, 0);
    state.day = 20;
    applyWire(tree, state, 0, 10);
    removeWire(tree, state, 0);
    expect(tree.wiresApplied.map((w) => w.removedDay)).toEqual([10, 20]);
  });
});

describe('activeWireForBranch', () => {
  it('returns the unremoved record for the branch or undefined', () => {
    const { state, tree } = fixture();
    expect(activeWireForBranch(tree, 2)).toBeUndefined();
    applyWire(tree, state, 2, 10);
    expect(activeWireForBranch(tree, 2)?.bendTarget).toBe(10);
    expect(activeWireForBranch(tree, 1)).toBeUndefined();
  });
});

describe('clipBranch', () => {
  it('shortens the branch, clamps at 1 cm and thins foliage 0.05', () => {
    const { state, tree } = fixture();
    expect(clipBranch(tree, state, 0, 2)).toBe(true);
    expect(tree.branches[0]?.length).toBe(3);
    expect(tree.foliageDensity).toBeCloseTo(0.05, 10);
    clipBranch(tree, state, 0, 10);
    expect(tree.branches[0]?.length).toBe(1);
    expect(tree.foliageDensity).toBe(0);
    expect(tree.clipsHistory).toEqual([
      { branchId: 0, day: 10, amount: 2 },
      { branchId: 0, day: 10, amount: 10 },
    ]);
  });

  it('returns false for invalid ids', () => {
    const { state, tree } = fixture();
    expect(clipBranch(tree, state, -1, 1)).toBe(false);
    expect(clipBranch(tree, state, 3, 1)).toBe(false);
    expect(tree.clipsHistory).toEqual([]);
  });
});

/** A day in the middle of the first winter (days 85 to 112). */
const WINTER_DAY = 100;

describe('pruneCheck', () => {
  it.each([
    [0, 'spring'],
    [1, 'spring'],
    [28, 'spring'],
    [29, 'summer'],
    [56, 'summer'],
    [57, 'autumn'],
    [84, 'autumn'],
    [113, 'spring'],
    [196, 'autumn'],
  ])('refuses on day %i (%s) as out of season', (day, season) => {
    const { state, tree } = fixture();
    state.day = day;
    expect(seasonForDay(day)).toBe(season);
    expect(pruneCheck(tree, 0, state)).toBe('out_of_season');
  });

  it.each([85, WINTER_DAY, 112, 197, 224])('allows day %i, in winter', (day) => {
    const { state, tree } = fixture();
    state.day = day;
    expect(seasonForDay(day)).toBe('winter');
    expect(pruneCheck(tree, 0, state)).toBe('ok');
  });

  it('names a missing branch in winter, and the season before the branch', () => {
    const { state, tree } = fixture();
    state.day = WINTER_DAY;
    expect(pruneCheck(tree, -1, state)).toBe('no_branch');
    expect(pruneCheck(tree, 3, state)).toBe('no_branch');
    state.day = 10;
    expect(pruneCheck(tree, 3, state)).toBe('out_of_season');
  });
});

describe('pruneBranch', () => {
  it('removes the branch, renumbers survivors and thins foliage 0.1', () => {
    const { state, tree } = fixture();
    state.day = WINTER_DAY;
    tree.foliageDensity = 0.5;
    expect(pruneBranch(tree, state, 1)).toBe(true);
    expect(tree.branches.map((b) => b.id)).toEqual([0, 1]);
    expect(tree.branches.map((b) => b.angle)).toEqual([0, 90]);
    expect(tree.foliageDensity).toBeCloseTo(0.4, 10);
    expect(tree.prunesHistory).toEqual([{ branchId: 1, day: WINTER_DAY }]);
  });

  it('returns false for invalid ids', () => {
    const { state, tree } = fixture();
    state.day = WINTER_DAY;
    expect(pruneBranch(tree, state, -1)).toBe(false);
    expect(pruneBranch(tree, state, 3)).toBe(false);
    expect(tree.branches).toHaveLength(3);
  });

  it.each([0, 29, 57, 84, 113])('refuses on day %i, outside winter, and changes nothing', (day) => {
    const { state, tree } = fixture();
    applyWire(tree, state, 1, 10);
    clipBranch(tree, state, 2, 1);
    state.day = day;
    state.tutorialStep = TUTORIAL_TRAIN;
    const before = structuredClone(tree);
    expect(pruneBranch(tree, state, 1)).toBe(false);
    expect(tree).toEqual(before);
    expect(tree.revision).toBe(before.revision);
    expect(state.tutorialStep).toBe(TUTORIAL_TRAIN);
  });

  it('leaves clipping open in every season', () => {
    for (const day of [10, 40, 70, WINTER_DAY]) {
      const { state, tree } = fixture();
      state.day = day;
      expect(clipBranch(tree, state, 0, 1)).toBe(true);
      expect(tree.branches[0]?.length).toBe(4);
    }
  });
});

describe('wireTrunk', () => {
  it('consumes 1 wire and appends a movement event', () => {
    const { state, tree } = fixture();
    const rev = tree.revision;
    expect(wireTrunk(tree, state, 5, 90)).toBe(true);
    expect(state.inventory.wire).toBe(9);
    expect(tree.trunk.movement).toEqual([{ y: 5, angleDeg: 90 }]);
    expect(tree.revision).toBe(rev + 1);
  });

  it('refuses with no wire', () => {
    const { state, tree } = fixture();
    state.inventory.wire = 0;
    expect(wireTrunk(tree, state, 5, 90)).toBe(false);
    expect(tree.trunk.movement).toEqual([]);
  });
});
