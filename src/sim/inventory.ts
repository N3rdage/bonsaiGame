/**
 * Simple key-count inventory. Every key always exists (the type is a full
 * Record), so the prototype's "missing key" branches collapse to plain reads.
 *
 * Ported from archive/gamemaker/scripts/scr_inventory/scr_inventory.gml.
 */

import type { Inventory, InventoryKey } from './types';

/** Starting stock for a new game (GML init_inventory). */
export function createInventory(): Inventory {
  return {
    clay: 5,
    pot: 2,
    fancy_pot: 0,
    soil_premium: 0,
    wire: 10,
    fertilizer: 50,
    seed_juniper: 1,
    seed_maple: 1,
    seed_pine: 0,
    cutting_juniper: 0,
    cutting_maple: 0,
  };
}

export function inventoryAdd(inv: Inventory, key: InventoryKey, amount = 1): void {
  inv[key] += amount;
}

/** Remove `amount`; returns false and leaves the count unchanged if short. */
export function inventoryRemove(inv: Inventory, key: InventoryKey, amount = 1): boolean {
  if (inv[key] < amount) return false;
  inv[key] -= amount;
  return true;
}

export function inventoryHas(inv: Inventory, key: InventoryKey, amount = 1): boolean {
  return inv[key] >= amount;
}

export function inventoryCount(inv: Inventory, key: InventoryKey): number {
  return inv[key];
}
