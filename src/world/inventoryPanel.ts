/**
 * The read-only Inventory panel (obj_ui_inventory) as a PanelModel: the
 * Resources, Seeds and Cuttings sections, and the unplaced Furniture (new
 * content), always drawn, each listing its items with a count above zero, or
 * `(none)` when it has none so the player learns the categories exist. Two
 * columns, since four full sections are too tall for one. Pure; WorldScene
 * draws it.
 */

import { SPECIES_KEYS, getSpecies } from '../sim/species';
import type { Inventory, InventoryKey } from '../sim/types';
import { PANEL_INSET, type PanelModel, type PanelRow } from './panels';

/** The hook's `panel` while the inventory is open. */
export const INVENTORY_KEY = 'inventory';

/** The inventory's box, centred on the canvas, as wide as TALL_PANEL: two columns of two sections each above Close. */
export const INVENTORY_PANEL = { x: 40, y: 10, w: 400, h: 250, rowSpacing: 12 } as const;
/** obj_ui_inventory's 16 px gap between sections at its 24 px line, scaled to the box's 12 px line (16 x 12 / 24). */
const SECTION_GAP = 8;
/** Items are indented 16 px under their header (obj_ui_inventory). */
const ITEM_INDENT = 16;
/**
 * The box's two halves: each one's left edge and its counts' right edge (obj_ui_inventory's
 * fa_right at its inset). Resources and Seeds fill the left, Cuttings and Furniture the right.
 */
export const INVENTORY_COLUMNS = [
  inventoryColumn(INVENTORY_PANEL.x),
  inventoryColumn(INVENTORY_PANEL.x + INVENTORY_PANEL.w / 2),
] as const;

/** The half of the box from `x`. */
function inventoryColumn(x: number): { readonly left: number; readonly countRight: number } {
  return { left: x + PANEL_INSET, countRight: x + INVENTORY_PANEL.w / 2 - PANEL_INSET };
}
const SECTIONS_PER_COLUMN = 2;

/** obj_ui_inventory's colours: headers rgb(140, 180, 120), `(none)` rgb(140, 140, 140), items white. */
const HEADER_COLOR = '#8cb478';
const NONE_COLOR = '#8c8c8c';
const ITEM_COLOR = '#ffffff';

/** obj_ui_inventory's resource_labels, in its order. */
const RESOURCE_LABELS: readonly (readonly [InventoryKey, string])[] = [
  ['clay', 'Clay'],
  ['pot', 'Pots'],
  ['fancy_pot', 'Fancy Pots'],
  ['soil_premium', 'Akadama Mix'],
  ['wire', 'Wire'],
  ['fertilizer', 'Fertilizer'],
];

/** The placeable furniture not yet put down (placement.ts). */
const FURNITURE_LABELS: readonly (readonly [InventoryKey, string])[] = [
  ['pedestal', 'Pedestals'],
  ['floor_shelf', 'Floor shelves'],
];

export interface InventorySection {
  readonly title: string;
  readonly entries: readonly { readonly label: string; readonly count: number }[];
}

/** The `prefix<species>` keys an inventory has, in SPECIES_KEYS order, labelled by species display name. */
function speciesEntries(inv: Inventory, prefix: 'seed_' | 'cutting_'): [InventoryKey, string][] {
  return SPECIES_KEYS.flatMap((species): [InventoryKey, string][] => {
    const key = `${prefix}${species}`;
    return key in inv ? [[key as InventoryKey, getSpecies(species).displayName]] : [];
  });
}

/** Resources, Seeds, Cuttings and Furniture in that order, each with only its items whose count is above zero. */
export function inventorySections(inv: Inventory): InventorySection[] {
  const section = (title: string, labels: readonly (readonly [InventoryKey, string])[]) => ({
    title,
    entries: labels
      .filter(([key]) => inv[key] > 0)
      .map(([key, label]) => ({ label, count: inv[key] })),
  });
  return [
    section('Resources', RESOURCE_LABELS),
    section('Seeds', speciesEntries(inv, 'seed_')),
    section('Cuttings', speciesEntries(inv, 'cutting_')),
    section('Furniture', FURNITURE_LABELS),
  ];
}

/** The inventory panel over `inv`: read-only, so Close is its only control. */
export function inventoryPanel(inv: Inventory): PanelModel {
  const box = INVENTORY_PANEL;
  const rows: PanelRow[] = [];
  let y = 0;
  const line = (text: string, color: string, x: number, align?: 'right'): void => {
    rows.push({ text, id: '', x, y, color, ...(align && { align }) });
  };
  inventorySections(inv).forEach(({ title, entries }, i) => {
    const { left, countRight } = INVENTORY_COLUMNS[i < SECTIONS_PER_COLUMN ? 0 : 1];
    if (i % SECTIONS_PER_COLUMN === 0) y = box.y + 36;
    else y += SECTION_GAP;
    line(title, HEADER_COLOR, left);
    y += box.rowSpacing;
    if (entries.length === 0) {
      line('(none)', NONE_COLOR, left + ITEM_INDENT);
      y += box.rowSpacing;
    }
    for (const { label, count } of entries) {
      line(label, ITEM_COLOR, left + ITEM_INDENT);
      line(String(count), ITEM_COLOR, countRight, 'right');
      y += box.rowSpacing;
    }
  });
  return { key: INVENTORY_KEY, title: 'Inventory', box, rows };
}
