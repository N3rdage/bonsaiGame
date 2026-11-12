import { describe, expect, it } from 'vitest';
import { seasonForDay } from './seasons';
import {
  MAX_CUTTINGS,
  REGROW_DAYS,
  SEED_SEASONS,
  createSourcePlant,
  nextCuttingSeasonDay,
  nextSeedSeasonDay,
  sourcePlantAction,
  sourcePlantPrompt,
  takeCutting,
  takeSeeds,
} from './sourcePlant';
import { createNewGameState } from './state';
import { TUTORIAL_PLANT, TUTORIAL_TAKE_CUTTING, TUTORIAL_WATER } from './tutorial';

describe('nextCuttingSeasonDay', () => {
  it('is the first day of the next spring on the 1-based season calendar', () => {
    expect(nextCuttingSeasonDay(0)).toBe(113);
    expect(nextCuttingSeasonDay(1)).toBe(113);
    expect(nextCuttingSeasonDay(56)).toBe(113);
    expect(nextCuttingSeasonDay(57)).toBe(113);
    expect(nextCuttingSeasonDay(84)).toBe(113);
    expect(nextCuttingSeasonDay(85)).toBe(113);
    expect(nextCuttingSeasonDay(112)).toBe(113);
    expect(nextCuttingSeasonDay(113)).toBe(225);
    expect(nextCuttingSeasonDay(224)).toBe(225);
    expect(seasonForDay(113)).toBe('spring');
    expect(seasonForDay(112)).toBe('winter');
  });
});

describe('takeCutting seasons', () => {
  const REFUSAL = 'Cuttings are taken in spring or summer - try again on day 113';

  it.each([0, 1, 28, 29, 56, 113])('takes a cutting on day %i, in spring or summer', (day) => {
    const state = createNewGameState();
    state.day = day;
    expect(['spring', 'summer']).toContain(seasonForDay(day));
    expect(takeCutting(state, createSourcePlant(), 'juniper')).toBe(
      'Took a Juniper cutting  (1 in inventory)',
    );
  });

  it.each([57, 84, 85, 112])(
    'refuses on day %i, in autumn or winter, and changes nothing',
    (day) => {
      const state = createNewGameState();
      state.day = day;
      expect(['autumn', 'winter']).toContain(seasonForDay(day));
      state.tutorialStep = TUTORIAL_TAKE_CUTTING;
      const before = { ...state.inventory };
      const plant = createSourcePlant();
      expect(takeCutting(state, plant, 'juniper')).toBe(REFUSAL);
      expect(state.inventory).toEqual(before);
      expect(plant).toEqual({ cuttingsTaken: 0, regrowDay: -1 });
      expect(state.tutorialStep).toBe(TUTORIAL_TAKE_CUTTING);
    },
  );

  it('names the next spring of a later year', () => {
    const state = createNewGameState();
    state.day = 200;
    expect(takeCutting(state, createSourcePlant(), 'juniper')).toBe(
      'Cuttings are taken in spring or summer - try again on day 225',
    );
  });

  it('says the plant is recovering before the season refusal', () => {
    const state = createNewGameState();
    state.day = 60;
    const plant = { cuttingsTaken: 0, regrowDay: 70 };
    expect(takeCutting(state, plant, 'juniper')).toBe('This plant is recovering - ready on day 70');
  });

  it('says the species does not grow from cuttings before the season refusal', () => {
    const state = createNewGameState();
    state.day = 60;
    expect(takeCutting(state, createSourcePlant(), 'maple')).toBe(
      "Japanese Maple can't be grown from cuttings - try seeds",
    );
  });
});

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

  it('a plant that gave three cuttings in summer refuses seeds in autumn while it recovers', () => {
    const state = createNewGameState();
    state.day = 50;
    const plant = createSourcePlant();
    for (let i = 0; i < MAX_CUTTINGS; i++) takeCutting(state, plant, 'juniper');
    expect(plant.regrowDay).toBe(64);
    state.day = 60;
    const before = { ...state.inventory };
    expect(takeSeeds(state, plant, 'juniper')).toBe('This plant is recovering - ready on day 64');
    expect(state.inventory).toEqual(before);
    state.day = 64;
    expect(takeSeeds(state, plant, 'juniper')).toBe('Took a Juniper seed  (2 in inventory)');
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

describe('nextSeedSeasonDay', () => {
  it('is the first day of the next autumn', () => {
    expect(SEED_SEASONS).toEqual(['autumn']);
    expect([0, 1, 56].map(nextSeedSeasonDay)).toEqual([57, 57, 57]);
    expect([57, 84, 85, 112, 113, 168].map(nextSeedSeasonDay)).toEqual([
      169, 169, 169, 169, 169, 169,
    ]);
    expect(nextSeedSeasonDay(169)).toBe(281);
    expect(seasonForDay(57)).toBe('autumn');
    expect(seasonForDay(169)).toBe('autumn');
  });
});

describe('sourcePlantAction and sourcePlantPrompt', () => {
  it.each([
    [1, 'spring', 'cutting', 'Take Cutting'],
    [29, 'summer', 'cutting', 'Take Cutting'],
    [57, 'autumn', 'seed', 'Take Seeds'],
    [84, 'autumn', 'seed', 'Take Seeds'],
    [85, 'winter', 'cutting', 'Take Cutting'],
  ])('day %i (%s): %s, prompt %s', (day, season, action, prompt) => {
    expect(seasonForDay(day)).toBe(season);
    expect(sourcePlantAction(day)).toBe(action);
    expect(sourcePlantPrompt(day)).toBe(prompt);
  });
});

describe('takeSeeds', () => {
  it.each([
    ['juniper', 'seed_juniper', 'Juniper'],
    ['maple', 'seed_maple', 'Japanese Maple'],
    ['pine', 'seed_pine', 'Pine'],
  ] as const)('adds one %s seed in autumn and nothing else', (species, key, name) => {
    const state = createNewGameState();
    state.day = 60;
    const before = { ...state.inventory };
    const plant = createSourcePlant();
    expect(takeSeeds(state, plant, species)).toBe(
      `Took a ${name} seed  (${String(before[key] + 1)} in inventory)`,
    );
    expect(state.inventory).toEqual({ ...before, [key]: before[key] + 1 });
    expect(plant).toEqual({ cuttingsTaken: 1, regrowDay: -1 });
  });

  it.each([1, 28, 29, 56, 85, 112, 113])(
    'refuses on day %i, outside autumn, naming the next autumn, and changes nothing',
    (day) => {
      const state = createNewGameState();
      state.day = day;
      state.tutorialStep = TUTORIAL_TAKE_CUTTING;
      const before = { ...state.inventory };
      const plant = createSourcePlant();
      expect(takeSeeds(state, plant, 'maple')).toBe(
        `Seeds are taken in autumn - try again on day ${String(nextSeedSeasonDay(day))}`,
      );
      expect(state.inventory).toEqual(before);
      expect(plant).toEqual(createSourcePlant());
      expect(state.tutorialStep).toBe(TUTORIAL_TAKE_CUTTING);
    },
  );

  it('recovers for 14 days after the third take, sharing the cutting counters', () => {
    const state = createNewGameState();
    state.day = 70;
    const plant = createSourcePlant();
    takeSeeds(state, plant, 'pine');
    takeSeeds(state, plant, 'pine');
    expect(takeSeeds(state, plant, 'pine')).toBe(
      'Took a Pine seed  (3 in inventory) - plant now recovering',
    );
    expect(plant).toEqual({ cuttingsTaken: 0, regrowDay: 70 + REGROW_DAYS });
    state.day = 83;
    expect(takeSeeds(state, plant, 'pine')).toBe('This plant is recovering - ready on day 84');
    expect(state.inventory.seed_pine).toBe(3);
  });

  it('does not advance the tutorial', () => {
    const state = createNewGameState();
    state.day = 60;
    state.tutorialStep = TUTORIAL_TAKE_CUTTING;
    takeSeeds(state, createSourcePlant(), 'juniper');
    expect(state.tutorialStep).toBe(TUTORIAL_TAKE_CUTTING);
  });
});
