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
} from './menu';

// 10 px monospace: about 0.6 em a glyph and a 12 px line. Generous upper bounds.
const GLYPH_W = 6;
const LINE_H = 12;

const panelRight = MENU_PANEL.x + MENU_PANEL.w;
const panelBottom = MENU_PANEL.y + MENU_PANEL.h;

describe('world HUD menu layout', () => {
  it('has Save, Load, Settings and Title, in that order', () => {
    expect(menuItems(false).map((i) => [i.id, i.label])).toEqual([
      ['save', 'Save (F5)'],
      ['load', 'Load (F9)'],
      ['settings', 'Settings'],
      ['title', 'Title (Esc)'],
    ]);
  });

  it('adds Put down first while a tree is carried', () => {
    expect(menuItems(true).map((i) => [i.id, i.label])).toEqual([
      ['putdown', 'Put down'],
      ['save', 'Save (F5)'],
      ['load', 'Load (F9)'],
      ['settings', 'Settings'],
      ['title', 'Title (Esc)'],
    ]);
  });

  it('puts every row inside the panel, with or without Put down', () => {
    for (const item of [...menuItems(false), ...menuItems(true)]) {
      expect(item.x).toBeGreaterThan(MENU_PANEL.x);
      expect(item.x + item.label.length * GLYPH_W).toBeLessThanOrEqual(panelRight);
      expect(item.y - MENU_ROW_SPACING / 2).toBeGreaterThanOrEqual(MENU_PANEL.y);
      expect(item.y + MENU_ROW_SPACING / 2).toBeLessThanOrEqual(panelBottom);
    }
  });

  it('keeps rows apart by more than a line of text', () => {
    for (const carrying of [false, true]) {
      const ys = menuItems(carrying).map((i) => i.y);
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

  it('stays inside the room, clear of the badge and the View tree button', () => {
    expect(MENU_PANEL.x).toBeGreaterThanOrEqual(0);
    expect(MENU_PANEL.y).toBeGreaterThanOrEqual(0);
    expect(panelRight).toBeLessThanOrEqual(480);
    expect(panelBottom).toBeLessThanOrEqual(270);
    // The widest badge a long game could reach still starts right of the panel and the toast.
    const badge = hudText({ day: 9999, money: 9_999_999 });
    const badgeLeft = HUD_BADGE.right - badge.length * GLYPH_W;
    expect(badgeLeft).toBeGreaterThan(panelRight);
    expect(badgeLeft).toBeGreaterThan(TOAST_X + 'Could not save to slot 3'.length * GLYPH_W);
    expect(VIEW_BUTTON.bottom - LINE_H).toBeGreaterThan(panelBottom);
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
