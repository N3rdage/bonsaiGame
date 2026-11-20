import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inkedWashes } from '../testing/inkedWashes';
import { PAPER_RGB, WASH_ALPHA, WASH_RGB, cornerNormals, onPaper, spriteSize } from './ink';

const hex = ({ r, g, b }: { r: number; g: number; b: number }): number => (r << 16) | (g << 8) | b;

describe('the spike ink', () => {
  it("mirrors art/inked/style.mjs's WASHES, PAPER and WASH_ALPHA", () => {
    const washes = inkedWashes();
    for (const [name, rgb] of Object.entries(WASH_RGB)) expect(hex(rgb), name).toBe(washes[name]);
    const style = readFileSync(new URL('../../art/inked/style.mjs', import.meta.url), 'utf8');
    expect(style).toContain(
      `export const PAPER = [${String(PAPER_RGB.r)}, ${String(PAPER_RGB.g)}, ${String(PAPER_RGB.b)}];`,
    );
    expect(style).toContain(`export const WASH_ALPHA = ${String(WASH_ALPHA)};`);
  });

  it("lays a wash on paper as style.mjs's palette strip does", () => {
    // The lawn: 242 * 0.18 + 150 * 0.82 = 166.56, and so on.
    expect(onPaper(WASH_RGB.outside)).toEqual({ r: 167, g: 193, b: 136 });
    expect(onPaper(PAPER_RGB)).toEqual(PAPER_RGB);
  });

  it("pushes every hull vertex along its box corner's diagonal", () => {
    const n = cornerNormals([0.5, -2, 3, -1, 0, 1]);
    const k = 1 / Math.sqrt(3);
    expect(Array.from(n)).toEqual([k, -k, k, -k, 0, k].map((v) => Math.fround(v)));
  });

  it('sizes the player sprite as an upright 2 m frame seen at the pitch', () => {
    expect(spriteSize(0)).toEqual({ w: 1, h: 2 });
    const { w, h } = spriteSize(60);
    expect(h).toBeCloseTo(1, 9);
    expect(w).toBeCloseTo(0.5, 9);
  });
});
