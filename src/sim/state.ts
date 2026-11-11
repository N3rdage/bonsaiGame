/**
 * New-game bootstrap: the state a fresh save starts from.
 *
 * Ported from archive/gamemaker/objects/obj_game_controller/Create_0.gml:
 * - day 0, money 100, nextTreeId 0: lines 23, 24, 26
 *   (`global.game_day = 0`, `global.money = 100`, `global.next_tree_id = 0`).
 *   Day 0 is kept as-is; seasonForDay clamps it to day 1 (spring).
 * - inventory: line 10, `init_inventory()` (see inventory.ts).
 * - starter tree: lines 55-67, Granny's juniper, `new BonsaiTree("juniper",
 *   "seed")` (so id 0 and seed defaults), then name "Granny's", trunk 25 cm /
 *   18 mm, four branches, foliage 0.5, location "shed", pushed to all_trees.
 * - tutorial: line 68, `tutorial_init_for_new_game()` (TUTORIAL_WATER).
 */

import { createInventory } from './inventory';
import { addBranch, spawnTree } from './tree';
import { TUTORIAL_WATER, tutorialInitForNewGame } from './tutorial';
import type { GameState } from './types';

export function createNewGameState(): GameState {
  const state: GameState = {
    day: 0,
    money: 100,
    inventory: createInventory(),
    trees: [],
    nextTreeId: 0,
    tutorialStep: TUTORIAL_WATER,
    seasonTipShown: false,
    paused: false,
  };

  // Granny's juniper, the player's inherited starting tree. "Granny's" is short
  // on purpose so it fits the inspector header; tutorial copy says "Granny's
  // juniper" in full.
  const sample = spawnTree(state, 'juniper', 'seed');
  sample.name = "Granny's";
  sample.trunk.heightCm = 25;
  sample.trunk.girthMm = 18;
  addBranch(sample, -1, 8, 30, 12);
  addBranch(sample, -1, 14, 210, 11);
  addBranch(sample, -1, 18, 120, 10);
  addBranch(sample, -1, 22, 60, 9);
  sample.foliageDensity = 0.5;
  sample.location = 'shed';
  state.trees.push(sample);
  tutorialInitForNewGame(state);

  return state;
}
