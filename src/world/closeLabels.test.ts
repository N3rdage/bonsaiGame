import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import { inspectorCloseLabel } from './inspector';
import { menuItems, type MenuOptions } from './menu';
import { PANEL, PANEL_INSET, fitRows, panelCloseLabel, type PanelModel } from './panels';
import { renameCounter, renamePanel } from './treePanels';
import { DESKTOP_UI, PHONE_UI } from './uiScale';

const GLYPH_W = 6;

describe('panelCloseLabel', () => {
  it('names the key it is given, or none', () => {
    expect(panelCloseLabel('Esc')).toBe('Close (Esc)');
    expect(panelCloseLabel('Q')).toBe('Close (Q)');
    expect(panelCloseLabel(undefined)).toBe('Close');
  });
});

describe('inspectorCloseLabel', () => {
  it('names the key it is given, or none', () => {
    expect(inspectorCloseLabel('Esc')).toBe('[ESC] Close');
    expect(inspectorCloseLabel('Q')).toBe('[Q] Close');
    expect(inspectorCloseLabel(undefined)).toBe('Close');
  });
});

describe('the menu Title item', () => {
  it('names Esc where Escape reaches the game and no key where it does not', () => {
    const options: MenuOptions = {
      carrying: false,
      placeable: false,
      placing: false,
      escapeReaches: true,
    };
    const title = (escapeReaches: boolean) =>
      menuItems({ ...options, escapeReaches }, DESKTOP_UI).find((i) => i.id === 'title')?.label;
    expect(title(true)).toBe('Title (Esc)');
    expect(title(false)).toBe('Title');
  });
});

describe('the rename panel where Escape does not reach the game', () => {
  const tree = createNewGameState().trees[0];
  if (!tree) throw new Error('no starter tree');

  function widest(m: PanelModel): number {
    return Math.max(...m.rows.map((r) => r.text.length)) * GLYPH_W;
  }

  it('sends the player to Close, flags text entry, and still fits the box', () => {
    const m = renamePanel(tree, 'x'.repeat(20), false);
    expect(m.textEntry).toBe(true);
    expect(m.rows[2]?.text).toBe('Enter to save  |  Close to cancel  |  20/20');
    expect(renameCounter('', true)).toContain('Esc to cancel');
    for (const model of [m, fitRows(m, PHONE_UI)]) {
      const box = model.box ?? PANEL;
      expect(widest(model)).toBeLessThanOrEqual(box.w - 2 * PANEL_INSET);
    }
  });
});
