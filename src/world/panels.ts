/**
 * The world's modal panels (obj_ui_panel and its children) as plain data: the
 * box, title, rows and Close button, in logical px on the 480x270 canvas.
 * Pure; WorldScene draws them and maps row ids to actions. A tree's panel is
 * the inspector (inspector.ts).
 */

import type { BonsaiTree } from '../sim/types';
import { slotRowText, type SlotRow } from './saveSlots';
import { treeLabel } from './treeSprites';

/** A panel's box in logical px and the pitch of its rows. */
export interface PanelBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rowSpacing: number;
}

/** The box, centred on the canvas (obj_ui_panel auto-centres); wide enough for a full slot row. */
export const PANEL = { x: 40, y: 60, w: 400, h: 150, rowSpacing: 22 } as const;
/** The taller box, also centred, for the repot, sell and style panels' longer lists. */
export const TALL_PANEL = { x: 40, y: 10, w: 400, h: 250, rowSpacing: 20 } as const;
/** Left inset of the title and the rows (text origin 0, 0.5). */
export const PANEL_INSET = 10;
/** Vertical centre of PANEL's title. */
export const PANEL_TITLE_Y = panelTitleY(PANEL);
/** Each row's band in PANEL; the first row's centre is 36 px below the top. */
export const PANEL_ROW_SPACING = PANEL.rowSpacing;
/** Centre of the `Close (Esc)` button (text origin 0.5). */
export const PANEL_CLOSE = panelClose(PANEL);
export const PANEL_CLOSE_LABEL = 'Close (Esc)';
/** Plain rows' text colour, and a greyed button's. */
export const PANEL_TEXT_COLOR = '#a0b496';
export const PANEL_DISABLED_COLOR = '#6e7a68';

/** Vertical centre of `box`'s title. */
export function panelTitleY(box: PanelBox): number {
  return box.y + 12;
}

/** Centre of `box`'s `Close (Esc)` button. */
export function panelClose(box: PanelBox): { readonly x: number; readonly y: number } {
  return { x: box.x + box.w / 2, y: box.y + box.h - 16 };
}

export interface PanelRow {
  readonly text: string;
  /** Control id when the row can be tapped, '' for plain text. */
  readonly id: string;
  /** Vertical centre. */
  readonly y: number;
  /** Left edge, for a row in a column; the box's inset when absent. The right edge with `align: 'right'`. */
  readonly x?: number;
  /** 'right' for plain text right-aligned at `x` (text origin 1, 0.5), as a column of counts. */
  readonly align?: 'right';
  /** False for a greyed button: drawn in PANEL_DISABLED_COLOR and not a control. */
  readonly enabled?: boolean;
  /** Text colour overriding the default. */
  readonly color?: string;
}

export interface PanelModel {
  /** The hook's `panel`: 'slots', 'shop', 'plant', 'pedestal:<pedestalKey>' or a tree's sub-panel ('repot:<id>', ...). */
  readonly key: string;
  readonly title: string;
  readonly rows: readonly PanelRow[];
  /** The box the rows are laid out in; PANEL when absent. */
  readonly box?: PanelBox;
}

/** Vertical centre of `box`'s line `i`: one `rowSpacing` apart from 36 px below its top. */
export function rowY(box: PanelBox, i: number): number {
  return box.y + 36 + i * box.rowSpacing;
}

/** Lays `items` out as rows of `box`, one per line. */
export function rows(items: readonly Omit<PanelRow, 'y'>[], box: PanelBox = PANEL): PanelRow[] {
  return items.map((item, i) => ({ ...item, y: rowY(box, i) }));
}

/**
 * `text` broken at spaces into lines of at most `maxChars` characters (a
 * longer word gets a line of its own), since a row is a single line.
 */
export function wrapLines(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + 1 + word.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  return line ? [...lines, line] : lines;
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
