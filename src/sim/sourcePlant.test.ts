import { describe, expect, it } from 'vitest';
import { MAX_CUTTINGS, REGROW_DAYS, createSourcePlant, takeCutting } from './sourcePlant';
import { createNewGameState } from './state';
import { TUTORIAL_PLANT, TUTORIAL_TAKE_CUTTING, TUTORIAL_WATER } from './tutorial';

describe('takeCutting', () => {
  it('adds a juniper cutting and says how many are held, two spaces before the count', () => {
    const state = createNewGameState();
    const plant = createSourcePlant();
    expect(takeCutting(state, plant, 'juniper')).toBe('Took a Juniper cutting  (1 in inventory)');
    expect(state.inventory.cutting_juniper).toBe(1);
    expect(plant).toEqual({ cuttingsTaken: 1, regrowDay: -1 });
  });

  it('refuses species that do not grow from cuttings and changes nothing', () => {
    const state = createNewGameState();
    const before = { ...state.inventory };
    const plant = createSourcePlant();
    expect(takeCutting(state, plant, 'maple')).toBe(
      "Japanese Maple can't be grown from cuttings - try seeds",
    );
    expect(takeCutting(state, plant, 'pine')).toBe("Pine can't be grown from cuttings - try seeds");
    expect(state.inventory).toEqual(before);
    expect(plant).toEqual(createSourcePlant());
  });

  it('recovers for 14 days after the third cutting, then offers cuttings again', () => {
    expect([MAX_CUTTINGS, REGROW_DAYS]).toEqual([3, 14]);
    const state = createNewGameState();
    state.day = 20;
    const plant = createSourcePlant();
    takeCutting(state, plant, 'juniper');
    takeCutting(state, plant, 'juniper');
    expect(takeCutting(state, plant, 'juniper')).toBe(
      'Took a Juniper cutting  (3 in inventory) - plant now recovering',
    );
    expect(plant).toEqual({ cuttingsTaken: 0, regrowDay: 34 });

    state.day = 33;
    expect(takeCutting(state, plant, 'juniper')).toBe('This plant is recovering - ready on day 34');
    expect(state.inventory.cutting_juniper).toBe(3);

    state.day = 34;
    expect(takeCutting(state, plant, 'juniper')).toBe('Took a Juniper cutting  (4 in inventory)');
  });

  it('advances the tutorial only from its Take a cutting step', () => {
    const state = createNewGameState();
    expect(state.tutorialStep).toBe(TUTORIAL_WATER);
    takeCutting(state, createSourcePlant(), 'juniper');
    expect(state.tutorialStep).toBe(TUTORIAL_WATER);
    state.tutorialStep = TUTORIAL_TAKE_CUTTING;
    takeCutting(state, createSourcePlant(), 'maple');
    expect(state.tutorialStep).toBe(TUTORIAL_TAKE_CUTTING);
    takeCutting(state, createSourcePlant(), 'juniper');
    expect(state.tutorialStep).toBe(TUTORIAL_PLANT);
  });
});
