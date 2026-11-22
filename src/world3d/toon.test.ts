import { describe, expect, it } from 'vitest';
import { INK_RGB, OUTLINE_WIDTH_PX, TOON_RAMP } from '../viewer/toon';
import { inkUnit, outlineWidthMetres, toonLevelGlsl, toonLevels } from './toon';

describe('toonLevels', () => {
  it("is the viewer's ramp scaled to 0..1, darkest first", () => {
    const levels = toonLevels();
    expect(levels).toHaveLength(TOON_RAMP.length);
    expect(levels[0]).toBeCloseTo(150 / 255);
    expect(levels[1]).toBeCloseTo(205 / 255);
    expect(levels[2]).toBe(1);
    expect(levels[0]).toBeLessThan(levels[1] ?? 0);
  });

  it('rejects a level outside 0..255 as the viewer does', () => {
    expect(() => toonLevels([256])).toThrow();
  });
});

describe('toonLevelGlsl', () => {
  it('steps at -0.5, 0 and 0.5 for the four-level ramp, one return per band', () => {
    const code = toonLevelGlsl();
    expect(code).toContain('if (ndl < -0.500000) return 0.588235;');
    expect(code).toContain('if (ndl < 0.000000) return 0.803922;');
    expect(code).toContain('if (ndl < 0.500000) return 1.000000;');
    expect(code.endsWith('return 1.000000; }')).toBe(true);
    expect(code.match(/return/g)).toHaveLength(TOON_RAMP.length);
  });

  it('is a single constant for a one-level ramp', () => {
    expect(toonLevelGlsl([128])).toBe('float toonLevel(float ndl) {  return 0.501961; }');
  });
});

describe('inkUnit', () => {
  it("is the viewer's ink as 0..1", () => {
    expect(inkUnit()).toEqual({ r: INK_RGB.r / 255, g: INK_RGB.g / 255, b: INK_RGB.b / 255 });
  });
});

describe('outlineWidthMetres', () => {
  it('spans the outline width in px of a view one px per centimetre tall', () => {
    // At a 90 degree fov a view 2 * radius metres tall: 9 m radius is 18 m, so 1800 px is 100 px per metre.
    expect(outlineWidthMetres(9, Math.PI / 2, 1800, 2)).toBeCloseTo(0.02);
  });

  it("defaults to the viewer's width and grows with distance and shrinks with the view's height", () => {
    const near = outlineWidthMetres(4, 0.8, 600);
    expect(near).toBeCloseTo((OUTLINE_WIDTH_PX * 2 * 4 * Math.tan(0.4)) / 600);
    expect(outlineWidthMetres(8, 0.8, 600)).toBeCloseTo(near * 2);
    expect(outlineWidthMetres(4, 0.8, 1200)).toBeCloseTo(near / 2);
  });
});
