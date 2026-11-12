import { describe, expect, it } from 'vitest';
import { createInventory } from '../sim/inventory';
import type { Inventory } from '../sim/types';
import {
  INVENTORY_COLUMNS,
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
      { title: 'Furniture', entries: [] },
    ]);
  });

  it('labels every item: Fancy Pots, Akadama Mix, cuttings by species name and the furniture', () => {
    const labels = inventorySections(full()).map((s) => [s.title, s.entries.map((e) => e.label)]);
    expect(labels).toEqual([
      ['Resources', ['Clay', 'Pots', 'Fancy Pots', 'Akadama Mix', 'Wire', 'Fertilizer']],
      ['Seeds', ['Juniper', 'Japanese Maple', 'Pine']],
      ['Cuttings', ['Juniper', 'Japanese Maple']],
      ['Furniture', ['Pedestals', 'Floor shelves']],
    ]);
  });

  it('lists seeds and cuttings in species order, however the inventory was built', () => {
    const reversed = Object.fromEntries(Object.entries(full()).reverse()) as Inventory;
    expect(Object.keys(reversed)[0]).toBe('floor_shelf');
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
      'Furniture',
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
      'Furniture',
      '(none)',
    ]);
  });

  it('puts Resources and Seeds in the left column, Cuttings and Furniture in the right', () => {
    const headers = inventoryPanel(empty())
      .rows.filter((r) => r.color === '#8cb478')
      .map((r) => [r.text, r.x, r.y]);
    const [left, right] = INVENTORY_COLUMNS;
    expect(headers).toEqual([
      ['Resources', left.left, INVENTORY_PANEL.y + 36],
      ['Seeds', left.left, INVENTORY_PANEL.y + 36 + 2 * LINE_H + 8],
      ['Cuttings', right.left, INVENTORY_PANEL.y + 36],
      ['Furniture', right.left, INVENTORY_PANEL.y + 36 + 2 * LINE_H + 8],
    ]);
  });

  it('fits a full inventory inside 480x270: lines inside the box and their column, apart, and above Close', () => {
    const box = INVENTORY_PANEL;
    expect(box.x * 2 + box.w).toBe(480);
    expect(box.y * 2 + box.h).toBe(270);
    const close = panelClose(box);
    for (const inv of [full(), empty(), createInventory()]) {
      const rows = inventoryPanel(inv).rows;
      const above = INVENTORY_COLUMNS.map(() => panelTitleY(box));
      for (const row of rows) {
        // A right-aligned row's x is its right edge.
        const width = row.text.length * GLYPH_W;
        const left = row.align === 'right' ? (row.x ?? NaN) - width : (row.x ?? NaN);
        const right = left + width;
        const c = INVENTORY_COLUMNS.findIndex((col) => left >= col.left && right <= col.countRight);
        const column = INVENTORY_COLUMNS[c];
        if (column === undefined) throw new Error(`${row.text} is in no column`);
        expect(left).toBeGreaterThanOrEqual(box.x + PANEL_INSET);
        expect(right).toBeLessThanOrEqual(box.x + box.w - PANEL_INSET);
        // Counts are right-aligned on the column's edge; a label stays clear of a six-digit count.
        if (row.align === 'right') expect(row.x).toBe(column.countRight);
        else expect(right).toBeLessThan(column.countRight - 6 * GLYPH_W);
        const prev = above[c] ?? NaN;
        expect(row.y - prev === 0 || row.y - prev >= LINE_H).toBe(true);
        above[c] = row.y;
      }
      for (const y of above) expect(y + LINE_H / 2).toBeLessThanOrEqual(close.y - LINE_H / 2);
    }
  });
});
