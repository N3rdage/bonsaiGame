import { describe, expect, it } from 'vitest';
import { LOOK, lookLight, outlineWidthMetres, rampGlsl, unitRgb } from './look';

describe('LOOK', () => {
  it('pins the painterly numbers', () => {
    expect(LOOK.ramp).toEqual([0.5, 0.74, 1.0]);
    expect(LOOK.soft).toBe(0.45);
    expect(LOOK.ink).toBe(0x2a2030);
    expect(LOOK.outlinePx).toBe(1.4);
    expect(LOOK.sun).toBe(0xffe6b4);
    expect(LOOK.sunPower).toBe(0.7);
    expect(LOOK.skyFill).toBe(0x8aa4d4);
    expect(LOOK.groundFill).toBe(0x7a5a74);
    expect(LOOK.fillPower).toBe(0.5);
    expect(LOOK.shadowFill).toBe(0.75);
    expect(LOOK.exposure).toBe(1.05);
    expect(LOOK.contrast).toBe(1.1);
  });

  it('has a ramp that rises from dark to lit', () => {
    expect([...LOOK.ramp].sort((a, b) => a - b)).toEqual([...LOOK.ramp]);
  });
});

describe('unitRgb', () => {
  it('splits a hex colour into 0..1 channels', () => {
    expect(unitRgb(0xff0000)).toEqual([1, 0, 0]);
    expect(unitRgb(0x336699)).toEqual([0x33 / 255, 0x66 / 255, 0x99 / 255]);
  });
});

describe('lookLight', () => {
  it('is the sun times its power and each fill times the fill power', () => {
    const { sun, sky, ground } = lookLight();
    expect(sun[0]).toBeCloseTo(0.7);
    expect(sun[1]).toBeCloseTo((0xe6 / 255) * 0.7);
    expect(sun[2]).toBeCloseTo((0xb4 / 255) * 0.7);
    expect(sky[0]).toBeCloseTo((0x8a / 255) * 0.5);
    expect(sky[2]).toBeCloseTo((0xd4 / 255) * 0.5);
    expect(ground[0]).toBeCloseTo((0x7a / 255) * 0.5);
    expect(ground[1]).toBeCloseTo((0x5a / 255) * 0.5);
  });
});

describe('rampGlsl', () => {
  const code = rampGlsl();

  it('lists the levels darkest first and ends on the lit one', () => {
    expect(code).toContain('if (i < 0.50000) return 0.50000;');
    expect(code).toContain('if (i < 1.50000) return 0.74000;');
    expect(code.indexOf('return 0.50000;')).toBeLessThan(code.indexOf('return 0.74000;'));
    expect(code.indexOf('return 0.74000;')).toBeLessThan(code.indexOf('return 1.00000; }'));
  });

  it('blends over soft of each slice, a smoothstep about its middle', () => {
    expect(code).toContain('smoothstep(0.27500, 0.72500, x - i)');
    expect(rampGlsl([0.5, 1], 0.1)).toContain('smoothstep(0.45000, 0.55000, x - i)');
  });

  it('maps N.L onto the levels', () => {
    expect(code).toContain('clamp((ndl * 0.5 + 0.5) * 3.00000 - 0.5, 0.0, 2.00000)');
  });

  it('keeps a hard step from collapsing to nothing', () => {
    expect(rampGlsl([0.5, 1], 0)).toContain('smoothstep(0.49000, 0.51000');
  });

  it('is a constant for one level', () => {
    expect(rampGlsl([0.6])).toContain('return 0.60000; }');
  });

  it('rejects an empty ramp', () => {
    expect(() => rampGlsl([])).toThrow();
  });
});

describe('outlineWidthMetres', () => {
  it('spans the outline width in px of a view one px per centimetre tall', () => {
    // At a 90 degree fov a view 2 * radius metres tall: 9 m radius is 18 m, so 1800 px is 100 px per metre.
    expect(outlineWidthMetres(9, Math.PI / 2, 1800, 2)).toBeCloseTo(0.02);
  });

  it("defaults to the look's width and grows with distance and shrinks with the view's height", () => {
    const near = outlineWidthMetres(4, 0.8, 600);
    expect(near).toBeCloseTo((1.4 * 2 * 4 * Math.tan(0.4)) / 600);
    expect(outlineWidthMetres(8, 0.8, 600)).toBeCloseTo(near * 2);
    expect(outlineWidthMetres(4, 0.8, 1200)).toBeCloseTo(near / 2);
  });
});
