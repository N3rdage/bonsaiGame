/**
 * Cross-module checks that no single module owns: the ported pieces working
 * together the way the prototype's game loop used them, plus the judgement
 * calls made during the port that a future reader might want to revisit.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { advanceDayAllTrees, roundHalfToEven } from './world';
import {
  deserializeSave,
  importPrototypeSave,
  MemorySaveStorage,
  mostRecentSaveSlot,
  saveGame,
  serializeState,
} from './save';
import { createNewGameState } from './state';
import { scoreTree } from './scoring';
import { applyWire, pruneBranch, removeWire, wireTrunk } from './training';
import { fertilizeTree, waterTree } from './growth';
import { seasonForDay } from './seasons';

const fixture = (name: string): string =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8');

describe('roundHalfToEven (GameMaker round semantics)', () => {
  it('rounds halves to the even neighbour and everything else normally', () => {
    expect(roundHalfToEven(6.5)).toBe(6);
    expect(roundHalfToEven(7.5)).toBe(8);
    expect(roundHalfToEven(6.4)).toBe(6);
    expect(roundHalfToEven(6.6)).toBe(7);
    expect(roundHalfToEven(0)).toBe(0);
  });
});

describe('a new game played for a season', () => {
  it('ages, grows, earns nothing without a pedestal, and survives a save round trip', () => {
    const state = createNewGameState();
    const starter = state.trees[0];
    expect(starter).toBeDefined();
    if (!starter) return;
    const heightBefore = starter.trunk.heightCm;
    const rng = () => 0.99; // never spawns a branch, keeps the run deterministic

    for (let day = 0; day < 28; day++) {
      waterTree(starter, state);
      advanceDayAllTrees(state, 1, rng);
    }

    expect(state.day).toBe(28);
    expect(seasonForDay(state.day)).toBe('spring');
    expect(starter.ageDays).toBe(28);
    expect(starter.trunk.heightCm).toBeGreaterThan(heightBefore);
    expect(state.money).toBe(100); // starter sits in the shed, not on a pedestal

    const text = serializeState(state, new Date(2026, 10, 7, 12, 0));
    const back = deserializeSave(text);
    expect(back).toEqual(state);
  });

  it("pays display revenue with banker's rounding once a tree is on a pedestal", () => {
    const state = createNewGameState();
    const starter = state.trees[0];
    if (!starter) throw new Error('no starter');
    starter.location = 'displayed:shed_main';
    const expected = roundHalfToEven(scoreTree(starter).total * 0.1);
    const earned = advanceDayAllTrees(state, 1, () => 0.99);
    // Score may shift by one tick of growth, so compare against the post-tick value.
    expect(earned).toBe(roundHalfToEven(scoreTree(starter).total * 0.1));
    expect(Math.abs(earned - expected)).toBeLessThanOrEqual(1);
    expect(state.money).toBe(100 + earned);
  });
});

describe('training consumes supplies and changes the score', () => {
  it('wires a branch and the trunk, spending two wire', () => {
    const state = createNewGameState();
    const starter = state.trees[0];
    if (!starter) throw new Error('no starter');
    const wireBefore = state.inventory.wire;
    expect(applyWire(starter, state, 0, 15)).toBe(true);
    expect(wireTrunk(starter, state, 10, 90)).toBe(true);
    expect(state.inventory.wire).toBe(wireBefore - 2);
    expect(starter.trunk.movement).toHaveLength(1);
    expect(starter.revision).toBeGreaterThan(0);
  });

  it('fertiliser is refused in winter for a juniper and nothing is consumed', () => {
    const state = createNewGameState();
    const starter = state.trees[0];
    if (!starter) throw new Error('no starter');
    state.day = 28 * 3 + 1; // winter
    const before = state.inventory.fertilizer;
    expect(fertilizeTree(starter, state)).toBe(false);
    expect(state.inventory.fertilizer).toBe(before);
  });
});

describe('prototype save import judgement calls', () => {
  it('defaults inventory keys an old save lacks to 0, not the new-game stock', () => {
    const raw = JSON.parse(fixture('prototype-save-v1-day14.json')) as Record<string, unknown>;
    const inv = raw.inventory as Record<string, number>;
    delete inv.wire;
    const state = importPrototypeSave(raw);
    expect(state.inventory.wire).toBe(0);
    expect(state.inventory.soil_premium).toBe(0);
  });

  it('keeps nextTreeId exactly as saved', () => {
    const state = deserializeSave(fixture('prototype-save-v1-day730.json'));
    expect(state.nextTreeId).toBe(26);
    expect(state.trees.every((t) => t.id < state.nextTreeId)).toBe(true);
  });

  it('scores imported trees in the same range the prototype showed', () => {
    const state = deserializeSave(fixture('prototype-save-v1-day730.json'));
    for (const tree of state.trees) {
      const score = scoreTree(tree);
      expect(Number.isInteger(score.total)).toBe(true);
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(100);
      expect(score.breakdown.at(-1)?.label).toBe('Vitality');
    }
  });
});

describe('review follow-ups', () => {
  it('prune keeps wire records aligned with the renumbered branches', () => {
    const state = createNewGameState();
    const tree = state.trees[0];
    if (!tree) throw new Error('no starter');
    expect(applyWire(tree, state, 0, 10)).toBe(true);
    expect(applyWire(tree, state, 1, 10)).toBe(true);
    state.day = 100; // pruning is winter-only
    expect(pruneBranch(tree, state, 0)).toBe(true);
    // The surviving wired branch is now id 0 and its record followed it.
    const survivorWire = tree.wiresApplied.find((w) => w.branchId === 0);
    expect(survivorWire?.removedDay).toBe(-1);
    expect(tree.branches[0]?.wired).toBe(true);
    // The pruned branch's wire was retired with the branch.
    const retired = tree.wiresApplied.find((w) => w.branchId === -1);
    expect(retired?.removedDay).toBe(state.day);
    // Removing the survivor's wire acts on the right record.
    removeWire(tree, state, 0);
    expect(survivorWire?.removedDay).toBe(state.day);
  });

  it('scores a tree whose saved target style is unknown by skipping the style criterion', () => {
    const state = createNewGameState();
    const tree = state.trees[0];
    if (!tree) throw new Error('no starter');
    const plain = scoreTree(tree).total;
    (tree as { targetStyle: string }).targetStyle = 'literati';
    expect(scoreTree(tree).total).toBe(plain);
  });

  it('a v2 save with an unknown species is rejected at load, not deep in the sim', () => {
    const state = createNewGameState();
    const text = serializeState(state, new Date(2026, 0, 1)).replace('"juniper"', '"oak"');
    expect(() => deserializeSave(text)).toThrow(/unknown species/);
  });

  it('a corrupt slot does not hide the intact ones from the most-recent lookup', () => {
    const storage = new MemorySaveStorage();
    saveGame(storage, createNewGameState(), 1, new Date(2026, 0, 1, 9, 0));
    storage.write(2, '{"version": 2, "trees": "nope"');
    saveGame(storage, createNewGameState(), 3, new Date(2026, 0, 2, 9, 0));
    expect(mostRecentSaveSlot(storage)).toBe(3);
  });
});
