import { describe, expect, it } from 'vitest';
import { createInventory } from './inventory';
import { SHOP_CATALOGUE, shopBuy } from './shop';
import type { GameState } from './types';

function makeState(money: number): GameState {
  return {
    day: 0,
    money,
    inventory: createInventory(),
    trees: [],
    nextTreeId: 0,
    tutorialStep: -1,
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
    ]);
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

  it('refuses when too poor and changes nothing', () => {
    const state = makeState(79);
    expect(shopBuy(state, 'fancy_pot', 1, 80)).toBe(false);
    expect(state.money).toBe(79);
    expect(state.inventory.fancy_pot).toBe(0);
  });
});
