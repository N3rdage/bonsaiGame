/**
 * The Settings panel (obj_ui_settings) as a PanelModel in the standard PANEL:
 * `Fullscreen: On|Off` and `Weather effects: On|Off`, each a toggle, then
 * Close. Pure; the title and the world draw it, apply a toggle, save and
 * reopen it. The prototype's Window scale row is not ported.
 */

import type { Settings } from '../platform/settings';
import { rows, type PanelModel } from './panels';

export const SETTINGS_KEY = 'settings';

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
    rows: rows([
      fullscreen.available
        ? { text: `Fullscreen: ${onOff(fullscreen.active)}`, id: 'panel-fullscreen' }
        : { text: 'Fullscreen: not available', id: 'panel-fullscreen', enabled: false },
      { text: `Weather effects: ${onOff(settings.weather)}`, id: 'panel-weather' },
    ]),
  };
}
