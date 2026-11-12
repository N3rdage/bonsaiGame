import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createInventory } from './inventory';
import { deserializeSave } from './save';
import { scoreTree } from './scoring';
import { SHOP_CATALOGUE, sellPrice, sellTree, shopBuy } from './shop';
import { createNewGameState } from './state';
import { carriedTree, pickUpTree } from './tree';
import type { GameState } from './types';

function makeState(money: number): GameState {
  return {
    day: 0,
    money,
    inventory: createInventory(),
    trees: [],
    nextTreeId: 0,
    tutorialStep: -1,
    seasonTipShown: false,
    placed: [],
    nextPlacedId: 0,
    paused: false,
  };
}

describe('SHOP_CATALOGUE', () => {
  it('has the prototype items, prices and order', () => {
    expect(SHOP_CATALOGUE.map((i) => [i.key, i.label, i.price])).toEqual([
      ['clay', 'Clay', 4],
      ['pot', 'Pot', 12],
      ['wire', 'Wire', 8],
      ['fertilizer', 'Fertilizer', 10],
      ['fancy_pot', 'Fancy Pot', 80],
      ['soil_premium', 'Akadama Mix', 18],
      ['seed_juniper', 'Juniper Seed', 9],
      ['seed_maple', 'Maple Seed', 9],
      ['seed_pine', 'Pine Seed', 9],
    ]);
  });
});

function day14(): GameState {
  const text = readFileSync(
    new URL('./__fixtures__/prototype-save-v1-day14.json', import.meta.url),
    'utf8',
  );
  return deserializeSave(text);
}

describe('sellPrice and sellTree', () => {
  it('prices a tree at twice its score, rounded half to even', () => {
    const starter = createNewGameState().trees[0];
    if (!starter) throw new Error('no starter');
    expect(scoreTree(starter).total).toBe(74);
    expect(sellPrice(starter)).toBe(148);
    // scoreTree floors its total, so the GML's round never meets a half here.
    expect(day14().trees.map((t) => [t.name, scoreTree(t).total, sellPrice(t)])).toEqual([
      ['Starter', 50, 100],
      ['Fancy #1', 63, 126],
    ]);
  });

  it('sells once: location sold, money added; a second sale refuses and changes nothing', () => {
    const state = day14();
    const tree = state.trees[0];
    if (!tree) throw new Error('no fixture tree');
    const price = sellPrice(tree);
    expect(sellTree(state, tree)).toBe(price);
    expect(tree.location).toBe('sold');
    expect(state.money).toBe(132 + price);
    expect(state.trees).toContain(tree);
    expect(sellTree(state, tree)).toBeUndefined();
    expect(state.money).toBe(132 + price);
  });

  it('selling the carried tree leaves nothing carried', () => {
    const state = createNewGameState();
    const tree = state.trees[0];
    if (!tree) throw new Error('no starter');
    expect(pickUpTree(state, tree)).toBe(true);
    expect(carriedTree(state)).toBe(tree);
    expect(sellTree(state, tree)).toBe(sellPrice(tree));
    expect(carriedTree(state)).toBeUndefined();
  });
});

describe('shopBuy', () => {
  it('debits money and adds stock', () => {
    const state = makeState(100);
    expect(shopBuy(state, 'pot', 3, 12)).toBe(true);
    expect(state.money).toBe(64);
    expect(state.inventory.pot).toBe(5);
  });

  it('allows spending exactly all the money', () => {
    const state = makeState(80);
    expect(shopBuy(state, 'fancy_pot', 1, 80)).toBe(true);
    expect(state.money).toBe(0);
    expect(state.inventory.fancy_pot).toBe(1);
  });

  it('sells seed packets at $9, crediting the seed and nothing else', () => {
    for (const key of ['seed_juniper', 'seed_maple', 'seed_pine'] as const) {
      const state = makeState(100);
      const before = { ...state.inventory };
      const item = SHOP_CATALOGUE.find((i) => i.key === key);
      expect(item?.price).toBe(9);
      expect(shopBuy(state, key, 1, item?.price ?? 0)).toBe(true);
      expect(state.money).toBe(91);
      expect(state.inventory).toEqual({ ...before, [key]: before[key] + 1 });
    }
  });

  it('refuses when too poor and changes nothing', () => {
    const state = makeState(79);
    expect(shopBuy(state, 'fancy_pot', 1, 80)).toBe(false);
    expect(state.money).toBe(79);
    expect(state.inventory.fancy_pot).toBe(0);
  });
});
