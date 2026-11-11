/**
 * The UI scale rule, as pure math (backlog #87). Layout stays in logical px
 * on the 480x270 canvas; what a logical px is worth on screen depends on how
 * large the fitted canvas is, so the smallest tap target and the text sizes
 * are derived from it: a tap target at least 44 CSS px on a touch screen
 * (Android's 48 dp, Apple's 44 pt) and 24 CSS px with a mouse (WCAG 2.5.8),
 * text at least 14 CSS px where the 8 and 10 px logical sizes fall short.
 */

import { GAME_HEIGHT, GAME_WIDTH } from './resolution';

/** The smallest tap target on a touch screen, in CSS px. */
export const MIN_TAP_CSS_TOUCH = 44;
/** The smallest click target with a mouse, in CSS px (WCAG 2.5.8). */
export const MIN_TAP_CSS_POINTER = 24;
/** The smallest text size, in CSS px. */
export const MIN_TEXT_CSS = 14;

/** The label and panel copy sizes at the largest scales, in logical px. */
const LABEL_PX = 8;
const BODY_PX = 10;

/** The UI's sizes in logical px for one screen. */
export interface UiMetrics {
  /** The smallest tap target's side. */
  readonly hit: number;
  /** The label text size. */
  readonly label: number;
  /** The panel copy and button text size. */
  readonly body: number;
}

/** A rectangle in logical px, top-left and size. */
export interface UiRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** CSS px per logical px of the 16:9 canvas fitted into `cssWidth` x `cssHeight`. */
export function cssPerLogical(cssWidth: number, cssHeight: number): number {
  return Math.min(cssWidth / GAME_WIDTH, cssHeight / GAME_HEIGHT);
}

/** Whole logical px covering `css` CSS px at `scale`; the epsilon absorbs float noise (24 / (1280 / 480) is 9). */
function logical(css: number, scale: number): number {
  return Math.ceil(css / scale - 1e-9);
}

/** The metrics at `scale` CSS px per logical px, for a touch screen or a mouse. */
export function uiMetrics(scale: number, touch: boolean): UiMetrics {
  const minText = logical(MIN_TEXT_CSS, scale);
  return {
    hit: logical(touch ? MIN_TAP_CSS_TOUCH : MIN_TAP_CSS_POINTER, scale),
    label: Math.max(LABEL_PX, minText),
    body: Math.max(BODY_PX, minText),
  };
}

/** A desktop browser at 1280x720 with a mouse: the sizes the layout was drawn at. */
export const DESKTOP_UI = uiMetrics(cssPerLogical(1280, 720), false);
/** The Galaxy S22 Ultra in landscape (824x384 CSS px), a touch screen. */
export const PHONE_UI = uiMetrics(cssPerLogical(824, 384), true);

/**
 * The tappable area of a control whose text covers `bounds`: grown to at
 * least `hit` x `hit` around its centre, then shifted to stay inside the
 * canvas, so a button on an edge grows inward.
 */
export function hitRect(
  bounds: UiRect,
  hit: number,
  canvas: { readonly w: number; readonly h: number } = { w: GAME_WIDTH, h: GAME_HEIGHT },
): UiRect {
  const axis = (start: number, size: number, limit: number): [number, number] => {
    const grown = Math.max(size, hit);
    const from = start + size / 2 - grown / 2;
    return [Math.min(Math.max(from, 0), Math.max(limit - grown, 0)), grown];
  };
  const [x, w] = axis(bounds.x, bounds.w, canvas.w);
  const [y, h] = axis(bounds.y, bounds.h, canvas.h);
  return { x, y, w, h };
}

/**
 * A button's text box estimated without drawing it, for the pure layouts and
 * their tests: 4 px a glyph (VT323's advance at 10 px) and `ui.body` tall,
 * anchored at (`x`, `y`) by its origin as Phaser places a Text.
 */
export function estimatedBox(
  text: string,
  x: number,
  y: number,
  originX: number,
  originY: number,
  ui: UiMetrics,
): UiRect {
  const w = text.length * 4;
  return { x: x - originX * w, y: y - originY * ui.body, w, h: ui.body };
}

/** Whether two rects share any area (touching edges do not). */
export function rectsOverlap(a: UiRect, b: UiRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
