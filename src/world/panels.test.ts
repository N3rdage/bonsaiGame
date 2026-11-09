import { describe, expect, it } from 'vitest';
import {
  PANEL,
  PANEL_CLOSE,
  PANEL_CLOSE_LABEL,
  PANEL_INSET,
  PANEL_ROW_SPACING,
  PANEL_TITLE_Y,
  loadSlotsPanel,
  pedestalPanel,
  wrapLines,
  type PanelModel,
} from './panels';
import { createNewGameState } from '../sim/state';
import type { SlotRow } from './saveSlots';

// 10 px monospace: about 0.6 em a glyph and a 12 px line. Generous upper bounds.
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
    const carrying = pedestalPanel('shed_main', tree);
    expect([carrying.key, carrying.title]).toEqual(['pedestal:shed_main', 'Display Pedestal']);
    expect(carrying.rows.map((r) => [r.text, r.id])).toEqual([["Place Granny's", 'panel-place']]);
    const empty = pedestalPanel('shed_window', undefined);
    expect(empty.key).toBe('pedestal:shed_window');
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

function fits(model: PanelModel): boolean {
  return model.rows.every(
    (row) =>
      PANEL.x + PANEL_INSET + row.text.length * GLYPH_W <= PANEL.x + PANEL.w &&
      row.y + PANEL_ROW_SPACING / 2 <= PANEL_CLOSE.y - LINE_H / 2,
  );
}
