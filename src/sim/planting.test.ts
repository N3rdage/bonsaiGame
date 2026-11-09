import { describe, expect, it } from 'vitest';
import { makePot, plantCutting } from './planting';
import { createNewGameState } from './state';
import { TUTORIAL_DONE, TUTORIAL_PLANT, TUTORIAL_WATER } from './tutorial';

describe('makePot', () => {
  it('turns one clay into one pot and reports the counts after, two spaces after "pot"', () => {
    const state = createNewGameState();
    expect([state.inventory.clay, state.inventory.pot]).toEqual([5, 2]);
    expect(makePot(state)).toBe('Made a pot  (3 pots, 4 clay left)');
    expect([state.inventory.clay, state.inventory.pot]).toEqual([4, 3]);
  });

  it('refuses without clay and changes nothing', () => {
    const state = createNewGameState();
    state.inventory.clay = 0;
    const before = { ...state.inventory };
    expect(makePot(state)).toBe('Not enough clay to make a pot');
    expect(state.inventory).toEqual(before);
  });
});

describe('plantCutting', () => {
  const withCutting = () => {
    const state = createNewGameState();
    state.inventory.cutting_juniper = 2;
    state.inventory.fancy_pot = 1;
    state.inventory.soil_premium = 1;
    return state;
  };

  it('uses a pot and a cutting and puts New Juniper in the shed', () => {
    const state = withCutting();
    const before = { ...state.inventory };
    const tree = plantCutting(state, 'juniper', false, false);
    expect(state.inventory).toEqual({
      ...before,
      pot: before.pot - 1,
      cutting_juniper: before.cutting_juniper - 1,
    });
    expect(tree).toBe(state.trees[1]);
    expect(tree).toMatchObject({
      id: 1,
      speciesKey: 'juniper',
      origin: 'cutting',
      name: 'New Juniper',
      potTier: 0,
      soilTier: 0,
      location: 'shed',
      trunk: { heightCm: 8 },
    });
    expect(state.nextTreeId).toBe(2);
  });

  it('uses a fancy pot and premium soil when asked', () => {
    const state = withCutting();
    const before = { ...state.inventory };
    const tree = plantCutting(state, 'juniper', true, true);
    expect(state.inventory).toEqual({
      ...before,
      fancy_pot: 0,
      soil_premium: 0,
      cutting_juniper: before.cutting_juniper - 1,
    });
    expect([tree?.potTier, tree?.soilTier]).toEqual([1, 1]);
  });

  it('plants without soil when premium soil is asked for but out of stock', () => {
    const state = withCutting();
    state.inventory.soil_premium = 0;
    const tree = plantCutting(state, 'juniper', false, true);
    expect(tree?.soilTier).toBe(0);
    expect(state.inventory.soil_premium).toBe(0);
  });

  it('refuses without the chosen pot kind, or without the cutting, and consumes nothing', () => {
    const state = withCutting();
    state.inventory.fancy_pot = 0;
    const before = { ...state.inventory };
    expect(plantCutting(state, 'juniper', true, true)).toBeUndefined();
    state.inventory.pot = 0;
    expect(plantCutting(state, 'juniper', false, true)).toBeUndefined();
    state.inventory.pot = before.pot;
    expect(plantCutting(state, 'maple', false, true)).toBeUndefined();
    expect(plantCutting(state, 'pine', false, true)).toBeUndefined();
    expect(state.inventory).toEqual(before);
    expect(state.trees).toHaveLength(1);
    expect(state.nextTreeId).toBe(1);
  });

  it('names a maple by its display name', () => {
    const state = createNewGameState();
    state.inventory.cutting_maple = 1;
    expect(plantCutting(state, 'maple', false, false)?.name).toBe('New Japanese Maple');
    expect(state.inventory.cutting_maple).toBe(0);
  });

  it('advances the tutorial only from its Plant step', () => {
    const state = withCutting();
    expect(state.tutorialStep).toBe(TUTORIAL_WATER);
    plantCutting(state, 'juniper', false, false);
    expect(state.tutorialStep).toBe(TUTORIAL_WATER);
    state.tutorialStep = TUTORIAL_PLANT;
    plantCutting(state, 'juniper', false, false);
    expect(state.tutorialStep).toBe(TUTORIAL_DONE);
  });
});
