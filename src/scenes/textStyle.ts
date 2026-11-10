/**
 * The game's one text face: VT323 (SIL OFL), self-hosted from
 * `@fontsource/vt323` and loaded by `BootScene.preload` under `FONT_KEY`
 * before any scene draws text, with the browser's `monospace` behind it.
 * VT323 is monospace at 0.4 em an advance, narrower than `monospace`'s
 * 0.6 em, so every layout width counted in characters still fits.
 */

/** The family name the font is registered under in `document.fonts`. */
export const FONT_KEY = 'VT323';

/** The CSS family list every text style and DOM control uses. */
export const FONT_FAMILY = `${FONT_KEY}, monospace`;

/** The default text colour of labels and panel copy. */
export const TEXT_COLOR = '#d8e6c8';

/** The base text style, at the 8 px label size; spread it and override `fontSize` or `color`. */
export const LABEL_STYLE = { fontFamily: FONT_FAMILY, fontSize: '8px', color: TEXT_COLOR };

/** The base style at the 10 px size of panel copy and the title's text. */
export const BODY_STYLE = { ...LABEL_STYLE, fontSize: '10px' };

/**
 * Whether the pixel font is loaded and registered. `document.fonts.check` is
 * not enough: it also answers true when no face of the family exists at all.
 */
export function fontLoaded(): boolean {
  return [...document.fonts].some((f) => f.family === FONT_KEY && f.status === 'loaded');
}
