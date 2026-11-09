/**
 * Shop catalogue + purchase primitive. Prices are data so they can be
 * rebalanced without touching the UI. `shopBuy` is the only path that should
 * debit money.
 *
 * Reference points: starting money $100; a score-50 displayed tree earns
 * ~5/day; selling that same tree pays $100. Supplies are an everyday spend,
 * the fancy pot is a milestone purchase that pays itself back over weeks.
 *
 * Ported from archive/gamemaker/scripts/scr_shop/scr_shop.gml.
 */

import { inventoryAdd } from './inventory';
import { scoreTree } from './scoring';
import { isSold } from './tree';
import type { BonsaiTree, GameState, InventoryKey } from './types';
import { roundHalfToEven } from './world';

export interface ShopItem {
  key: InventoryKey;
  label: string;
  price: number;
}

export const SHOP_CATALOGUE: readonly ShopItem[] = [
  { key: 'clay', label: 'Clay', price: 4 },
  { key: 'pot', label: 'Pot', price: 12 },
  { key: 'wire', label: 'Wire', price: 8 },
  { key: 'fertilizer', label: 'Fertilizer', price: 10 },
  { key: 'fancy_pot', label: 'Fancy Pot', price: 80 },
  // Premium soil is a per-repot horticultural upgrade (slower vigor drift +
  // softer water-stress penalties); basic soil is free/implicit.
  { key: 'soil_premium', label: 'Akadama Mix', price: 18 },
];

/**
 * Buy `qty` of `key` at `unitPrice` each. Returns true on success (money
 * debited, inventory increased), false with no change if the player can't
 * afford it.
 */
export function shopBuy(
  state: GameState,
  key: InventoryKey,
  qty: number,
  unitPrice: number,
): boolean {
  const total = qty * unitPrice;
  if (state.money < total) return false;
  state.money -= total;
  inventoryAdd(state.inventory, key, qty);
  return true;
}

/** obj_ui_tree_sell_confirm: `round(score.total * 2)` coins, GameMaker's half-to-even round. */
export function sellPrice(tree: BonsaiTree): number {
  return roundHalfToEven(scoreTree(tree).total * 2);
}

/**
 * Sells `tree` at `sellPrice`: its location becomes 'sold' (kept in
 * `state.trees`, as the prototype's soft delete) and the money is added.
 * Returns the price, or undefined with nothing changed if it is already sold.
 */
export function sellTree(state: GameState, tree: BonsaiTree): number | undefined {
  if (isSold(tree)) return undefined;
  const price = sellPrice(tree);
  tree.location = 'sold';
  state.money += price;
  return price;
}
