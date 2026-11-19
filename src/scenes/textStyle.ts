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

/** The Inked page's three values as 0xRRGGBB: PAPER, INK and SURROUND in art/inked/style.mjs. */
export const PAPER = 0xf2eada;
export const INK = 0x322a26;
export const SURROUND = 0x3e3632;

/** `rgb` as a CSS hex string. */
export function cssColour(rgb: number): string {
  return `#${rgb.toString(16).padStart(6, '0')}`;
}

/** `from` mixed `t` of the way towards `to`, each channel rounded. */
export function mixColour(from: number, to: number, t: number): number {
  return [16, 8, 0].reduce((out, shift) => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return out | (Math.round(a + (b - a) * t) << shift);
  }, 0);
}

/**
 * The one look of every panel, HUD row and world label: ink on paper, as the
 * Inked rooms are drawn. A panel is a paper box framed by an ink rule and a
 * fainter second rule `innerRule.inset` px inside it; its title sits in a
 * band of shaded paper over an ink rule. Copy is ink, a button is ink over a
 * faint ink underline, a greyed one is ink faded towards the paper with no
 * underline, and the few marked lines (headings, notes, warnings, done) are
 * dark inks that keep their hue. A text drawn straight over the room sits on a
 * paper plate `plate.padding` px round it, edged by an ink rule. A modal dims
 * the room with ink. The bars keep their fills over an ink-washed track.
 */
export const PANEL_STYLE = {
  paper: PAPER,
  ink: INK,
  /** The outer rule's width, logical px, and the inner rule's inset and strength. */
  rule: 1,
  innerRule: { inset: 3, alpha: 0.35 },
  /** The title band: paper shaded 8% towards ink. */
  band: 0xe3dbcc,
  /** A button's underline, `alpha` ink, `rule` px under its text box's bottom edge. */
  underline: { alpha: 0.55 },
  /** The modal dimmer over the room. */
  dim: { colour: INK, alpha: 0.5 },
  /** A bar's track under its fill, and its ink edge. */
  barTrack: { colour: INK, alpha: 0.15 },
  /** Text colours: copy and buttons, secondary copy, greyed, and the marked lines. */
  text: '#322a26',
  soft: '#6c645c',
  disabled: '#9c9489',
  heading: '#3c5a32',
  note: '#8a5c12',
  warn: '#9a3426',
  good: '#3c6a2c',
  /** The plate under a text drawn over the room. */
  plate: { fill: '#f2eada', padding: PLATE_PADDING },
} as const;

/** A box in logical px. */
export interface FrameRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** What a panel's frame draws over its paper: the title band, then ink rules (`alpha` 1 for full ink). */
export interface PanelFrame {
  readonly band?: FrameRect;
  readonly rules: readonly (FrameRect & { readonly alpha: number })[];
}

/** The four sides of `r`'s border, `t` px wide, inside it. */
function border(r: FrameRect, t: number): FrameRect[] {
  return [
    { x: r.x, y: r.y, w: r.w, h: t },
    { x: r.x, y: r.y + r.h - t, w: r.w, h: t },
    { x: r.x, y: r.y + t, w: t, h: r.h - 2 * t },
    { x: r.x + r.w - t, y: r.y + t, w: t, h: r.h - 2 * t },
  ];
}

/**
 * `box`'s frame (PANEL_STYLE): the title band `titleH` px tall at the top
 * with an ink rule along its foot (none for 0), the outer ink rule inside the
 * box's edge and the fainter inner rule `innerRule.inset` px in.
 */
export function panelFrame(box: FrameRect, titleH = 0): PanelFrame {
  const { rule, innerRule } = PANEL_STYLE;
  const inset = innerRule.inset;
  const inner = { x: box.x + inset, y: box.y + inset, w: box.w - 2 * inset, h: box.h - 2 * inset };
  const rules = [
    ...(titleH > 0 ? [{ x: box.x, y: box.y + titleH - rule, w: box.w, h: rule, alpha: 1 }] : []),
    ...border(box, rule).map((r) => ({ ...r, alpha: 1 })),
    ...border(inner, rule).map((r) => ({ ...r, alpha: innerRule.alpha })),
  ];
  return titleH > 0 ? { band: { x: box.x, y: box.y, w: box.w, h: titleH }, rules } : { rules };
}

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
    color: PANEL_STYLE.text,
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
 * `px` px ink text on the paper plate (PANEL_STYLE.plate), which fills the
 * text's box grown by the plate's padding a side, its right side grown by the
 * ink overhang too; the scene edges it with an ink rule (src/scenes/inkPanel.ts).
 */
function plated(px: number) {
  const { fill, padding } = PANEL_STYLE.plate;
  const { x, y } = padding;
  return {
    ...style(px),
    backgroundColor: fill,
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
