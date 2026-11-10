/**
 * The read-only Inventory panel (obj_ui_inventory) as a PanelModel: the
 * Resources, Seeds and Cuttings sections, always drawn, each listing its
 * items with a count above zero, or `(none)` when it has none so the player
 * learns the categories exist. Pure; WorldScene draws it.
 */

import { SPECIES_KEYS, getSpecies } from '../sim/species';
import type { Inventory, InventoryKey } from '../sim/types';
import { PANEL_INSET, type PanelModel, type PanelRow } from './panels';

/** The hook's `panel` while the inventory is open. */
export const INVENTORY_KEY = 'inventory';

/** The inventory's box, centred on the canvas: three headers, ten items and two gaps above Close. */
export const INVENTORY_PANEL = { x: 120, y: 10, w: 240, h: 250, rowSpacing: 14 } as const;
/** obj_ui_inventory's 16 px gap between sections at its 24 px line, scaled to the box's 14 px line (16 x 14 / 24, rounded). */
const SECTION_GAP = 9;
/** Items are indented 16 px under their header (obj_ui_inventory). */
const ITEM_INDENT = 16;
/** Right edge of the counts, which are right-aligned there (obj_ui_inventory's fa_right at its inset). */
export const INVENTORY_COUNT_RIGHT = INVENTORY_PANEL.x + INVENTORY_PANEL.w - PANEL_INSET;

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

/** Resources, Seeds and Cuttings in that order, each with only its items whose count is above zero. */
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
  ];
}

/** The inventory panel over `inv`: read-only, so Close is its only control. */
export function inventoryPanel(inv: Inventory): PanelModel {
  const box = INVENTORY_PANEL;
  const left = box.x + PANEL_INSET;
  const rows: PanelRow[] = [];
  let y = box.y + 36;
  const line = (text: string, color: string, x: number, align?: 'right'): void => {
    rows.push({ text, id: '', x, y, color, ...(align && { align }) });
  };
  inventorySections(inv).forEach(({ title, entries }, i) => {
    if (i > 0) y += SECTION_GAP;
    line(title, HEADER_COLOR, left);
    y += box.rowSpacing;
    if (entries.length === 0) {
      line('(none)', NONE_COLOR, left + ITEM_INDENT);
      y += box.rowSpacing;
    }
    for (const { label, count } of entries) {
      line(label, ITEM_COLOR, left + ITEM_INDENT);
      line(String(count), ITEM_COLOR, INVENTORY_COUNT_RIGHT, 'right');
      y += box.rowSpacing;
    }
  });
  return { key: INVENTORY_KEY, title: 'Inventory', box, rows };
}
