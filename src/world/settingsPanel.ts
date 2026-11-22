/**
 * The Settings panel (obj_ui_settings) as a PanelModel in the standard PANEL:
 * `Fullscreen: On|Off`, `Weather effects: On|Off`, `Sound: On|Off`,
 * `Music: On|Off`, `3D world (preview): On|Off` and `Time speed: 1x|2x|4x`, each a toggle, then Close (fitRows grows the box to hold
 * them at phone tap targets). Pure; the title and the world draw it, apply a toggle, save and
 * reopen it. The prototype's Window scale row is not ported.
 */

import type { Settings } from '../platform/settings';
import { PANEL, rows, type PanelModel } from './panels';

export const SETTINGS_KEY = 'settings';

/** The box: PANEL grown by the extra row, still centred on the canvas. */
export const SETTINGS_BOX = { ...PANEL, y: 38, h: 194 } as const;

/** Whether the browser offers fullscreen at all, and whether the page is in it now. */
export interface FullscreenState {
  readonly available: boolean;
  readonly active: boolean;
}

const onOff = (on: boolean): string => (on ? 'On' : 'Off');

/**
 * The panel over `settings`. The Fullscreen row shows the live state, since
 * the browser can leave fullscreen (Escape) without the toggle; without the
 * Fullscreen API it is a grey `not available` line, not a control.
 */
export function settingsPanel(settings: Settings, fullscreen: FullscreenState): PanelModel {
  return {
    key: SETTINGS_KEY,
    title: 'Settings',
    box: SETTINGS_BOX,
    rows: rows(
      [
        fullscreen.available
          ? { text: `Fullscreen: ${onOff(fullscreen.active)}`, id: 'panel-fullscreen' }
          : { text: 'Fullscreen: not available', id: 'panel-fullscreen', enabled: false },
        { text: `Weather effects: ${onOff(settings.weather)}`, id: 'panel-weather' },
        { text: `Sound: ${onOff(settings.sound)}`, id: 'panel-sound' },
        { text: `Music: ${onOff(settings.music)}`, id: 'panel-music' },
        { text: `3D world (preview): ${onOff(settings.world3d)}`, id: 'panel-world3d' },
        { text: `Time speed: ${String(settings.timeSpeed)}x`, id: 'panel-timespeed' },
      ],
      SETTINGS_BOX,
    ),
  };
}
