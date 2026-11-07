/**
 * Linear-progress new-player onboarding. `state.tutorialStep` holds the
 * current step (or TUTORIAL_DONE if finished/skipped). Gameplay call sites
 * advance the step via `tutorialAdvanceIf(state, step)` when the player
 * performs the matching action. New games start at TUTORIAL_WATER (the player
 * meets Granny's inherited juniper); saves without the field load as
 * TUTORIAL_DONE so veterans aren't dropped back into onboarding.
 *
 * New steps go before TUTORIAL_LAST and between existing steps, never after
 * TUTORIAL_DONE. Add any new step to `tutorialAllSteps` and the text functions.
 *
 * Ported from archive/gamemaker/scripts/scr_tutorial/scr_tutorial.gml.
 */

import type { GameState } from './types';

export const TUTORIAL_DONE = -1;
export const TUTORIAL_WATER = 0;
export const TUTORIAL_SKIP_WEEK = 1;
export const TUTORIAL_TRAIN = 2;
export const TUTORIAL_TAKE_CUTTING = 3;
export const TUTORIAL_PLANT = 4;

/** Sentinel: advancing from TUTORIAL_LAST jumps to TUTORIAL_DONE. */
export const TUTORIAL_LAST = TUTORIAL_PLANT;

export function tutorialInitForNewGame(state: GameState): void {
  state.tutorialStep = TUTORIAL_WATER;
}

/** Step to restore from a save; a missing field means TUTORIAL_DONE. */
export function tutorialStepFromSave(saved: number | undefined): number {
  return saved ?? TUTORIAL_DONE;
}

/**
 * No-op unless we're actually on the step the caller expects. This keeps call
 * sites idempotent: clicking Water at step TRAIN doesn't rewind us.
 */
export function tutorialAdvanceIf(state: GameState, from: number): void {
  if (state.tutorialStep !== from) return;
  state.tutorialStep = from >= TUTORIAL_LAST ? TUTORIAL_DONE : from + 1;
}

export function tutorialSkip(state: GameState): void {
  state.tutorialStep = TUTORIAL_DONE;
}

export function tutorialStepLabel(step: number): string {
  switch (step) {
    case TUTORIAL_WATER:
      return "Water Granny's juniper";
    case TUTORIAL_SKIP_WEEK:
      return 'Skip a week on the inspector';
    case TUTORIAL_TRAIN:
      return 'Train a branch in the 3D viewer';
    case TUTORIAL_TAKE_CUTTING:
      return 'Take a cutting from the source plant';
    case TUTORIAL_PLANT:
      return 'Plant your cutting at the workbench';
  }
  return '';
}

export function tutorialStepBody(step: number): string {
  switch (step) {
    case TUTORIAL_WATER:
      return "Press E on Granny's juniper to inspect it, then click Water.";
    case TUTORIAL_SKIP_WEEK:
      return 'On the inspector, click Skip 7d to fast-forward a week.';
    case TUTORIAL_TRAIN:
      return 'Inspect the tree, click Inspect 3D, pick a tool (Wire / Clip / Prune), then click a branch.';
    case TUTORIAL_TAKE_CUTTING:
      return 'Head out to the back garden and press E on the source plant.';
    case TUTORIAL_PLANT:
      return 'Press E on the workbench, select your cutting, and click Plant.';
  }
  return '';
}

/**
 * Longer flavour text for the notebook page, with the bonsai context the
 * corner panel doesn't have room for.
 */
export function tutorialStepFlavour(step: number): string {
  switch (step) {
    case TUTORIAL_WATER:
      return 'Bonsai dry out faster than houseplants - small pots, lots of leaf surface for their soil volume. Watch the Water bar in the inspector; below 30 the tree starts to suffer. A click of Water tops it back to 100.';
    case TUTORIAL_SKIP_WEEK:
      return "Real bonsai is a slow craft - you might wait a season for a branch to thicken. Skip 7d fast-forwards a week of care, costing fertilizer (it stands in for the daily attention you'd be giving the tree).";
    case TUTORIAL_TRAIN:
      return 'Three tools shape a tree. Wire bends a branch (sets permanently after about 8 weeks). Clip shortens a branch without removing it. Prune removes the branch entirely. Open the 3D viewer from the inspector, pick a mode, and click a branch.';
    case TUTORIAL_TAKE_CUTTING:
      return 'Junipers propagate easily from cuttings - snip a branch and root it in soil to get a clone of the parent. Source plants live in the back garden; each offers a few cuttings before needing time to recover.';
    case TUTORIAL_PLANT:
      return 'A cutting needs a pot to live in. The planting table at the workbench takes one cutting and one pot and creates a new tree at sapling size (8cm). Fancy pots cost more but earn more daily revenue when the tree is on display.';
    case TUTORIAL_DONE:
      return 'Granny would be proud. The basic care, training, and propagation loop is yours now. Try selling a tree once it scores well, or buying a fancier pot from the shop kiosk. The notebook stays - flip back here any time with J.';
  }
  return '';
}

/** Every tutorial step, oldest to newest. The notebook pages through this. */
export function tutorialAllSteps(): number[] {
  return [
    TUTORIAL_WATER,
    TUTORIAL_SKIP_WEEK,
    TUTORIAL_TRAIN,
    TUTORIAL_TAKE_CUTTING,
    TUTORIAL_PLANT,
  ];
}

/** "completed" if past it, "active" if on it, "locked" if not yet reached. */
export function tutorialStepStatus(
  state: GameState,
  step: number,
): 'completed' | 'active' | 'locked' {
  if (state.tutorialStep === TUTORIAL_DONE) return 'completed';
  if (step < state.tutorialStep) return 'completed';
  if (step === state.tutorialStep) return 'active';
  return 'locked';
}
