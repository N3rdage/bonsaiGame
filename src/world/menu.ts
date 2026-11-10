/**
 * Layout of the world HUD: the badge, the View tree and Notebook buttons, the toast and the
 * Menu button with its panel (Put down while carrying, Inventory, Save, Load, Settings, Title), the
 * carry line, in logical px on the 480x270
 * canvas. Pure data; WorldScene draws it.
 */

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
export const MENU_PANEL = { x: 4, y: 16, w: 90, h: 102 } as const;
/** Left inset of the row labels inside the panel. */
export const MENU_ROW_INSET = 6;
/** Vertical distance between row centres; each row's tap band is this tall. */
export const MENU_ROW_SPACING = 16;

/** Top-right anchor of the `Carrying: <label>` line under the badge (text origin 1, 0). */
export const CARRY_TEXT = { right: 472, top: 14 } as const;

export type MenuItemId = 'putdown' | 'inventory' | 'save' | 'load' | 'settings' | 'title';

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
  { id: 'save', label: 'Save (F5)' },
  { id: 'load', label: 'Load (F9)' },
  { id: 'settings', label: 'Settings' },
  { id: 'title', label: 'Title (Esc)' },
];

/** The panel's rows, top to bottom, centred in the panel's height; `Put down` first while carrying a tree. */
export function menuItems(carrying: boolean): readonly MenuItem[] {
  const items = carrying ? [{ id: 'putdown' as const, label: 'Put down' }, ...ITEMS] : ITEMS;
  const top = MENU_PANEL.y + (MENU_PANEL.h - items.length * MENU_ROW_SPACING) / 2;
  return items.map((item, i) => ({
    ...item,
    x: MENU_PANEL.x + MENU_ROW_INSET,
    y: top + (i + 0.5) * MENU_ROW_SPACING,
  }));
}
