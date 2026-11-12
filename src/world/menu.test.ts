import { describe, expect, it } from 'vitest';
import { hudText } from './hud';
import {
  CARRY_TEXT,
  HUD_BADGE,
  INTERACT_BUTTON,
  MENU_BUTTON,
  MENU_PANEL,
  MENU_ROW_SPACING,
  NOTEBOOK_BUTTON,
  TOAST_X,
  VIEW_BUTTON,
  menuItems,
  menuPanel,
  menuRowPitch,
  type MenuOptions,
} from './menu';
import { DESKTOP_UI, PHONE_UI, estimatedBox, hitRect } from './uiScale';

// 10 px monospace, the fallback and the widest face text can draw in (VT323 is 0.4 em): about 0.6 em a glyph and a 12 px line. Generous upper bounds.
const GLYPH_W = 6;
const LINE_H = 12;

const panelRight = MENU_PANEL.x + MENU_PANEL.w;

/** The menu outside a room that takes furniture. */
const opts = (carrying: boolean): MenuOptions => ({ carrying, placeable: false, placing: false });

describe('world HUD menu layout', () => {
  it('has Inventory, Sleep, Sleep a week, Save, Load, Settings and Title, in that order', () => {
    expect(menuItems(opts(false), DESKTOP_UI).map((i) => [i.id, i.label])).toEqual([
      ['inventory', 'Inventory (I)'],
      ['sleep', 'Sleep (Z)'],
      ['sleep-week', 'Sleep a week'],
      ['save', 'Save (F5)'],
      ['load', 'Load (F9)'],
      ['settings', 'Settings'],
      ['title', 'Title (Esc)'],
    ]);
  });

  it('adds Put down first while a tree is carried', () => {
    expect(menuItems(opts(true), DESKTOP_UI).map((i) => [i.id, i.label])).toEqual([
      ['putdown', 'Put down'],
      ['inventory', 'Inventory (I)'],
      ['sleep', 'Sleep (Z)'],
      ['sleep-week', 'Sleep a week'],
      ['save', 'Save (F5)'],
      ['load', 'Load (F9)'],
      ['settings', 'Settings'],
      ['title', 'Title (Esc)'],
    ]);
  });

  it('puts every row inside the panel, with or without Put down, at either scale', () => {
    for (const ui of [DESKTOP_UI, PHONE_UI]) {
      for (const carrying of [false, true]) {
        const panel = menuPanel(opts(carrying), ui);
        const pitch = menuRowPitch(ui);
        for (const item of menuItems(opts(carrying), ui)) {
          expect(item.x).toBeGreaterThan(panel.x);
          expect(item.x + item.label.length * GLYPH_W).toBeLessThanOrEqual(panel.x + panel.w);
          expect(item.y - pitch / 2).toBeGreaterThanOrEqual(panel.y);
          expect(item.y + pitch / 2).toBeLessThanOrEqual(panel.y + panel.h);
        }
      }
    }
  });

  it("hugs its rows on the phone, below the Menu button's tap target, rows centred", () => {
    for (const carrying of [false, true]) {
      const panel = menuPanel(opts(carrying), PHONE_UI);
      const items = menuItems(opts(carrying), PHONE_UI);
      const pitch = menuRowPitch(PHONE_UI);
      // The Menu button's tap target reaches y 31 (its text grown to 31 px from the top edge).
      expect(items[0]?.y).toBe(31 + pitch / 2);
      expect(panel.y).toBe(28);
      expect(panel.y).toBeGreaterThanOrEqual(MENU_PANEL.y);
      const first = (items[0]?.y ?? 0) - pitch / 2;
      // The first column's last row (the second column may be a row short).
      const last = (items[3]?.y ?? 0) + pitch / 2;
      expect(first - panel.y).toBe(panel.y + panel.h - last);
      expect(first - panel.y).toBe(3);
      expect(panel.y + panel.h).toBeLessThanOrEqual(270 - PHONE_UI.hit);
    }
  });

  it('splits its rows into two columns of four on the phone, column by column', () => {
    for (const carrying of [false, true]) {
      const items = menuItems(opts(carrying), PHONE_UI);
      const x = MENU_PANEL.x + 6;
      expect(items.map((i) => i.x)).toEqual(items.map((_, i) => (i < 4 ? x : x + MENU_PANEL.w)));
      expect(items[4]?.y).toBe(items[0]?.y);
      expect(menuPanel(opts(carrying), PHONE_UI).w).toBe(2 * MENU_PANEL.w);
    }
  });

  it('is MENU_PANEL with rows MENU_ROW_SPACING apart at the desktop scale', () => {
    expect(menuPanel(opts(true), DESKTOP_UI)).toEqual(MENU_PANEL);
    expect(menuPanel(opts(false), DESKTOP_UI)).toEqual(MENU_PANEL);
    expect(menuItems(opts(false), DESKTOP_UI).map((i) => i.y)).toEqual([
      35, 51, 67, 83, 99, 115, 131,
    ]);
    expect(menuRowPitch(PHONE_UI)).toBe(PHONE_UI.hit);
  });

  it('keeps rows apart by more than a line of text', () => {
    for (const carrying of [false, true]) {
      const ys = menuItems(opts(carrying), DESKTOP_UI).map((i) => i.y);
      for (let i = 1; i < ys.length; i += 1) {
        expect((ys[i] ?? 0) - (ys[i - 1] ?? 0)).toBeGreaterThanOrEqual(LINE_H);
      }
    }
    expect(MENU_ROW_SPACING).toBeGreaterThanOrEqual(LINE_H);
  });

  it('puts the carry line under the badge, clear of the menu panel and the toast', () => {
    expect(CARRY_TEXT.right).toBe(HUD_BADGE.right);
    expect(CARRY_TEXT.top).toBeGreaterThanOrEqual(HUD_BADGE.top + LINE_H);
    // A long name still starts right of the open menu panel.
    const left = CARRY_TEXT.right - 'Carrying: Japanese Maple #12'.length * GLYPH_W;
    expect(left).toBeGreaterThan(panelRight);
    expect(CARRY_TEXT.top).toBeGreaterThanOrEqual(2 + LINE_H);
  });

  it('opens the panel under the Menu button, clear of the toast', () => {
    expect(MENU_PANEL.y).toBeGreaterThanOrEqual(MENU_BUTTON.top + LINE_H);
    expect(MENU_PANEL.x).toBeLessThanOrEqual(MENU_BUTTON.left);
    expect(MENU_BUTTON.left + 'Menu'.length * GLYPH_W).toBeLessThan(TOAST_X);
  });

  it('stays inside the room, clear of the badge and the View tree button, at either scale', () => {
    for (const ui of [DESKTOP_UI, PHONE_UI]) {
      const panel = menuPanel(opts(true), ui);
      const right = panel.x + panel.w;
      const bottom = panel.y + panel.h;
      expect(panel.x).toBeGreaterThanOrEqual(0);
      expect(panel.y).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(480);
      expect(bottom).toBeLessThanOrEqual(270);
      // The widest badge a long game could reach still starts right of the panel and the toast.
      const badge = hudText({ day: 9999, money: 9_999_999 });
      const badgeLeft = HUD_BADGE.right - badge.length * GLYPH_W;
      expect(badgeLeft).toBeGreaterThan(right);
      expect(badgeLeft).toBeGreaterThan(TOAST_X + 'Could not save to slot 3'.length * GLYPH_W);
      // Clear of View tree's tap target too, which grows up from the bottom edge.
      expect(Math.min(VIEW_BUTTON.bottom - LINE_H, 270 - ui.hit)).toBeGreaterThan(bottom);
    }
  });

  it('offers Place item where furniture can go, and Stop placing and Next while placing', () => {
    const rows = (o: MenuOptions) => menuItems(o, DESKTOP_UI).map((i) => [i.id, i.label]);
    const rest = rows(opts(false));
    expect(rows({ carrying: false, placeable: true, placing: false })).toEqual([
      ['place', 'Place item'],
      ...rest,
    ]);
    expect(rows({ carrying: true, placeable: true, placing: false })).toEqual([
      ['putdown', 'Put down'],
      ['place', 'Place item'],
      ...rest,
    ]);
    expect(
      rows({ carrying: false, placeable: true, placing: true, nextKind: 'Floor shelf' }),
    ).toEqual([['place', 'Stop placing'], ['place-next', 'Next: Floor shelf'], ...rest]);
    // Placing the last kind in stock: nothing to switch to.
    expect(rows({ carrying: false, placeable: true, placing: true })).toEqual([
      ['place', 'Stop placing'],
      ...rest,
    ]);
  });

  const longest: MenuOptions = {
    carrying: true,
    placeable: true,
    placing: true,
    nextKind: 'Floor shelf',
  };

  it('lays 8, 9 and 10 rows out column by column on the phone, clear of View tree', () => {
    const viewTop = hitRect(
      estimatedBox('View tree (V)', VIEW_BUTTON.left, VIEW_BUTTON.bottom, 0, 1, PHONE_UI),
      PHONE_UI.hit,
    ).y;
    const cases: [MenuOptions, number, number][] = [
      [{ carrying: false, placeable: true, placing: false }, 2, 4],
      [{ carrying: true, placeable: true, placing: false }, 2, 5],
      [{ carrying: false, placeable: true, placing: true, nextKind: 'Floor shelf' }, 2, 5],
      [longest, 2, 5],
    ];
    const x = MENU_PANEL.x + 6;
    for (const [o, columns, perColumn] of cases) {
      const panel = menuPanel(o, PHONE_UI);
      const items = menuItems(o, PHONE_UI);
      const pitch = menuRowPitch(PHONE_UI);
      expect(panel.w).toBe(columns * MENU_PANEL.w);
      expect(items.map((i) => i.x)).toEqual(
        items.map((_, i) => x + Math.floor(i / perColumn) * MENU_PANEL.w),
      );
      expect(items[perColumn]?.y).toBe(items[0]?.y);
      expect(panel.y + panel.h).toBeLessThanOrEqual(viewTop);
      for (const item of items) {
        const box = estimatedBox(item.label, item.x, item.y, 0, 0.5, PHONE_UI);
        expect(box.x + box.w).toBeLessThanOrEqual(panel.x + panel.w);
        expect(item.y + pitch / 2).toBeLessThanOrEqual(panel.y + panel.h);
      }
    }
  });

  it('grows the desktop panel down for 9 and 10 rows, in one column', () => {
    for (const o of [{ ...longest, carrying: false }, longest]) {
      const panel = menuPanel(o, DESKTOP_UI);
      const items = menuItems(o, DESKTOP_UI);
      expect(panel.w).toBe(MENU_PANEL.w);
      expect(panel.h).toBe(items.length * MENU_ROW_SPACING + 6);
      expect(panel.h).toBeGreaterThan(MENU_PANEL.h);
      expect(items.every((i) => i.x === MENU_PANEL.x + 6)).toBe(true);
      expect(panel.y + panel.h).toBeLessThan(VIEW_BUTTON.bottom - LINE_H);
    }
  });

  it('puts the Notebook button beside View tree, clear of it and of Interact', () => {
    const right = NOTEBOOK_BUTTON.left + 'Notebook (J)'.length * GLYPH_W;
    expect(NOTEBOOK_BUTTON.bottom).toBe(VIEW_BUTTON.bottom);
    expect(NOTEBOOK_BUTTON.left).toBeGreaterThan(
      VIEW_BUTTON.left + 'View tree (V)'.length * GLYPH_W,
    );
    expect(right).toBeLessThan(INTERACT_BUTTON.right - 'Interact (E)'.length * GLYPH_W);
  });

  it('puts the Interact button bottom-right, clear of the View tree button and the badge', () => {
    const left = INTERACT_BUTTON.right - 'Interact (E)'.length * GLYPH_W;
    expect(INTERACT_BUTTON.right).toBeLessThanOrEqual(480);
    expect(INTERACT_BUTTON.bottom).toBeLessThanOrEqual(270);
    expect(left).toBeGreaterThan(VIEW_BUTTON.left + 'View tree (V)'.length * GLYPH_W);
    expect(INTERACT_BUTTON.bottom - LINE_H).toBeGreaterThan(HUD_BADGE.top + LINE_H);
    expect(left).toBeGreaterThan(panelRight);
  });
});
