import { describe, expect, it } from 'vitest';
import { createInventory } from './inventory';
import { createNewGameState } from './state';
import { TUTORIAL_WATER } from './tutorial';

describe('createNewGameState', () => {
  it('starts on day 0 with $100, starting inventory and the tutorial at WATER', () => {
    const s = createNewGameState();
    expect(s.day).toBe(0);
    expect(s.money).toBe(100);
    expect(s.inventory).toEqual(createInventory());
    expect([s.inventory.pedestal, s.inventory.floor_shelf]).toEqual([1, 0]);
    expect(s.tutorialStep).toBe(TUTORIAL_WATER);
    expect(s.nextTreeId).toBe(1);
  });

  it("seeds Granny's juniper in the shed", () => {
    const s = createNewGameState();
    expect(s.trees).toHaveLength(1);
    const t = s.trees[0];
    expect(t).toBeDefined();
    if (!t) return;
    expect(t.id).toBe(0);
    expect(t.speciesKey).toBe('juniper');
    expect(t.origin).toBe('seed');
    expect(t.name).toBe("Granny's");
    expect(t.location).toBe('shed');
    expect(t.trunk.heightCm).toBe(25);
    expect(t.trunk.girthMm).toBe(18);
    expect(t.trunk.taper).toBe(0.7);
    expect(t.foliageDensity).toBe(0.5);
    expect(t.waterLevel).toBe(50);
    expect(t.vitality).toBe(100);
    expect(t.branches.map((b) => [b.id, b.parentId, b.originY, b.angle, b.length])).toEqual([
      [0, -1, 8, 30, 12],
      [1, -1, 14, 210, 11],
      [2, -1, 18, 120, 10],
      [3, -1, 22, 60, 9],
    ]);
    expect(t.branches.map((b) => b.girth)).toEqual([12 * 0.3, 11 * 0.3, 10 * 0.3, 9 * 0.3]);
  });

  it('returns independent states', () => {
    const a = createNewGameState();
    const b = createNewGameState();
    a.inventory.clay = 0;
    a.trees[0]?.branches.pop();
    expect(b.inventory.clay).toBe(5);
    expect(b.trees[0]?.branches).toHaveLength(4);
  });
});
