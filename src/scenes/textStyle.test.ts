import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DESKTOP_UI,
  ESTIMATED_ADVANCE_EM,
  PHONE_UI,
  TEXT_ASCENT_EM,
  TEXT_DESCENT_EM,
  textHeight,
} from '../world/uiScale';
import { caveatMetrics, textWidthEm } from './caveatMetrics';
import {
  FONT_FAMILY,
  FONT_KEY,
  INK,
  INK_OVERHANG_EM,
  PANEL_STYLE,
  PAPER,
  SURROUND,
  bodyStyle,
  cssColour,
  hudStyle,
  inkPadding,
  labelStyle,
  mixColour,
  panelFrame,
  worldLabelStyle,
} from './textStyle';

/**
 * art/inked/style.mjs's `export const NAME = [r, g, b];` as 0xRRGGBB, read
 * from its source as src/world/palette.test.ts reads its WASHES (the
 * generator's module is untyped JavaScript the tests cannot import).
 */
function inkedColour(name: string): number {
  const source = readFileSync(new URL('../../art/inked/style.mjs', import.meta.url), 'utf8');
  const m = new RegExp(`^export const ${name} = \\[(\\d+), (\\d+), (\\d+)\\];`, 'm').exec(source);
  return m ? (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]) : NaN;
}

/** A file of the project as text. */
const projectFile = (path: string): string =>
  readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('the panel style', () => {
  it("is drawn in art/inked/style.mjs's paper, ink and surround", () => {
    expect([PAPER, INK, SURROUND]).toEqual([0xf2eada, 0x322a26, 0x3e3632]);
    expect(PAPER).toBe(inkedColour('PAPER'));
    expect(INK).toBe(inkedColour('INK'));
    expect(SURROUND).toBe(inkedColour('SURROUND'));
    expect([PANEL_STYLE.paper, PANEL_STYLE.ink, PANEL_STYLE.dim.colour]).toEqual([PAPER, INK, INK]);
    expect(PANEL_STYLE.text).toBe(cssColour(INK));
  });

  it('shades the band and fades the softer and greyed inks towards the paper', () => {
    expect(cssColour(0x0a0b0c)).toBe('#0a0b0c');
    expect(PANEL_STYLE.band).toBe(mixColour(PAPER, INK, 0.08));
    expect(PANEL_STYLE.soft).toBe(cssColour(mixColour(INK, PAPER, 0.3)));
    expect(PANEL_STYLE.disabled).toBe(cssColour(mixColour(INK, PAPER, 0.55)));
    expect([PANEL_STYLE.rule, PANEL_STYLE.innerRule]).toEqual([1, { inset: 3, alpha: 0.35 }]);
  });

  it('puts the page behind the canvas in the surround', () => {
    const surround = cssColour(SURROUND);
    const html = projectFile('index.html');
    expect(html).toContain(`<meta name="theme-color" content="${surround}" />`);
    expect(html).toMatch(new RegExp(`body \\{[^}]*background: ${surround};`));
    const vite = projectFile('vite.config.ts');
    expect(vite).toContain(`theme_color: '${surround}'`);
    expect(vite).toContain(`background_color: '${surround}'`);
  });

  it('frames a panel with an ink rule, a fainter one 3 px in, and the title band over its own rule', () => {
    const box = { x: 40, y: 60, w: 400, h: 150 };
    expect(panelFrame(box).band).toBeUndefined();
    const framed = panelFrame(box, 24);
    expect(framed.band).toEqual({ x: 40, y: 60, w: 400, h: 24 });
    expect(framed.rules).toEqual([
      { x: 40, y: 83, w: 400, h: 1, alpha: 1 },
      { x: 40, y: 60, w: 400, h: 1, alpha: 1 },
      { x: 40, y: 209, w: 400, h: 1, alpha: 1 },
      { x: 40, y: 61, w: 1, h: 148, alpha: 1 },
      { x: 439, y: 61, w: 1, h: 148, alpha: 1 },
      { x: 43, y: 63, w: 394, h: 1, alpha: 0.35 },
      { x: 43, y: 206, w: 394, h: 1, alpha: 0.35 },
      { x: 43, y: 64, w: 1, h: 142, alpha: 0.35 },
      { x: 436, y: 64, w: 1, h: 142, alpha: 0.35 },
    ]);
  });
});

/**
 * The bound every layout counts a character at, in em: 6 px at 10 px. The
 * `sans-serif` fallback in Chromium on Linux (Liberation Sans, Arial's
 * metrics), measured in the browser: 0.49 em across the lowercase letters,
 * 0.556 a digit, 0.68 across the capitals.
 */
const LAYOUT_ADVANCE_EM = 0.6;
const SANS_LOWERCASE_EM = 0.49;
const SANS_DIGIT_EM = 0.556;
/** The panel tests' line bound: 12 px at 10 px. */
const LAYOUT_LINE_EM = 1.2;

const round = (n: number): number => Math.round(n * 1000) / 1000;
const mean = (ns: readonly number[]): number => ns.reduce((a, b) => a + b, 0) / ns.length;

describe('the UI font', () => {
  const face = caveatMetrics();
  const advance = (c: string): number => face.glyphs.get(c)?.advance ?? NaN;
  const chars = (s: string): string[] => Array.from(s);
  const printable = [...face.glyphs.keys()];
  const lowercase = chars('abcdefghijklmnopqrstuvwxyz');
  const capitals = chars('ABCDEFGHIJKLMNOPQRSTUVWXYZ');

  it('is Caveat with sans-serif behind it', () => {
    expect(FONT_KEY).toBe('Caveat');
    expect(FONT_FAMILY).toBe('Caveat, sans-serif');
  });

  it('sizes labels and copy from the UI metrics: 8 and 10 px on desktop, 10 and 10 on the phone', () => {
    const style = (px: number) => ({
      fontFamily: FONT_FAMILY,
      fontSize: `${String(px)}px`,
      color: '#322a26',
      padding: { left: 0, right: inkPadding(px), top: 0, bottom: 0 },
    });
    expect(labelStyle(DESKTOP_UI)).toEqual(style(8));
    expect(bodyStyle(DESKTOP_UI)).toEqual(style(10));
    expect(labelStyle(PHONE_UI)).toEqual(style(10));
    expect(bodyStyle(PHONE_UI)).toEqual(style(10));
    expect(labelStyle({ hit: 44, label: 14, body: 14 }).fontSize).toBe('14px');
  });

  it('backs the HUD rows and the world labels with a paper plate, 2 px across and 1 px down', () => {
    expect(PANEL_STYLE.plate).toEqual({ fill: '#f2eada', padding: { x: 2, y: 1 } });
    expect(PANEL_STYLE.plate.fill).toBe(cssColour(PAPER));
    for (const ui of [DESKTOP_UI, PHONE_UI]) {
      const plate = (px: number) => ({
        backgroundColor: PANEL_STYLE.plate.fill,
        padding: { left: 2, right: 2 + inkPadding(px), top: 1, bottom: 1 },
      });
      expect(hudStyle(ui)).toEqual({ ...bodyStyle(ui), ...plate(ui.body) });
      expect(worldLabelStyle(ui)).toEqual({ ...labelStyle(ui), ...plate(ui.label) });
      // Panel copy, buttons and the title sit on their own panels: no plate.
      expect(labelStyle(ui)).not.toHaveProperty('backgroundColor');
      expect(bodyStyle(ui)).not.toHaveProperty('backgroundColor');
    }
  });

  it('pads the right by the farthest ink past an advance, so a last glyph is drawn whole', () => {
    const overhangs = printable.map((c) => {
      const g = face.glyphs.get(c);
      return g && g.xMax > 0 ? g.xMax - g.advance : 0;
    });
    expect(round(Math.max(...overhangs))).toBe(0.301);
    expect(Math.max(...overhangs)).toBeLessThanOrEqual(INK_OVERHANG_EM);
    // `d`, which ends `seed` and `Standard`, reaches 0.135 em past its advance.
    expect(round((face.glyphs.get('d')?.xMax ?? 0) - advance('d'))).toBe(0.135);
    expect([8, 10, 14].map(inkPadding)).toEqual([3, 4, 5]);
  });

  it('is proportional: 0.36 em across the lowercase, 0.45 a digit, 0.72 at the widest', () => {
    expect(round(mean(lowercase.map(advance)))).toBe(0.36);
    expect(new Set(chars('0123456789$').map(advance))).toEqual(new Set([0.45]));
    expect(round(mean(capitals.map(advance)))).toBe(0.509);
    expect(round(mean(printable.map(advance)))).toBe(0.411);
    expect(Math.max(...printable.map(advance))).toBe(0.72);
    expect(printable.filter((c) => advance(c) > LAYOUT_ADVANCE_EM).sort()).toEqual(['@', 'M', 'W']);
  });

  it('draws the HUD badge and a long stat line well inside the layouts’ 0.6 em a character', () => {
    for (const [text, em] of [
      ['Spring 1/28 | Day 0 | $100', 0.37],
      ['Trunk: 25.0 cm tall, 18.0 mm thick', 0.347],
      ['Carrying: Japanese Maple #12', 0.37],
    ] as const) {
      expect(round(textWidthEm(text) / text.length)).toBe(em);
    }
    // The sans-serif fallback fits the bound too, but for runs of capitals.
    expect(SANS_LOWERCASE_EM).toBeLessThan(LAYOUT_ADVANCE_EM);
    expect(SANS_DIGIT_EM).toBeLessThan(LAYOUT_ADVANCE_EM);
  });

  it('estimates a HUD button at its widest label, Menu, 0.47 em a character', () => {
    expect(ESTIMATED_ADVANCE_EM).toBe(0.47);
    for (const label of ['Menu', 'View tree (V)', 'Notebook (J)', 'Interact (E)']) {
      expect(textWidthEm(label) / label.length).toBeLessThanOrEqual(ESTIMATED_ADVANCE_EM);
    }
  });

  it('stands 12 px tall at 10 px in Phaser (the ink of |MÉqs) inside a 1.26 em line box', () => {
    expect(face.lineEm).toBe(1.26);
    // Phaser's MeasureText sizes a Text by `measureText('|MÉqs')`'s ink, which
    // Chromium gives as 0.87 em up (É's accent, outside the ASCII the table
    // reads; `|` is the tallest of the rest) and 0.23 down (q's tail).
    const ink = chars('|Mqs').map((c) => face.glyphs.get(c));
    expect(round(Math.max(...ink.map((g) => g?.yMax ?? 0)))).toBe(0.764);
    expect(round(-Math.min(...ink.map((g) => g?.yMin ?? 0)))).toBe(0.228);
    expect([TEXT_ASCENT_EM, TEXT_DESCENT_EM]).toEqual([0.87, 0.23]);
    // Whole px a side: 9 and 12 px tall at 8 and 10 px, inside the layouts' 1.2 em line.
    expect([8, 10, 14].map(textHeight)).toEqual([9, 12, 17]);
    for (const px of [8, 10]) expect(textHeight(px)).toBeLessThanOrEqual(LAYOUT_LINE_EM * px);
  });

  it('has a 0.4 em x-height and 0.61 em capitals', () => {
    expect(face.xHeightEm).toBe(0.4);
    expect(face.capHeightEm).toBe(0.61);
  });
});
