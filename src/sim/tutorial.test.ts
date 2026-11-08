import { describe, expect, it } from 'vitest';
import {
  TUTORIAL_DONE,
  TUTORIAL_LAST,
  TUTORIAL_PLANT,
  TUTORIAL_SKIP_WEEK,
  TUTORIAL_TAKE_CUTTING,
  TUTORIAL_TRAIN,
  TUTORIAL_WATER,
  tutorialAdvanceIf,
  tutorialAllSteps,
  tutorialInitForNewGame,
  tutorialSkip,
  tutorialStepBody,
  tutorialStepFlavour,
  tutorialStepFromSave,
  tutorialStepLabel,
  tutorialStepStatus,
} from './tutorial';
import type { GameState } from './types';

function makeState(step: number): GameState {
  return {
    day: 0,
    money: 0,
    inventory: {} as GameState['inventory'],
    trees: [],
    nextTreeId: 0,
    tutorialStep: step,
    paused: false,
  };
}

describe('constants', () => {
  it('match the prototype macros', () => {
    expect([TUTORIAL_DONE, TUTORIAL_WATER, TUTORIAL_SKIP_WEEK, TUTORIAL_TRAIN]).toEqual([
      -1, 0, 1, 2,
    ]);
    expect([TUTORIAL_TAKE_CUTTING, TUTORIAL_PLANT, TUTORIAL_LAST]).toEqual([3, 4, 4]);
  });
});

describe('init / save', () => {
  it('new games start at WATER', () => {
    const s = makeState(TUTORIAL_DONE);
    tutorialInitForNewGame(s);
    expect(s.tutorialStep).toBe(TUTORIAL_WATER);
  });

  it('a missing save value means DONE', () => {
    expect(tutorialStepFromSave(undefined)).toBe(TUTORIAL_DONE);
    expect(tutorialStepFromSave(TUTORIAL_TRAIN)).toBe(TUTORIAL_TRAIN);
    expect(tutorialStepFromSave(TUTORIAL_WATER)).toBe(TUTORIAL_WATER);
  });
});

describe('tutorialAdvanceIf', () => {
  it('advances only from the matching step', () => {
    const s = makeState(TUTORIAL_TRAIN);
    tutorialAdvanceIf(s, TUTORIAL_WATER);
    expect(s.tutorialStep).toBe(TUTORIAL_TRAIN);
    tutorialAdvanceIf(s, TUTORIAL_TRAIN);
    expect(s.tutorialStep).toBe(TUTORIAL_TAKE_CUTTING);
  });

  it('goes from the last step to DONE', () => {
    const s = makeState(TUTORIAL_LAST);
    tutorialAdvanceIf(s, TUTORIAL_LAST);
    expect(s.tutorialStep).toBe(TUTORIAL_DONE);
  });

  it('does nothing once DONE', () => {
    const s = makeState(TUTORIAL_DONE);
    tutorialAdvanceIf(s, TUTORIAL_WATER);
    expect(s.tutorialStep).toBe(TUTORIAL_DONE);
  });

  it('skip jumps to DONE', () => {
    const s = makeState(TUTORIAL_SKIP_WEEK);
    tutorialSkip(s);
    expect(s.tutorialStep).toBe(TUTORIAL_DONE);
  });
});

describe('tutorialStepStatus', () => {
  it('is completed before, active on, locked after the current step', () => {
    const s = makeState(TUTORIAL_TRAIN);
    expect(tutorialStepStatus(s, TUTORIAL_SKIP_WEEK)).toBe('completed');
    expect(tutorialStepStatus(s, TUTORIAL_TRAIN)).toBe('active');
    expect(tutorialStepStatus(s, TUTORIAL_PLANT)).toBe('locked');
  });

  it('is completed for everything when DONE', () => {
    const s = makeState(TUTORIAL_DONE);
    for (const step of tutorialAllSteps()) {
      expect(tutorialStepStatus(s, step)).toBe('completed');
    }
  });
});

describe('text', () => {
  it('lists every step in order', () => {
    expect(tutorialAllSteps()).toEqual([0, 1, 2, 3, 4]);
  });

  it('has label, body and flavour for every step', () => {
    for (const step of tutorialAllSteps()) {
      expect(tutorialStepLabel(step)).not.toBe('');
      expect(tutorialStepBody(step)).not.toBe('');
      expect(tutorialStepFlavour(step)).not.toBe('');
    }
    expect(tutorialStepLabel(TUTORIAL_WATER)).toBe("Water Granny's juniper");
  });

  it('has DONE flavour but no DONE label/body', () => {
    expect(tutorialStepFlavour(TUTORIAL_DONE)).toMatch(/^Granny would be proud\./);
    expect(tutorialStepLabel(TUTORIAL_DONE)).toBe('');
    expect(tutorialStepBody(TUTORIAL_DONE)).toBe('');
  });

  it('is ASCII only (the prototype font has no em-dashes)', () => {
    for (const step of [...tutorialAllSteps(), TUTORIAL_DONE]) {
      const text = tutorialStepLabel(step) + tutorialStepBody(step) + tutorialStepFlavour(step);
      expect(/^[\x20-\x7e]*$/.test(text)).toBe(true);
    }
  });
});
