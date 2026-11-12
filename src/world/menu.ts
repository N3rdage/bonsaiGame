/**
 * Layout of the world HUD: the badge, the View tree and Notebook buttons, the toast and the
 * Menu button with its panel (Put down while carrying, Inventory, Sleep, Sleep a week, Save, Load,
 * Settings, Title), the
 * carry line, in logical px on the 480x270
 * canvas. Pure data; WorldScene draws it.
 */

import { estimatedBox, hitRect, type UiMetrics } from './uiScale';

/** Top-right anchor of the HUD badge (text origin 1, 0). */
export const HUD_BADGE = { right: 472, top: 2 } as const;
/** Bottom-left anchor of the `View tree (V)` button (text origin 0, 1). */
export const VIEW_BUTTON = { left: 6, bottom: 264 } as const;
/** Bottom-left anchor of the `Notebook (J)` button, right of View tree (text origin 0, 1). */
export const NOTEBOOK_BUTTON = { left: 96, bottom: 264 } as const;
/** Top-left of the `Menu` button (text origin 0, 0), where the toast used to start. */
export const MENU_BUTTON = { left: 6, top: 2 } as const;
/** Bottom-right anchor of the `Interact (E)` button (text origin 1, 1), shown while a prop is in range. */
export const INTERACT_BUTTON = { right: 474, bottom: 264 } as const;
/** Left edge of the toast, to the right of the Menu button. */
export const TOAST_X = 52;
/** The open panel's rectangle (top-left and size), just under the Menu button. */
export const MENU_PANEL = { x: 4, y: 16, w: 90, h: 134 } as const;
/** Left inset of the row labels inside the panel. */
export const MENU_ROW_INSET = 6;
/** Vertical distance between row centres; each row's tap band is this tall. */
export const MENU_ROW_SPACING = 16;

/** Top-right anchor of the `Carrying: <label>` line under the badge (text origin 1, 0). */
export const CARRY_TEXT = { right: 472, top: 14 } as const;

export type MenuItemId =
  'putdown' | 'inventory' | 'sleep' | 'sleep-week' | 'save' | 'load' | 'settings' | 'title';

export interface MenuItem {
  readonly id: MenuItemId;
  readonly label: string;
  /** Left edge of the label (text origin 0, 0.5). */
  readonly x: number;
  /** Vertical centre of the row. */
  readonly y: number;
}

const ITEMS: readonly { id: MenuItemId; label: string }[] = [
  { id: 'inventory', label: 'Inventory (I)' },
  { id: 'sleep', label: 'Sleep (Z)' },
  { id: 'sleep-week', label: 'Sleep a week' },
  { id: 'save', label: 'Save (F5)' },
  { id: 'load', label: 'Load (F9)' },
  { id: 'settings', label: 'Settings' },
  { id: 'title', label: 'Title (Esc)' },
];

/** The least room between the panel's edge and its rows' bands. */
const MENU_PAD = 3;

function entries(carrying: boolean): readonly { id: MenuItemId; label: string }[] {
  return carrying ? [{ id: 'putdown' as const, label: 'Put down' }, ...ITEMS] : ITEMS;
}

/** The row pitch: MENU_ROW_SPACING, or the tap target where that is taller. */
export function menuRowPitch(ui: UiMetrics): number {
  return Math.max(MENU_ROW_SPACING, ui.hit);
}

/** The bottom of the `Menu` button's tap target, from its estimated text box. */
function menuButtonHitBottom(ui: UiMetrics): number {
  const r = hitRect(estimatedBox('Menu', MENU_BUTTON.left, MENU_BUTTON.top, 0, 0, ui), ui.hit);
  return r.y + r.h;
}

/**
 * The panel's top, height and columns and where its rows start: MENU_PANEL,
 * its top lowered to just above the Menu button's tap target and its height
 * grown to hold rows of `ui`'s pitch, the rows centred in it. Where one column
 * would reach View tree's tap target, the rows split evenly into as many
 * MENU_PANEL.w wide columns as keep it clear, and the panel hugs them.
 */
function layout(
  carrying: boolean,
  ui: UiMetrics,
): { y: number; h: number; top: number; columns: number; perColumn: number } {
  const count = entries(carrying).length;
  const pitch = menuRowPitch(ui);
  const minTop = Math.max(MENU_PANEL.y + MENU_PAD, menuButtonHitBottom(ui));
  const y = Math.max(MENU_PANEL.y, minTop - MENU_PAD);
  const fit = Math.max(1, Math.floor((270 - ui.hit - y - 2 * MENU_PAD) / pitch));
  const columns = Math.ceil(count / fit);
  const perColumn = Math.ceil(count / columns);
  const rowsH = perColumn * pitch;
  const h = Math.max(columns === 1 ? MENU_PANEL.h : 0, rowsH + 2 * MENU_PAD);
  return { y, h, top: y + (h - rowsH) / 2, columns, perColumn };
}

/** The open panel's rectangle: MENU_PANEL, lower, taller and wider where `ui`'s rows need it. */
export function menuPanel(
  carrying: boolean,
  ui: UiMetrics,
): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
  const { y, h, columns } = layout(carrying, ui);
  return { ...MENU_PANEL, y, h, w: MENU_PANEL.w * columns };
}

/**
 * The panel's rows, top to bottom and then column by column, centred in the
 * panel's height and clear of the Menu button's tap target, one
 * `menuRowPitch` apart; `Put down` first while carrying a tree.
 */
export function menuItems(carrying: boolean, ui: UiMetrics): readonly MenuItem[] {
  const pitch = menuRowPitch(ui);
  const { top, perColumn } = layout(carrying, ui);
  return entries(carrying).map((item, i) => ({
    ...item,
    x: MENU_PANEL.x + MENU_ROW_INSET + Math.floor(i / perColumn) * MENU_PANEL.w,
    y: top + ((i % perColumn) + 0.5) * pitch,
  }));
}
