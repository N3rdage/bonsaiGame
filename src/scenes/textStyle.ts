/**
 * The game's one text face: Caveat (SIL OFL 1.1), a hand-lettered script to
 * sit with the Inked art, self-hosted from `@fontsource/caveat` and loaded by
 * `BootScene.preload` under `FONT_KEY` before any scene draws text.
 *
 * Caveat is proportional (its metrics are pinned in textStyle.test.ts): 0.36
 * em an advance across the lowercase letters, 0.45 for every digit and `$`,
 * 0.72 at the widest (`M`, `W`), and Phaser's line box (the ink of `|MÉqs`)
 * is 0.87 em up and 0.23 down, 12 px at 10 px. Layout widths counted in characters keep their bound of 0.6 em a
 * character, which the game's strings stay well inside. `sans-serif` stands
 * behind it: proportional like Caveat, about 0.49 em across the lowercase in
 * Chromium's Linux default, so the rare string drawn in it still fits that
 * bound; the generic `cursive` is a wider, odd face on Linux.
 *
 * Caveat's glyphs reach past their advance (its slant), up to `INK_OVERHANG_EM`
 * on the right, and Phaser sizes a Text by the advances, so every style pads
 * the right by that much and the last glyph is drawn whole. The sizes come
 * from the screen's UI metrics (src/world/uiScale.ts).
 */

import { PLATE_PADDING, type UiMetrics } from '../world/uiScale';

/** The family name the font is registered under in `document.fonts`. */
export const FONT_KEY = 'Caveat';

/** The CSS family list every text style and DOM control uses. */
export const FONT_FAMILY = `${FONT_KEY}, sans-serif`;

/** The default text colour of labels and panel copy. */
export const TEXT_COLOR = '#d8e6c8';

/** The farthest any glyph's ink reaches right of its advance, in em (`[` at 0.301). */
export const INK_OVERHANG_EM = 0.31;

/** The right padding, in logical px, that holds the overhang of `px` px text. */
export function inkPadding(px: number): number {
  return Math.ceil(px * INK_OVERHANG_EM);
}

/** A text style of `px` logical px in the default colour; spread it and override `color`. */
function style(px: number) {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${String(px)}px`,
    color: TEXT_COLOR,
    padding: { left: 0, right: inkPadding(px), top: 0, bottom: 0 },
  };
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
 * The plate behind every text drawn straight over the room's art, light or
 * dark: the Inked ink (`INK`, rgb(50, 42, 38), in art/inked/style.mjs) at
 * 0.6 alpha, filling the text's box grown by `padding` logical px a side.
 * A fill, not a stroke, so it reads the same whatever the glyphs.
 */
export const TEXT_BACKING = {
  backgroundColor: 'rgba(50, 42, 38, 0.6)',
  padding: PLATE_PADDING,
} as const;

/** `px` px text in the default colour on the plate, its right side grown by the ink overhang too. */
function plated(px: number) {
  const { x, y } = TEXT_BACKING.padding;
  return {
    ...style(px),
    backgroundColor: TEXT_BACKING.backgroundColor,
    padding: { left: x, right: x + inkPadding(px), top: y, bottom: y },
  };
}

/** The HUD rows' style (the badge, the carry line, the toast and the HUD's own buttons): the body style on the plate. */
export function hudStyle(ui: UiMetrics) {
  return plated(ui.body);
}

/** The world's own labels' style (the prompt, the tree and display spot labels): the label style on the plate. */
export function worldLabelStyle(ui: UiMetrics) {
  return plated(ui.label);
}

/**
 * Whether the UI font is loaded and registered. `document.fonts.check` is
 * not enough: it also answers true when no face of the family exists at all.
 */
export function fontLoaded(): boolean {
  return [...document.fonts].some((f) => f.family === FONT_KEY && f.status === 'loaded');
}
