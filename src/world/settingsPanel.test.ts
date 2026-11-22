import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../platform/settings';
import { PANEL_INSET, panelClose, panelTitleY } from './panels';
import { SETTINGS_BOX, settingsPanel } from './settingsPanel';

// At 10 px, the layouts' bound of 0.6 em a character (Caveat's lines average 0.35 to 0.37 em and its digits 0.45, the sans-serif fallback's lowercase 0.49) and the 1.2 em line (Phaser draws Caveat 12 px tall): 6 px a glyph and a 12 px line. Generous upper bounds.
const GLYPH_W = 6;
const LINE_H = 12;

const live = { available: true, active: false };

describe('settings panel', () => {
  it('is titled Settings with Fullscreen, Weather effects, Sound and Music toggles', () => {
    const model = settingsPanel(DEFAULT_SETTINGS, live);
    expect([model.key, model.title, model.box]).toEqual(['settings', 'Settings', SETTINGS_BOX]);
    expect(model.rows.map((r) => [r.id, r.text, r.enabled ?? true])).toEqual([
      ['panel-fullscreen', 'Fullscreen: Off', true],
      ['panel-weather', 'Weather effects: On', true],
      ['panel-sound', 'Sound: On', true],
      ['panel-music', 'Music: On', true],
      ['panel-world3d', '3D world (preview): Off', true],
      ['panel-timespeed', 'Time speed: 1x', true],
    ]);
  });

  it('shows the live fullscreen state and the stored weather, sound and music flags', () => {
    const model = settingsPanel(
      {
        fullscreen: false,
        weather: false,
        sound: false,
        music: false,
        world3d: true,
        timeSpeed: 2,
      },
      { available: true, active: true },
    );
    expect(model.rows.map((r) => r.text)).toEqual([
      'Fullscreen: On',
      'Weather effects: Off',
      'Sound: Off',
      'Music: Off',
      '3D world (preview): On',
      'Time speed: 2x',
    ]);
  });

  it('shows Sound and Music each from its own flag', () => {
    const texts = (sound: boolean, music: boolean): string[] =>
      settingsPanel({ ...DEFAULT_SETTINGS, sound, music }, live)
        .rows.filter((r) => r.id === 'panel-sound' || r.id === 'panel-music')
        .map((r) => r.text);
    expect(texts(false, true)).toEqual(['Sound: Off', 'Music: On']);
    expect(texts(true, false)).toEqual(['Sound: On', 'Music: Off']);
  });

  it('greys Fullscreen out where the browser has no Fullscreen API', () => {
    const row = settingsPanel(
      { ...DEFAULT_SETTINGS, fullscreen: true },
      { available: false, active: false },
    ).rows[0];
    expect([row?.text, row?.enabled]).toEqual(['Fullscreen: not available', false]);
  });

  it('keeps every row inside the box, apart and above Close', () => {
    for (const available of [true, false]) {
      const ys = [panelTitleY(SETTINGS_BOX)];
      for (const row of settingsPanel(DEFAULT_SETTINGS, { available, active: true }).rows) {
        expect(SETTINGS_BOX.x + PANEL_INSET + row.text.length * GLYPH_W).toBeLessThanOrEqual(
          SETTINGS_BOX.x + SETTINGS_BOX.w,
        );
        ys.push(row.y);
      }
      ys.push(panelClose(SETTINGS_BOX).y);
      for (let i = 1; i < ys.length; i += 1) {
        expect((ys[i] ?? 0) - (ys[i - 1] ?? 0)).toBeGreaterThanOrEqual(LINE_H);
      }
      expect((ys.at(-1) ?? 0) + LINE_H / 2).toBeLessThanOrEqual(SETTINGS_BOX.y + SETTINGS_BOX.h);
    }
  });
});
