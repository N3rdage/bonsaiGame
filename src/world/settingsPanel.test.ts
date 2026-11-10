import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../platform/settings';
import { PANEL, PANEL_INSET, panelClose, panelTitleY } from './panels';
import { settingsPanel } from './settingsPanel';

// 10 px monospace, the fallback and the widest face text can draw in (VT323 is 0.4 em): about 0.6 em a glyph and a 12 px line. Generous upper bounds.
const GLYPH_W = 6;
const LINE_H = 12;

const live = { available: true, active: false };

describe('settings panel', () => {
  it('is titled Settings with Fullscreen and Weather effects toggles', () => {
    const model = settingsPanel(DEFAULT_SETTINGS, live);
    expect([model.key, model.title, model.box]).toEqual(['settings', 'Settings', undefined]);
    expect(model.rows.map((r) => [r.id, r.text, r.enabled ?? true])).toEqual([
      ['panel-fullscreen', 'Fullscreen: Off', true],
      ['panel-weather', 'Weather effects: On', true],
    ]);
  });

  it('shows the live fullscreen state and the stored weather flag', () => {
    const model = settingsPanel(
      { fullscreen: false, weather: false },
      { available: true, active: true },
    );
    expect(model.rows.map((r) => r.text)).toEqual(['Fullscreen: On', 'Weather effects: Off']);
  });

  it('greys Fullscreen out where the browser has no Fullscreen API', () => {
    const row = settingsPanel(
      { fullscreen: true, weather: true },
      { available: false, active: false },
    ).rows[0];
    expect([row?.text, row?.enabled]).toEqual(['Fullscreen: not available', false]);
  });

  it('keeps every row inside the box, apart and above Close', () => {
    for (const available of [true, false]) {
      const ys = [panelTitleY(PANEL)];
      for (const row of settingsPanel(DEFAULT_SETTINGS, { available, active: true }).rows) {
        expect(PANEL.x + PANEL_INSET + row.text.length * GLYPH_W).toBeLessThanOrEqual(
          PANEL.x + PANEL.w,
        );
        ys.push(row.y);
      }
      ys.push(panelClose(PANEL).y);
      for (let i = 1; i < ys.length; i += 1) {
        expect((ys[i] ?? 0) - (ys[i - 1] ?? 0)).toBeGreaterThanOrEqual(LINE_H);
      }
      expect((ys.at(-1) ?? 0) + LINE_H / 2).toBeLessThanOrEqual(PANEL.y + PANEL.h);
    }
  });
});
