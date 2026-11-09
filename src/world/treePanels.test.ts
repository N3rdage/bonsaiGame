import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import { STYLE_KEYS } from '../sim/styles';
import type { BonsaiTree, GameState } from '../sim/types';
import { PANEL, PANEL_INSET, panelClose, panelTitleY, type PanelModel } from './panels';
import {
  PRICE_COLOR,
  RENAME_INPUT,
  renameCounter,
  renamePanel,
  repotPanel,
  sellPanel,
  stylePanel,
} from './treePanels';

// 10 px monospace: generous upper bounds of a glyph's width and a line's height.
const GLYPH_W = 6;
const LINE_H = 12;

function starter(): { state: GameState; tree: BonsaiTree } {
  const state = createNewGameState();
  const tree = state.trees[0];
  if (!tree) throw new Error('no starter');
  return { state, tree };
}

const lines = (m: PanelModel): [string, string][] => m.rows.map((r) => [r.text, r.id]);

/** Title, rows and Close inside the box, in order and at least a line apart. */
function fits(m: PanelModel): boolean {
  const box = m.box ?? PANEL;
  const close = panelClose(box);
  let above = panelTitleY(box);
  for (const row of m.rows) {
    if (row.y - above < LINE_H) return false;
    if (box.x + PANEL_INSET + row.text.length * GLYPH_W > box.x + box.w - PANEL_INSET) return false;
    above = row.y;
  }
  return (
    close.y - above >= LINE_H &&
    close.y + LINE_H / 2 <= box.y + box.h &&
    box.x * 2 + box.w === 480 &&
    box.y * 2 + box.h === 270
  );
}

describe('repot panel', () => {
  it('shows the prototype lines and the standard pot only, without akadama', () => {
    const { state, tree } = starter();
    state.day = 120;
    tree.vigor = 31.7;
    state.inventory.pot = 2;
    state.inventory.fancy_pot = 0;
    state.inventory.soil_premium = 0;
    const m = repotPanel(tree, state, false);
    expect([m.key, m.title]).toEqual(['repot:0', 'Repot Tree']);
    expect(lines(m)).toEqual([
      ['Repot "Granny\'s"?', ''],
      ['Species: Juniper', ''],
      ['Current pot: Standard', ''],
      ['Vigor: 31 / 100 (resets to 50)', ''],
      ['Days since last repot: 120', ''],
      ['Akadama mix: 0', ''],
      ['Standard Pot (2)', 'panel-repot-standard'],
      ['Fancy Pot (0)', 'panel-repot-fancy'],
    ]);
    expect(m.rows.map((r) => r.enabled ?? true).slice(-2)).toEqual([true, false]);
    expect(fits(m)).toBe(true);
  });

  it('greys the standard pot without stock and offers the soil toggle with akadama', () => {
    const { state, tree } = starter();
    tree.name = '';
    tree.potTier = 1;
    state.inventory.pot = 0;
    state.inventory.fancy_pot = 1;
    state.inventory.soil_premium = 3;
    const off = repotPanel(tree, state, false);
    expect(off.rows[0]?.text).toBe('Repot (unnamed)?');
    expect(off.rows[2]?.text).toBe('Current pot: Fancy');
    expect(lines(off).slice(-4)).toEqual([
      ['Akadama mix: 3', ''],
      ['[ ] Use premium soil (slower vigor loss)', 'panel-soil'],
      ['Standard Pot (0)', 'panel-repot-standard'],
      ['Fancy Pot (1)', 'panel-repot-fancy'],
    ]);
    expect(off.rows.slice(-2).map((r) => r.enabled)).toEqual([false, true]);
    const on = repotPanel(tree, state, true);
    expect(on.rows.at(-3)?.text).toBe('[x] Use premium soil (slower vigor loss)');
    expect(fits(on)).toBe(true);
  });
});

describe('sell panel', () => {
  it('shows the score and the price sellTree banks, in gold', () => {
    const { tree } = starter();
    const m = sellPanel(tree);
    expect([m.key, m.title]).toEqual(['sell:0', 'Sell Tree']);
    expect(lines(m)).toEqual([
      ['Sell "Granny\'s"?', ''],
      ['Species: Juniper', ''],
      ['Score: 74 / 100', ''],
      ['Sale price: 148 coins', ''],
      ['Sell', 'panel-sell'],
    ]);
    expect(m.rows[3]?.color).toBe(PRICE_COLOR);
    expect(fits(m)).toBe(true);
  });
});

describe('style panel', () => {
  it('lists every style, the current one marked, then (none)', () => {
    const { tree } = starter();
    const none = stylePanel(tree);
    expect([none.key, none.title]).toEqual(['style:0', 'Tree Style']);
    expect(lines(none)).toEqual([
      ['Pick a target style for this tree.', ''],
      ['  Formal Upright (Chokkan)', 'panel-style-formal_upright'],
      ['  Informal Upright (Moyogi)', 'panel-style-informal_upright'],
      ['  Slanting (Shakan)', 'panel-style-slanting'],
      ['  Cascade (Kengai)', 'panel-style-cascade'],
      ['  Broom (Hokidachi)', 'panel-style-broom'],
      ['  Windswept (Fukinagashi)', 'panel-style-windswept'],
      ['> (none)', 'panel-style-none'],
    ]);
    expect(none.rows).toHaveLength(STYLE_KEYS.length + 2);
    tree.targetStyle = 'cascade';
    const cascade = stylePanel(tree);
    expect(cascade.rows.filter((r) => r.text.startsWith('>')).map((r) => r.id)).toEqual([
      'panel-style-cascade',
    ]);
    expect(fits(cascade)).toBe(true);
  });
});

describe('rename panel', () => {
  it('shows the current name, the input row, the counter and Save', () => {
    const { tree } = starter();
    const m = renamePanel(tree, "Granny's");
    expect([m.key, m.title]).toEqual(['rename:0', 'Rename Tree']);
    expect(lines(m)).toEqual([
      ['Current name: "Granny\'s"', ''],
      ['New name:', ''],
      ['Enter to save  |  Esc to cancel  |  8/20', ''],
      ['Save', 'panel-rename-save'],
    ]);
    tree.name = '';
    expect(renamePanel(tree, '').rows[0]?.text).toBe('Current name: (unnamed)');
    expect(renameCounter('x'.repeat(25))).toMatch(/ 20\/20$/);
    expect(fits(m)).toBe(true);
  });

  it('puts the input on the New name row, right of its label, inside the box', () => {
    const { tree } = starter();
    const row = renamePanel(tree, '').rows[1];
    if (!row) throw new Error('no row');
    expect(RENAME_INPUT.y).toBe(row.y);
    expect(RENAME_INPUT.x).toBeGreaterThan(PANEL.x + PANEL_INSET + row.text.length * GLYPH_W);
    expect(RENAME_INPUT.x + RENAME_INPUT.w).toBeLessThanOrEqual(PANEL.x + PANEL.w - PANEL_INSET);
    expect(RENAME_INPUT.h).toBeLessThan(PANEL.rowSpacing);
  });
});
