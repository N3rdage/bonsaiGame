/**
 * The world's modal panels (obj_ui_panel and its children) as plain data: the
 * box, title, rows and Close button, in logical px on the 480x270 canvas.
 * Pure; WorldScene draws them and maps row ids to actions. A tree's panel is
 * the inspector (inspector.ts).
 */

import type { BonsaiTree } from '../sim/types';
import { slotRowText, type SlotRow } from './saveSlots';
import type { Prop } from './shedRoom';
import { treeLabel } from './treeSprites';

/** The box, centred on the canvas (obj_ui_panel auto-centres); wide enough for a full slot row. */
export const PANEL = { x: 40, y: 60, w: 400, h: 150 } as const;
/** Left inset of the title and the rows (text origin 0, 0.5). */
export const PANEL_INSET = 10;
/** Vertical centre of the title. */
export const PANEL_TITLE_Y = PANEL.y + 12;
/** Vertical centre of the first row; each row's band is `PANEL_ROW_SPACING` tall. */
export const PANEL_ROW_TOP = PANEL.y + 36;
export const PANEL_ROW_SPACING = 22;
/** Centre of the `Close (Esc)` button (text origin 0.5). */
export const PANEL_CLOSE = { x: PANEL.x + PANEL.w / 2, y: PANEL.y + PANEL.h - 16 } as const;
export const PANEL_CLOSE_LABEL = 'Close (Esc)';

export interface PanelRow {
  readonly text: string;
  /** Control id when the row can be tapped, '' for plain text. */
  readonly id: string;
  /** Vertical centre. */
  readonly y: number;
}

export interface PanelModel {
  /** The hook's `panel`: 'slots', 'pedestal:<pedestalKey>' or 'placeholder:<propKey>'. */
  readonly key: string;
  readonly title: string;
  readonly rows: readonly PanelRow[];
}

function rows(items: readonly { text: string; id: string }[]): PanelRow[] {
  return items.map((item, i) => ({ ...item, y: PANEL_ROW_TOP + i * PANEL_ROW_SPACING }));
}

/** The stand-in for a prop whose own panel comes in a later slice. */
export function placeholderPanel(prop: Prop): PanelModel {
  return {
    key: `placeholder:${prop.key}`,
    title: prop.label,
    rows: rows([{ text: 'Coming in a later slice.', id: '' }]),
  };
}

/**
 * obj_ui_pedestal for an empty pedestal: `Place <label>` while a tree is
 * carried, else how to display one (the prototype listed the shed's trees here).
 */
export function pedestalPanel(pedestalKey: string, carried: BonsaiTree | undefined): PanelModel {
  return {
    key: `pedestal:${pedestalKey}`,
    title: 'Display Pedestal',
    rows: rows([
      carried
        ? { text: `Place ${treeLabel(carried)}`, id: 'panel-place' }
        : { text: 'This pedestal is empty. Carry a tree here to display it.', id: '' },
    ]),
  };
}

/**
 * obj_ui_save_slots in load mode: one row per slot; only readable saves are
 * tappable and carry the `[Load]` action (an empty or unreadable one is shown, not offered).
 */
export function loadSlotsPanel(slots: readonly SlotRow[]): PanelModel {
  return {
    key: 'slots',
    title: 'Load Game',
    rows: rows(
      slots.map((row) =>
        row.status === 'occupied'
          ? { text: `${slotRowText(row)}  [Load]`, id: `panel-slot-${String(row.slot)}` }
          : { text: slotRowText(row), id: '' },
      ),
    ),
  };
}
