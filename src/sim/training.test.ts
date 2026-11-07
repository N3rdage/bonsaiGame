import { describe, expect, it } from 'vitest';
import { createNewGameState } from './state';
import { addBranch, createTree } from './tree';
import {
  activeWireForBranch,
  applyWire,
  clipBranch,
  pruneBranch,
  removeWire,
  wireTrunk,
} from './training';
import { TUTORIAL_TAKE_CUTTING, TUTORIAL_TRAIN } from './tutorial';
import type { BonsaiTree, GameState } from './types';

function fixture(): { state: GameState; tree: BonsaiTree } {
  const state = createNewGameState();
  state.day = 10;
  const tree = createTree('juniper', 'seed', 99);
  // girth = max(2, length * 0.3) = 2, so maxSafe = 60 - 2 * 20 = 20.
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
    applyWire(tree, state, 0, 15);
    expect(tree.vitality).toBe(100);
    applyWire(tree, state, 0, 25);
    expect(tree.vitality).toBe(90);
    applyWire(tree, state, 0, 40);
    expect(tree.vitality).toBe(90);
  });

  it('judges the threshold on the combined magnitude', () => {
    const { state, tree } = fixture();
    // sqrt(15^2 + 15^2) ~ 21.2 > 20
    applyWire(tree, state, 0, 15, 15);
    expect(tree.vitality).toBe(90);
  });

  it('advances the tutorial from the train step', () => {
    const { state, tree } = fixture();
    state.tutorialStep = TUTORIAL_TRAIN;
    applyWire(tree, state, 0, 10);
    expect(state.tutorialStep).toBe(TUTORIAL_TAKE_CUTTING);
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

describe('pruneBranch', () => {
  it('removes the branch, renumbers survivors and thins foliage 0.1', () => {
    const { state, tree } = fixture();
    tree.foliageDensity = 0.5;
    expect(pruneBranch(tree, state, 1)).toBe(true);
    expect(tree.branches.map((b) => b.id)).toEqual([0, 1]);
    expect(tree.branches.map((b) => b.angle)).toEqual([0, 90]);
    expect(tree.foliageDensity).toBeCloseTo(0.4, 10);
    expect(tree.prunesHistory).toEqual([{ branchId: 1, day: 10 }]);
  });

  it('returns false for invalid ids', () => {
    const { state, tree } = fixture();
    expect(pruneBranch(tree, state, -1)).toBe(false);
    expect(pruneBranch(tree, state, 3)).toBe(false);
    expect(tree.branches).toHaveLength(3);
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
