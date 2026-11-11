import { describe, expect, it } from 'vitest';
import {
  PANEL,
  PANEL_CLOSE,
  PANEL_CLOSE_LABEL,
  PANEL_INSET,
  PANEL_ROW_SPACING,
  PANEL_TITLE_Y,
  fitRows,
  isControl,
  loadSlotsPanel,
  panelClose,
  panelTitleY,
  pedestalPanel,
  wrapLines,
  type PanelModel,
} from './panels';
import { DEFAULT_SETTINGS } from '../platform/settings';
import { createNewGameState } from '../sim/state';
import { TUTORIAL_DONE, tutorialAllSteps } from '../sim/tutorial';
import type { InventoryKey } from '../sim/types';
import { inventoryPanel } from './inventoryPanel';
import { notebookPages, notebookPanel } from './notebook';
import { NO_SELECTION, plantPanel, type PlantSelection } from './plantPanel';
import type { SlotRow } from './saveSlots';
import { settingsPanel } from './settingsPanel';
import { SHOP_PANEL, shopPanel } from './shopPanel';
import { renamePanel, repotPanel, sellPanel, stylePanel } from './treePanels';
import { skipConfirmPanel } from './tutorialPanel';
import {
  DESKTOP_UI,
  PHONE_UI,
  estimatedBox,
  hitRect,
  rectsOverlap,
  type UiMetrics,
} from './uiScale';

// 10 px monospace, the fallback and the widest face text can draw in (VT323 is 0.4 em): about 0.6 em a glyph and a 12 px line. Generous upper bounds.
const GLYPH_W = 6;
const LINE_H = 12;

const widest: SlotRow = {
  slot: 3,
  status: 'occupied',
  day: 9999,
  money: 9_999_999,
  savedAt: '2026-11-09 02:15',
};
const empty = (slot: number): SlotRow => ({ slot, status: 'empty', day: 0, money: 0, savedAt: '' });

describe('world panels', () => {
  it('centres the box inside the 480x270 canvas', () => {
    expect(PANEL.x).toBeGreaterThanOrEqual(0);
    expect(PANEL.y).toBeGreaterThanOrEqual(0);
    expect(PANEL.x + PANEL.w).toBeLessThanOrEqual(480);
    expect(PANEL.y + PANEL.h).toBeLessThanOrEqual(270);
    expect(PANEL.x * 2 + PANEL.w).toBe(480);
    expect(PANEL.y * 2 + PANEL.h).toBe(270);
  });

  it('keeps the title, every row and Close inside the box, in order and apart', () => {
    const model = loadSlotsPanel([widest, widest, widest]);
    let above = PANEL_TITLE_Y;
    expect(PANEL_TITLE_Y - LINE_H / 2).toBeGreaterThanOrEqual(PANEL.y);
    for (const row of model.rows) {
      expect(row.y - above).toBeGreaterThanOrEqual(LINE_H);
      expect(PANEL.x + PANEL_INSET + row.text.length * GLYPH_W).toBeLessThanOrEqual(
        PANEL.x + PANEL.w,
      );
      above = row.y;
    }
    expect(above + PANEL_ROW_SPACING / 2).toBeLessThanOrEqual(PANEL_CLOSE.y - LINE_H / 2);
    expect(PANEL_CLOSE.y + LINE_H / 2).toBeLessThanOrEqual(PANEL.y + PANEL.h);
    expect((PANEL_CLOSE_LABEL.length * GLYPH_W) / 2).toBeLessThan(PANEL.w / 2);
  });

  it('offers only readable saves in the load picker', () => {
    const corrupt: SlotRow = { ...empty(2), status: 'corrupt' };
    const model = loadSlotsPanel([widest, corrupt, empty(1)]);
    expect(model.key).toBe('slots');
    expect(model.title).toBe('Load Game');
    expect(model.rows.map((r) => r.id)).toEqual(['panel-slot-3', '', '']);
    expect(model.rows[0]?.text.endsWith('  [Load]')).toBe(true);
    expect(model.rows[1]?.text.endsWith('[Load]')).toBe(false);
    expect(model.rows[2]?.text).toBe('Slot 1  (empty)');
  });

  it('shows three empty rows when nothing is saved', () => {
    const model = loadSlotsPanel([empty(1), empty(2), empty(3)]);
    expect(model.rows).toHaveLength(3);
    expect(model.rows.every((r) => r.id === '')).toBe(true);
  });

  it('offers Place on an empty pedestal only while carrying', () => {
    const tree = createNewGameState().trees[0];
    const carrying = pedestalPanel('lounge_mantel', tree);
    expect([carrying.key, carrying.title]).toEqual(['pedestal:lounge_mantel', 'Display Pedestal']);
    expect(carrying.rows.map((r) => [r.text, r.id])).toEqual([["Place Granny's", 'panel-place']]);
    const empty = pedestalPanel('lounge_side_table', undefined);
    expect(empty.key).toBe('pedestal:lounge_side_table');
    expect(empty.rows.map((r) => [r.text, r.id])).toEqual([
      ['This pedestal is empty. Carry a tree here to display it.', ''],
    ]);
    expect(fits(carrying) && fits(empty)).toBe(true);
  });
});

describe('wrapLines', () => {
  it('breaks at spaces into lines no longer than the limit', () => {
    expect(wrapLines('the quick brown fox jumps', 10)).toEqual(['the quick', 'brown fox', 'jumps']);
    expect(wrapLines('short', 10)).toEqual(['short']);
    expect(wrapLines('', 10)).toEqual([]);
  });

  it('gives a word longer than the limit a line of its own', () => {
    expect(wrapLines('a extraordinarily b', 5)).toEqual(['a', 'extraordinarily', 'b']);
  });
});

/** Every panel model the world and the title draw, in the states that give each its most rows and controls. */
function everyPanel(ui: UiMetrics): PanelModel[] {
  const state = createNewGameState();
  const tree = state.trees[0];
  if (!tree) throw new Error('no starter');
  const stocked = createNewGameState();
  for (const key of Object.keys(stocked.inventory) as InventoryKey[]) {
    stocked.inventory[key] = 99;
  }
  stocked.money = 9_999_999;
  const poor = { ...createNewGameState(), money: 0 };
  const selections: PlantSelection[] = [
    NO_SELECTION,
    { kind: 'cutting', species: 'juniper', useFancyPot: true, usePremiumSoil: true },
    { kind: 'cutting', species: 'maple', useFancyPot: false, usePremiumSoil: false },
    { kind: 'seed', species: 'maple', useFancyPot: true, usePremiumSoil: true },
  ];
  const noPots = createNewGameState();
  noPots.inventory.pot = 0;
  noPots.inventory.cutting_juniper = 1;
  const notebooks = [...tutorialAllSteps(), TUTORIAL_DONE].flatMap((step) => {
    const s = { ...createNewGameState(), tutorialStep: step };
    return notebookPages(step).map((_, page) => notebookPanel(s, page));
  });
  return [
    loadSlotsPanel([widest, widest, widest]),
    loadSlotsPanel([empty(1), { ...empty(2), status: 'corrupt' }, widest]),
    pedestalPanel('lounge_mantel', tree),
    pedestalPanel('lounge_mantel', undefined),
    settingsPanel(DEFAULT_SETTINGS, { available: true, active: false }),
    settingsPanel(DEFAULT_SETTINGS, { available: false, active: false }),
    shopPanel(stocked, ui),
    shopPanel(poor, ui),
    ...selections.flatMap((sel) => [plantPanel(stocked, sel, ui), plantPanel(state, sel, ui)]),
    plantPanel(noPots, { ...NO_SELECTION, species: 'juniper' }, ui),
    ...notebooks,
    inventoryPanel(stocked.inventory),
    inventoryPanel(state.inventory),
    skipConfirmPanel(),
    repotPanel(tree, stocked, true, ui),
    repotPanel(tree, state, false, ui),
    sellPanel(tree),
    stylePanel(tree, ui),
    renamePanel(tree, 'x'.repeat(20)),
  ];
}

describe('fitRows', () => {
  it('leaves every panel as modelled at the desktop scale', () => {
    for (const model of everyPanel(DESKTOP_UI)) expect(fitRows(model, DESKTOP_UI)).toBe(model);
  });

  it('fits every panel inside the canvas on the phone, controls apart and above Close', () => {
    const ui = PHONE_UI;
    for (const model of everyPanel(ui).map((m) => fitRows(m, ui))) {
      const box = model.box ?? PANEL;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y + box.h).toBeLessThanOrEqual(270);
      expect(box.x + box.w).toBeLessThanOrEqual(480);
      const close = panelClose(box);
      const closeHit = hitRect(
        estimatedBox(PANEL_CLOSE_LABEL, close.x, close.y, 0.5, 0.5, ui),
        ui.hit,
      );
      expect(closeHit.y + closeHit.h).toBeLessThanOrEqual(box.y + box.h);
      const hits = [closeHit];
      for (const row of model.rows) {
        const x = row.x ?? box.x + PANEL_INSET;
        const [left, right] =
          row.align === 'right'
            ? [x - row.text.length * GLYPH_W, x]
            : [x, x + row.text.length * GLYPH_W];
        expect(left).toBeGreaterThanOrEqual(box.x);
        expect(right).toBeLessThanOrEqual(box.x + box.w);
        expect(row.y - LINE_H / 2).toBeGreaterThanOrEqual(panelTitleY(box) + LINE_H / 2);
        if (row.y !== close.y) expect(row.y + LINE_H / 2).toBeLessThanOrEqual(closeHit.y);
        if (isControl(row))
          hits.push(hitRect(estimatedBox(row.text, x, row.y, 0, 0.5, ui), ui.hit));
      }
      hits.forEach((a, i) => {
        expect(a.y).toBeGreaterThanOrEqual(box.y);
        for (const b of hits.slice(i + 1)) expect(rectsOverlap(a, b), model.key).toBe(false);
      });
    }
  });

  it('gives control lines the tap target as pitch, grows the box and recentres it', () => {
    const fitted = fitRows(loadSlotsPanel([widest, widest, widest]), PHONE_UI);
    expect(fitted.rows.map((r) => r.y)).toEqual([96, 127, 158]);
    expect(fitted.box).toEqual(PANEL);
    // Six affordable Buy lines under the headers: 36, then 62 to 217 at 31 apart, then Close's 47.
    const rich = { ...createNewGameState(), money: 1000 };
    const shop = fitRows(shopPanel(rich, PHONE_UI), PHONE_UI);
    expect(shop.box).toEqual({ ...SHOP_PANEL, y: 3, h: 264 });
    expect([...new Set(shop.rows.map((r) => r.y))]).toEqual([39, 65, 96, 127, 158, 189, 220, 251]);
    expect(panelClose(SHOP_PANEL).y).not.toBe(251);
    // Settings' four switches: PANEL grows to 176 tall, recentred, Close's line at 207.
    const settings = fitRows(
      settingsPanel(DEFAULT_SETTINGS, { available: true, active: false }),
      PHONE_UI,
    );
    expect(settings.box).toEqual({ ...PANEL, y: 47, h: 176 });
    expect(settings.rows.map((r) => [r.id, r.y])).toEqual([
      ['panel-fullscreen', 83],
      ['panel-weather', 114],
      ['panel-sound', 145],
      ['panel-music', 176],
    ]);
    expect(panelClose(settings.box ?? PANEL).y).toBe(207);
  });
});

function fits(model: PanelModel): boolean {
  return model.rows.every(
    (row) =>
      PANEL.x + PANEL_INSET + row.text.length * GLYPH_W <= PANEL.x + PANEL.w &&
      row.y + PANEL_ROW_SPACING / 2 <= PANEL_CLOSE.y - LINE_H / 2,
  );
}
