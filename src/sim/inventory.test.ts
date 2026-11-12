import { describe, expect, it } from 'vitest';
import {
  createInventory,
  inventoryAdd,
  inventoryCount,
  inventoryHas,
  inventoryRemove,
} from './inventory';

describe('createInventory', () => {
  it('has the prototype starting counts', () => {
    expect(createInventory()).toEqual({
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
    });
  });

  it('returns a fresh object each time', () => {
    const a = createInventory();
    a.clay = 0;
    expect(createInventory().clay).toBe(5);
  });
});

describe('inventory operations', () => {
  it('adds with a default amount of 1', () => {
    const inv = createInventory();
    inventoryAdd(inv, 'cutting_juniper');
    inventoryAdd(inv, 'wire', 5);
    expect(inventoryCount(inv, 'cutting_juniper')).toBe(1);
    expect(inventoryCount(inv, 'wire')).toBe(15);
  });

  it('removes when there is enough', () => {
    const inv = createInventory();
    expect(inventoryRemove(inv, 'pot')).toBe(true);
    expect(inventoryRemove(inv, 'pot', 1)).toBe(true);
    expect(inventoryCount(inv, 'pot')).toBe(0);
  });

  it('refuses to remove when short and leaves the count unchanged', () => {
    const inv = createInventory();
    expect(inventoryRemove(inv, 'clay', 6)).toBe(false);
    expect(inventoryCount(inv, 'clay')).toBe(5);
    expect(inventoryRemove(inv, 'fancy_pot')).toBe(false);
    expect(inventoryCount(inv, 'fancy_pot')).toBe(0);
  });

  it('has checks against the amount', () => {
    const inv = createInventory();
    expect(inventoryHas(inv, 'wire')).toBe(true);
    expect(inventoryHas(inv, 'wire', 10)).toBe(true);
    expect(inventoryHas(inv, 'wire', 11)).toBe(false);
    expect(inventoryHas(inv, 'fancy_pot')).toBe(false);
  });
});
