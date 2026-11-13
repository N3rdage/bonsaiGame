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

/** Which part of the catalogue an item belongs to. */
export type ShopSection = 'supplies' | 'seeds' | 'furniture';

export interface ShopItem {
  key: InventoryKey;
  label: string;
  price: number;
  section: ShopSection;
}

export const SHOP_CATALOGUE: readonly ShopItem[] = [
  { key: 'clay', label: 'Clay', price: 4, section: 'supplies' },
  { key: 'pot', label: 'Pot', price: 12, section: 'supplies' },
  { key: 'wire', label: 'Wire', price: 8, section: 'supplies' },
  { key: 'fertilizer', label: 'Fertilizer', price: 10, section: 'supplies' },
  { key: 'fancy_pot', label: 'Fancy Pot', price: 80, section: 'supplies' },
  // Premium soil is a per-repot horticultural upgrade (slower vigor drift +
  // softer water-stress penalties); basic soil is free/implicit.
  { key: 'soil_premium', label: 'Akadama Mix', price: 18, section: 'supplies' },
  // Seed packets (backlog #93): dearer than clay, far below a fancy pot; a
  // garden seed in autumn is free.
  { key: 'seed_juniper', label: 'Juniper Seed', price: 9, section: 'seeds' },
  { key: 'seed_maple', label: 'Maple Seed', price: 9, section: 'seeds' },
  { key: 'seed_pine', label: 'Pine Seed', price: 9, section: 'seeds' },
  // Greenhouse furniture (decision #123), placed in the greenhouse with P.
  { key: 'pedestal', label: 'Pedestal', price: 30, section: 'furniture' },
  { key: 'floor_shelf', label: 'Floor shelf', price: 50, section: 'furniture' },
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
