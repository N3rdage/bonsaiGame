import { describe, expect, it } from 'vitest';
import { createInventory } from '../sim/inventory';
import type { Inventory } from '../sim/types';
import {
  INVENTORY_COUNT_RIGHT,
  INVENTORY_PANEL,
  inventoryPanel,
  inventorySections,
} from './inventoryPanel';
import { PANEL_INSET, panelClose, panelTitleY } from './panels';

// 10 px monospace, the fallback and the widest face text can draw in (VT323 is 0.4 em): about 0.6 em a glyph and a 12 px line. Generous upper bounds.
const GLYPH_W = 6;
const LINE_H = 12;

const empty = (): Inventory => {
  const inv = createInventory();
  for (const key of Object.keys(inv) as (keyof Inventory)[]) inv[key] = 0;
  return inv;
};
const full = (): Inventory => {
  const inv = empty();
  for (const key of Object.keys(inv) as (keyof Inventory)[]) inv[key] = 999_999;
  return inv;
};

describe('inventory panel', () => {
  it("lists a new game's stock by the prototype's labels, hiding the zeros", () => {
    expect(inventorySections(createInventory())).toEqual([
      {
        title: 'Resources',
        entries: [
          { label: 'Clay', count: 5 },
          { label: 'Pots', count: 2 },
          { label: 'Wire', count: 10 },
          { label: 'Fertilizer', count: 50 },
        ],
      },
      {
        title: 'Seeds',
        entries: [
          { label: 'Juniper', count: 1 },
          { label: 'Japanese Maple', count: 1 },
        ],
      },
      { title: 'Cuttings', entries: [] },
    ]);
  });

  it('labels every item: Fancy Pots, Akadama Mix and cuttings by species name', () => {
    const labels = inventorySections(full()).map((s) => [s.title, s.entries.map((e) => e.label)]);
    expect(labels).toEqual([
      ['Resources', ['Clay', 'Pots', 'Fancy Pots', 'Akadama Mix', 'Wire', 'Fertilizer']],
      ['Seeds', ['Juniper', 'Japanese Maple', 'Pine']],
      ['Cuttings', ['Juniper', 'Japanese Maple']],
    ]);
  });

  it('lists seeds and cuttings in species order, however the inventory was built', () => {
    const reversed = Object.fromEntries(Object.entries(full()).reverse()) as Inventory;
    expect(Object.keys(reversed)[0]).toBe('cutting_maple');
    expect(inventorySections(reversed)).toEqual(inventorySections(full()));
  });

  it('draws every section, with (none) under an empty one, and only Close to tap', () => {
    const m = inventoryPanel(empty());
    expect([m.key, m.title]).toEqual(['inventory', 'Inventory']);
    expect(m.rows.map((r) => r.text)).toEqual([
      'Resources',
      '(none)',
      'Seeds',
      '(none)',
      'Cuttings',
      '(none)',
    ]);
    expect(m.rows.every((r) => r.id === '')).toBe(true);

    const stocked = inventoryPanel(createInventory()).rows.map((r) => r.text);
    expect(stocked).toEqual([
      'Resources',
      'Clay',
      '5',
      'Pots',
      '2',
      'Wire',
      '10',
      'Fertilizer',
      '50',
      'Seeds',
      'Juniper',
      '1',
      'Japanese Maple',
      '1',
      'Cuttings',
      '(none)',
    ]);
  });

  it('fits a full inventory inside 480x270: lines inside the box, apart, and above Close', () => {
    const box = INVENTORY_PANEL;
    expect(box.x * 2 + box.w).toBe(480);
    expect(box.y * 2 + box.h).toBe(270);
    const close = panelClose(box);
    for (const inv of [full(), empty(), createInventory()]) {
      const rows = inventoryPanel(inv).rows;
      let above = panelTitleY(box);
      for (const row of rows) {
        // A right-aligned row's x is its right edge.
        const width = row.text.length * GLYPH_W;
        const left = row.align === 'right' ? (row.x ?? NaN) - width : (row.x ?? NaN);
        const right = left + width;
        expect(left).toBeGreaterThanOrEqual(box.x + PANEL_INSET);
        expect(right).toBeLessThanOrEqual(box.x + box.w - PANEL_INSET);
        // Counts are right-aligned on the column's edge; a label stays clear of a six-digit count.
        if (row.align === 'right') expect(row.x).toBe(INVENTORY_COUNT_RIGHT);
        else expect(right).toBeLessThan(INVENTORY_COUNT_RIGHT - 6 * GLYPH_W);
        expect(row.y - above === 0 || row.y - above >= LINE_H).toBe(true);
        above = row.y;
      }
      expect(above + LINE_H / 2).toBeLessThanOrEqual(close.y - LINE_H / 2);
    }
  });
});
