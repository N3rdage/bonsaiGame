import { describe, expect, it } from 'vitest';
import {
  DESKTOP_UI,
  MIN_TAP_CSS_POINTER,
  MIN_TAP_CSS_TOUCH,
  MIN_TEXT_CSS,
  PHONE_UI,
  cssPerLogical,
  hitRect,
  rectsOverlap,
  uiMetrics,
} from './uiScale';

describe('UI scale rule', () => {
  it('takes the CSS scale from the fitted 16:9 canvas', () => {
    expect(cssPerLogical(1280, 720)).toBeCloseTo(2.667, 3);
    expect(cssPerLogical(824, 384)).toBeCloseTo(1.422, 3);
    // Letterboxed either way: the shorter fit wins.
    expect(cssPerLogical(960, 1000)).toBe(2);
  });

  it('pins the phone and desktop metrics', () => {
    expect([MIN_TAP_CSS_TOUCH, MIN_TAP_CSS_POINTER, MIN_TEXT_CSS]).toEqual([44, 24, 14]);
    expect(PHONE_UI).toEqual({ hit: 31, label: 10, body: 10 });
    expect(DESKTOP_UI).toEqual({ hit: 9, label: 8, body: 10 });
  });

  it('meets the CSS minimums at any scale', () => {
    for (const scale of [0.5, 1, 1.42, 2, 2.67, 4]) {
      for (const touch of [false, true]) {
        const ui = uiMetrics(scale, touch);
        expect(ui.hit * scale).toBeGreaterThanOrEqual(touch ? 44 : 24);
        expect(ui.label * scale).toBeGreaterThanOrEqual(14);
        expect(ui.label).toBeGreaterThanOrEqual(8);
        expect(ui.body).toBeGreaterThanOrEqual(Math.max(ui.label, 10));
      }
    }
  });
});

describe('hitRect', () => {
  it('grows a small text box to the hit size around its centre', () => {
    expect(hitRect({ x: 100, y: 100, w: 16, h: 10 }, 30)).toEqual({ x: 93, y: 90, w: 30, h: 30 });
  });

  it('keeps a box already larger than the hit size', () => {
    expect(hitRect({ x: 100, y: 100, w: 60, h: 10 }, 9)).toEqual({ x: 100, y: 100, w: 60, h: 10 });
  });

  it('grows inward at the canvas edges', () => {
    expect(hitRect({ x: 6, y: 2, w: 16, h: 10 }, 31)).toEqual({ x: 0, y: 0, w: 31, h: 31 });
    expect(hitRect({ x: 426, y: 254, w: 48, h: 10 }, 31)).toEqual({ x: 426, y: 239, w: 48, h: 31 });
  });
});

describe('rectsOverlap', () => {
  it('counts shared area, not shared edges', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(rectsOverlap(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
    expect(rectsOverlap(a, { x: 9, y: 9, w: 5, h: 5 })).toBe(true);
  });
});
