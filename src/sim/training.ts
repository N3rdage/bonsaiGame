/**
 * Training actions: branch wiring, wire removal, clipping, pruning and trunk
 * wiring. Every mutation bumps `tree.revision` via `markDirty`.
 *
 * Ported from archive/gamemaker/scripts/scr_training/scr_training.gml.
 */

import { inventoryRemove } from './inventory';
import { markDirty } from './tree';
import { TUTORIAL_TRAIN, tutorialAdvanceIf } from './tutorial';
import type { BonsaiTree, GameState, WireRecord } from './types';

/** A wire removed sooner than this many days springs the bend back. */
const WIRE_SET_DAYS = 56;
/** Fraction of the bend kept when a wire comes off before it set. */
const WIRE_SPRING_BACK = 0.3;
/** Degrees of bend a branch of zero girth takes safely. */
const SAFE_BEND_BASE_DEG = 60;
/** Degrees of safe bend lost per centimetre of branch girth. */
const SAFE_BEND_PER_CM_DEG = 20;
/** Vitality lost the moment a wire takes a branch past its safe bend. */
const UNSAFE_BEND_VITALITY_COST = 10;

/**
 * The largest combined bend (degrees) a branch of `girthMm` takes without
 * costing vitality. The prototype wrote `60 - girth * 20` with girth in
 * millimetres, which made every branch in the game unsafe at any bend; by
 * decision (backlog #27, option B) the formula reads girth in centimetres, so
 * a 2 mm branch takes 56 degrees and a 3 cm branch none.
 */
export function maxSafeBendDeg(girthMm: number): number {
  return SAFE_BEND_BASE_DEG - (girthMm / 10) * SAFE_BEND_PER_CM_DEG;
}

/**
 * Wire a branch to a target bend (horizontal and vertical, degrees). Consumes
 * 1 wire. Costs 10 vitality only when the combined bend magnitude crosses into
 * the unsafe zone (above `maxSafeBendDeg`), not for staying there.
 */
export function applyWire(
  tree: BonsaiTree,
  state: GameState,
  branchId: number,
  targetBendDeg: number,
  targetBendVDeg = 0,
): boolean {
  const branch = tree.branches[branchId];
  if (branchId < 0 || branch === undefined) return false;
  if (!inventoryRemove(state.inventory, 'wire', 1)) return false;

  const oldBend = branch.bend;
  const oldBendV = branch.bendV;
  branch.wired = true;
  branch.bend = targetBendDeg;
  branch.bendV = targetBendVDeg;

  tree.wiresApplied.push({
    branchId,
    appliedDay: state.day,
    removedDay: -1,
    bendTarget: targetBendDeg,
    bendTargetV: targetBendVDeg,
  });

  const maxSafe = maxSafeBendDeg(branch.girth);
  const oldMag = Math.sqrt(oldBend * oldBend + oldBendV * oldBendV);
  const newMag = Math.sqrt(targetBendDeg * targetBendDeg + targetBendVDeg * targetBendVDeg);
  if (oldMag <= maxSafe && newMag > maxSafe) {
    tree.vitality -= UNSAFE_BEND_VITALITY_COST;
  }

  markDirty(tree);
  tutorialAdvanceIf(state, TUTORIAL_TRAIN);
  return true;
}

/** Take the wire off a branch. Removed before it set, both bends spring back to 30%. */
export function removeWire(tree: BonsaiTree, state: GameState, branchId: number): void {
  const branch = tree.branches[branchId];
  if (branch === undefined) return;
  branch.wired = false;
  const wire = activeWireForBranch(tree, branchId);
  if (wire !== undefined) {
    wire.removedDay = state.day;
    const duration = wire.removedDay - wire.appliedDay;
    if (duration < WIRE_SET_DAYS) {
      branch.bend *= WIRE_SPRING_BACK;
      branch.bendV *= WIRE_SPRING_BACK;
    }
  }
  markDirty(tree);
}

/** The branch's wire record that has not been removed yet, if any. */
export function activeWireForBranch(tree: BonsaiTree, branchId: number): WireRecord | undefined {
  return tree.wiresApplied.find((w) => w.branchId === branchId && w.removedDay === -1);
}

/** Shorten a branch by `amountCm` (minimum length 1 cm); thins foliage by 0.05. */
export function clipBranch(
  tree: BonsaiTree,
  state: GameState,
  branchId: number,
  amountCm: number,
): boolean {
  const branch = tree.branches[branchId];
  if (branchId < 0 || branch === undefined) return false;

  branch.length = Math.max(1, branch.length - amountCm);
  tree.foliageDensity = Math.max(0, tree.foliageDensity - 0.05);

  tree.clipsHistory.push({ branchId, day: state.day, amount: amountCm });

  markDirty(tree);
  tutorialAdvanceIf(state, TUTORIAL_TRAIN);
  return true;
}

/** Remove a branch entirely and renumber the survivors; thins foliage by 0.1. */
export function pruneBranch(tree: BonsaiTree, state: GameState, branchId: number): boolean {
  if (branchId < 0 || branchId >= tree.branches.length) return false;

  tree.branches.splice(branchId, 1);
  tree.branches.forEach((b, i) => {
    b.id = i;
  });
  // Keep history ids aligned with the renumbered branches. The prototype did
  // not, so after a prune its wire records pointed at the wrong branch; the
  // pruned branch's wire is retired (it left with the branch) and records
  // above the gap shift down. Prune records are a log and keep the id as it
  // was on the day.
  for (const w of tree.wiresApplied) {
    if (w.branchId === branchId) {
      if (w.removedDay === -1) w.removedDay = state.day;
      w.branchId = -1;
    } else if (w.branchId > branchId) {
      w.branchId -= 1;
    }
  }
  for (const c of tree.clipsHistory) {
    if (c.branchId === branchId) c.branchId = -1;
    else if (c.branchId > branchId) c.branchId -= 1;
  }
  tree.foliageDensity = Math.max(0, tree.foliageDensity - 0.1);

  tree.prunesHistory.push({ branchId, day: state.day });

  markDirty(tree);
  tutorialAdvanceIf(state, TUTORIAL_TRAIN);
  return true;
}

/** Add a trunk bend event at `heightCm` toward `angleDeg`. Consumes 1 wire. */
export function wireTrunk(
  tree: BonsaiTree,
  state: GameState,
  heightCm: number,
  angleDeg: number,
): boolean {
  if (!inventoryRemove(state.inventory, 'wire', 1)) return false;
  tree.trunk.movement.push({ y: heightCm, angleDeg });
  markDirty(tree);
  tutorialAdvanceIf(state, TUTORIAL_TRAIN);
  return true;
}
