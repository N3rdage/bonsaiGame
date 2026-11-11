/**
 * The game's one text face: VT323 (SIL OFL), self-hosted from
 * `@fontsource/vt323` and loaded by `BootScene.preload` under `FONT_KEY`
 * before any scene draws text, with the browser's `monospace` behind it.
 * VT323 is monospace at 0.4 em an advance, narrower than `monospace`'s
 * 0.6 em, so every layout width counted in characters still fits. The sizes
 * come from the screen's UI metrics (src/world/uiScale.ts).
 */

import type { UiMetrics } from '../world/uiScale';

/** The family name the font is registered under in `document.fonts`. */
export const FONT_KEY = 'VT323';

/** The CSS family list every text style and DOM control uses. */
export const FONT_FAMILY = `${FONT_KEY}, monospace`;

/** The default text colour of labels and panel copy. */
export const TEXT_COLOR = '#d8e6c8';

/** A text style of `px` logical px in the default colour; spread it and override `color`. */
function style(px: number) {
  return { fontFamily: FONT_FAMILY, fontSize: `${String(px)}px`, color: TEXT_COLOR };
}

/** The label style (8 px at the desktop scale) for `ui`. */
export function labelStyle(ui: UiMetrics) {
  return style(ui.label);
}

/** The panel copy and button style (10 px at the desktop scale) for `ui`. */
export function bodyStyle(ui: UiMetrics) {
  return style(ui.body);
}

/**
 * Whether the pixel font is loaded and registered. `document.fonts.check` is
 * not enough: it also answers true when no face of the family exists at all.
 */
export function fontLoaded(): boolean {
  return [...document.fonts].some((f) => f.family === FONT_KEY && f.status === 'loaded');
}
