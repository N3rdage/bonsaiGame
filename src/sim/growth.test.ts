import { describe, expect, it } from 'vitest';
import {
  FERTILIZER_DAYS,
  MAX_NATURAL_BRANCHES,
  REPOT_COOLDOWN_DAYS,
  fertilizeTree,
  repotCheck,
  repotTree,
  skipTreeTime,
  spawnBranchNaturally,
  treeDailyTick,
  waterTree,
} from './growth';
import { createNewGameState } from './state';
import { addBranch, createTree } from './tree';
import type { BonsaiTree, GameState } from './types';

const SUMMER = 29;
const WINTER = 85;
const SPRING_YEAR_2 = 120;
const NEVER = (): number => 0.99;
const ALWAYS = (): number => 0;

function fixture(day: number): { state: GameState; tree: BonsaiTree } {
  const state = createNewGameState();
  state.day = day;
  const tree = createTree('juniper', 'seed', 99);
  addBranch(tree, -1, 1, 0, 5);
  addBranch(tree, -1, 1.5, 180, 4);
  tree.vitality = 100;
  tree.vigor = 50;
  tree.waterLevel = 50;
  return { state, tree };
}

describe('treeDailyTick', () => {
  it('grows a juniper at exactly the base rates in summer (growth mult 1)', () => {
    const { state, tree } = fixture(SUMMER);
    // Vigor drifts 0.2 before the growth multiplier is computed, so start at
    // 50.2 to land on vigor/50 = 1 exactly.
    tree.vigor = 50.2;
    const before = structuredClone(tree);
    treeDailyTick(tree, state, false, NEVER);

    expect(tree.trunk.heightCm - before.trunk.heightCm).toBeCloseTo(0.02, 10);
    expect(tree.trunk.girthMm - before.trunk.girthMm).toBeCloseTo(0.05, 10);
    tree.branches.forEach((b, i) => {
      const old = before.branches[i];
      expect(b.length - (old?.length ?? 0)).toBeCloseTo(0.1, 10);
      expect(b.girth - (old?.girth ?? 0)).toBeCloseTo(0.01, 10);
    });
    expect(tree.foliageDensity - before.foliageDensity).toBeCloseTo(0.01, 10);
    expect(tree.branches).toHaveLength(2);
    expect(tree.ageDays).toBe(1);
    expect(tree.revision).toBe(before.revision + 1);
  });

  it('with vigor 50 the post-drift vigor (49.8) scales growth to 0.996', () => {
    const { state, tree } = fixture(SUMMER);
    treeDailyTick(tree, state, false, NEVER);
    expect(tree.trunk.heightCm).toBeCloseTo(2 + 0.02 * 0.996, 10);
  });

  it('juniper is dormant in winter: no morphology change, but ages, drifts and dries', () => {
    const { state, tree } = fixture(WINTER);
    const before = structuredClone(tree);
    treeDailyTick(tree, state, false, ALWAYS);

    expect(tree.trunk).toEqual(before.trunk);
    expect(tree.branches).toEqual(before.branches);
    expect(tree.foliageDensity).toBe(before.foliageDensity);
    expect(tree.ageDays).toBe(1);
    expect(tree.vigor).toBeCloseTo(49.8, 10);
    expect(tree.waterLevel).toBeCloseTo(50 - 0.8 * 5 * 0.3, 10);
  });

  it('water decays by waterNeed * 5 * 1.5 in summer', () => {
    const { state, tree } = fixture(SUMMER);
    treeDailyTick(tree, state, false, NEVER);
    expect(tree.waterLevel).toBeCloseTo(50 - 0.8 * 5 * 1.5, 10);
  });

  it('water floors at 0', () => {
    const { state, tree } = fixture(SUMMER);
    tree.waterLevel = 3;
    treeDailyTick(tree, state, false, NEVER);
    expect(tree.waterLevel).toBe(0);
  });

  it('isolated ticks do not decay water', () => {
    const { state, tree } = fixture(SUMMER);
    treeDailyTick(tree, state, true, NEVER);
    expect(tree.waterLevel).toBe(50);
  });

  it.each([
    [5, 0, 98],
    [95, 0, 99],
    [5, 1, 99],
    [95, 1, 99.5],
  ] as const)('water %d on soil tier %d takes vitality 100 to %d', (water, soil, expected) => {
    const { state, tree } = fixture(SUMMER);
    tree.waterLevel = water;
    tree.soilTier = soil;
    treeDailyTick(tree, state, true, NEVER);
    expect(tree.vitality).toBeCloseTo(expected, 10);
  });

  it('in-band water recovers 0.3 vitality, capped at 100', () => {
    const { state, tree } = fixture(SUMMER);
    tree.vitality = 50;
    treeDailyTick(tree, state, true, NEVER);
    expect(tree.vitality).toBeCloseTo(50.3, 10);
    tree.vitality = 99.9;
    treeDailyTick(tree, state, true, NEVER);
    expect(tree.vitality).toBe(100);
  });

  it('vitality clamps at 0', () => {
    const { state, tree } = fixture(SUMMER);
    tree.vitality = 1;
    tree.waterLevel = 0;
    treeDailyTick(tree, state, true, NEVER);
    expect(tree.vitality).toBe(0);
  });

  it('vigor drifts 0.2/day to a floor of 10, half as fast on premium soil', () => {
    const { state, tree } = fixture(SUMMER);
    treeDailyTick(tree, state, true, NEVER);
    expect(tree.vigor).toBeCloseTo(49.8, 10);
    tree.vigor = 10.1;
    treeDailyTick(tree, state, true, NEVER);
    expect(tree.vigor).toBe(10);

    const premium = fixture(SUMMER).tree;
    premium.soilTier = 1;
    treeDailyTick(premium, state, true, NEVER);
    expect(premium.vigor).toBeCloseTo(49.9, 10);
  });

  it('fertilised trees grow 1.5x while state.day < fertilizedUntilDay', () => {
    const { state, tree } = fixture(SUMMER);
    tree.vigor = 50.2;
    tree.fertilizedUntilDay = SUMMER + 1;
    treeDailyTick(tree, state, false, NEVER);
    expect(tree.trunk.heightCm).toBeCloseTo(2 + 0.03, 10);

    const expired = fixture(SUMMER).tree;
    expired.vigor = 50.2;
    expired.fertilizedUntilDay = SUMMER;
    treeDailyTick(expired, state, false, NEVER);
    expect(expired.trunk.heightCm).toBeCloseTo(2 + 0.02, 10);
  });

  it('trunk height stops at the species max but girth keeps growing', () => {
    const { state, tree } = fixture(SUMMER);
    tree.trunk.heightCm = 45;
    treeDailyTick(tree, state, false, NEVER);
    expect(tree.trunk.heightCm).toBe(45);
    expect(tree.trunk.girthMm).toBeGreaterThan(1.5);
  });

  it('spawns a branch when the rng roll is low, up to MAX_NATURAL_BRANCHES', () => {
    const { state, tree } = fixture(SUMMER);
    treeDailyTick(tree, state, false, ALWAYS);
    expect(tree.branches).toHaveLength(3);

    while (tree.branches.length < MAX_NATURAL_BRANCHES) addBranch(tree, -1, 1, 0, 2);
    treeDailyTick(tree, state, false, ALWAYS);
    expect(tree.branches).toHaveLength(15);
  });

  it('does not spawn when dormant even with the lowest roll', () => {
    const { state, tree } = fixture(WINTER);
    treeDailyTick(tree, state, false, ALWAYS);
    expect(tree.branches).toHaveLength(2);
  });
});

describe('spawnBranchNaturally', () => {
  it('follows the 0/180 alternation with 90 every third after the second', () => {
    const tree = createTree('juniper', 'seed', 1);
    tree.trunk.heightCm = 20;
    for (let i = 0; i < 9; i++) spawnBranchNaturally(tree, () => 0.5);
    expect(tree.branches.map((b) => b.angle)).toEqual([0, 180, 0, 180, 0, 90, 0, 180, 90]);
    expect(tree.branches.every((b) => b.length === 3)).toBe(true);
    // targetT = 0.3 + count * 0.08, clamped to [0.2, 0.95].
    expect(tree.branches[0]?.originY).toBeCloseTo(0.3 * 20, 10);
    expect(tree.branches[2]?.originY).toBeCloseTo(0.46 * 20, 10);
    expect(tree.branches[8]?.originY).toBeCloseTo(0.94 * 20, 10);
    spawnBranchNaturally(tree, () => 0.5);
    expect(tree.branches[9]?.originY).toBeCloseTo(0.95 * 20, 10);
  });

  it('maps rng to random_range offsets', () => {
    const tree = createTree('juniper', 'seed', 1);
    tree.trunk.heightCm = 10;
    spawnBranchNaturally(tree, () => 0);
    expect(tree.branches[0]?.angle).toBe(-30);
    expect(tree.branches[0]?.length).toBe(2);
    expect(tree.branches[0]?.originY).toBeCloseTo(0.25 * 10, 10);
  });
});

describe('waterTree', () => {
  it('fills to 100 and stamps the day', () => {
    const { state, tree } = fixture(SUMMER);
    waterTree(tree, state);
    expect(tree.waterLevel).toBe(100);
    expect(tree.lastWateredDay).toBe(SUMMER);
  });
});

describe('fertilizeTree', () => {
  it('refuses a dormant juniper in winter without consuming', () => {
    const { state, tree } = fixture(WINTER);
    const before = state.inventory.fertilizer;
    expect(fertilizeTree(tree, state)).toBe(false);
    expect(state.inventory.fertilizer).toBe(before);
    expect(tree.fertilizedUntilDay).toBe(0);
  });

  it('consumes exactly 1 and opens a 7-day window', () => {
    const { state, tree } = fixture(SUMMER);
    const before = state.inventory.fertilizer;
    expect(fertilizeTree(tree, state)).toBe(true);
    expect(state.inventory.fertilizer).toBe(before - 1);
    expect(tree.fertilizedUntilDay).toBe(SUMMER + FERTILIZER_DAYS);
    expect(tree.lastFedDay).toBe(SUMMER);
  });

  it('refuses with no fertiliser', () => {
    const { state, tree } = fixture(SUMMER);
    state.inventory.fertilizer = 0;
    expect(fertilizeTree(tree, state)).toBe(false);
    expect(tree.fertilizedUntilDay).toBe(0);
  });
});

describe('repotCheck', () => {
  it('is out_of_season outside spring', () => {
    const { state, tree } = fixture(SUMMER);
    expect(repotCheck(tree, state)).toBe('out_of_season');
  });

  it('is cooldown within 60 days of the last repot', () => {
    const { state, tree } = fixture(SPRING_YEAR_2);
    tree.lastRepotDay = SPRING_YEAR_2 - REPOT_COOLDOWN_DAYS + 1;
    expect(repotCheck(tree, state)).toBe('cooldown');
  });

  it('is ok in spring once the cooldown has passed', () => {
    const { state, tree } = fixture(SPRING_YEAR_2);
    tree.lastRepotDay = SPRING_YEAR_2 - REPOT_COOLDOWN_DAYS;
    expect(repotCheck(tree, state)).toBe('ok');
  });
});

describe('repotTree', () => {
  it('consumes a standard pot, resets vigor to 50 and records history', () => {
    const { state, tree } = fixture(SPRING_YEAR_2);
    tree.vigor = 20;
    const rev = tree.revision;
    expect(repotTree(tree, state, 0)).toBe(true);
    expect(state.inventory.pot).toBe(1);
    expect(tree.vigor).toBe(50);
    expect(tree.lastRepotDay).toBe(SPRING_YEAR_2);
    expect(tree.repotsHistory).toEqual([{ day: SPRING_YEAR_2, toTier: 0, soilTier: 0 }]);
    expect(tree.revision).toBe(rev + 1);
  });

  it('consumes a fancy pot and premium soil when both are in stock', () => {
    const { state, tree } = fixture(SPRING_YEAR_2);
    state.inventory.fancy_pot = 1;
    state.inventory.soil_premium = 2;
    expect(repotTree(tree, state, 1, 1)).toBe(true);
    expect(state.inventory.fancy_pot).toBe(0);
    expect(state.inventory.pot).toBe(2);
    expect(state.inventory.soil_premium).toBe(1);
    expect(tree.potTier).toBe(1);
    expect(tree.soilTier).toBe(1);
  });

  it('downgrades premium soil to basic when none is in stock', () => {
    const { state, tree } = fixture(SPRING_YEAR_2);
    expect(repotTree(tree, state, 0, 1)).toBe(true);
    expect(tree.soilTier).toBe(0);
    expect(tree.repotsHistory[0]?.soilTier).toBe(0);
  });

  it('refuses with no pot before consuming soil', () => {
    const { state, tree } = fixture(SPRING_YEAR_2);
    state.inventory.soil_premium = 1;
    expect(repotTree(tree, state, 1, 1)).toBe(false);
    expect(state.inventory.soil_premium).toBe(1);
    expect(tree.repotsHistory).toEqual([]);
  });

  it('refuses out of season without consuming', () => {
    const { state, tree } = fixture(SUMMER);
    expect(repotTree(tree, state, 0)).toBe(false);
    expect(state.inventory.pot).toBe(2);
  });
});

describe('skipTreeTime', () => {
  it.each([
    [1, 1],
    [7, 4],
    [14, 7],
  ])('skipping %d days costs %d fertiliser', (days, cost) => {
    const { state, tree } = fixture(SUMMER);
    const before = state.inventory.fertilizer;
    expect(skipTreeTime(tree, state, days, NEVER)).toBe(true);
    expect(state.inventory.fertilizer).toBe(before - cost);
    expect(tree.ageDays).toBe(days);
    expect(tree.waterLevel).toBe(50); // isolated ticks
    expect(state.day).toBe(SUMMER);
  });

  it('refuses when short and leaves everything unchanged', () => {
    const { state, tree } = fixture(SUMMER);
    state.inventory.fertilizer = 3;
    const before = structuredClone(tree);
    expect(skipTreeTime(tree, state, 7, NEVER)).toBe(false);
    expect(state.inventory.fertilizer).toBe(3);
    expect(tree).toEqual(before);
  });
});
