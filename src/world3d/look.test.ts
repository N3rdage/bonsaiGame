import { describe, expect, it } from 'vitest';
import { LOOK, OBJECTS, SURFACES, lookLight, outlineWidthMetres, rampGlsl, unitRgb } from './look';

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

describe('SURFACES', () => {
  it('pins the painted surfaces', () => {
    expect(SURFACES.walls).toEqual({
      paper: 0x4f7a64,
      motif: 0x6a9478,
      wainscot: 0xe6d8b8,
      rail: 0x9a6a44,
      skirting: 0x6a4630,
    });
    expect(SURFACES.floor).toEqual({ plank: 0xb4804e, gap: 0x4a2e20, worn: 0xd0a070 });
    expect(SURFACES.tiles).toEqual({ tile: 0xd8cbb0, grout: 0x9a8a74 });
    expect(SURFACES.rug).toEqual([0x2e4a6a, 0xf0dcb0, 0xb8473a, 0xe0a040]);
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

describe('OBJECTS', () => {
  it('pins the furniture palette', () => {
    expect(OBJECTS).toEqual({
      white: 0xffffff,
      flame: 0xff9a3c,
      flameCore: 0xffe9a0,
      soot: 0x2e2622,
      log: 0x8a5a3a,
      bark: 0x6e4a34,
      soil: 0x4a3426,
      brass: 0xc8a050,
      copper: 0xc87850,
      ink: 0x3a2c28,
      bread: 0xd8a060,
      fruit1: 0xe05a3a,
      fruit2: 0xf0c040,
      fruit3: 0xf0d860,
      cat: 0xe0904a,
      catDark: 0xb86a34,
      cream: 0xf6ecd6,
      wood: 0xb07a4a,
      woodDark: 0x7a4a30,
      woodLight: 0xd4a46a,
      sofa: 0xb85a48,
      sofaLight: 0xcc7058,
      cushionA: 0xe8c060,
      cushionB: 0x4a7a8a,
      throw: 0xf0e0c0,
      chair: 0x5a8a6a,
      chairLight: 0x6e9e7a,
      shade: 0xf6e0b0,
      ceramic: 0xf4ecdc,
      ceramicB: 0x4a7a9a,
      glaze: 0x2e6a7a,
      terracotta: 0xc4643e,
      leaf: 0x4a8a3e,
      leafLight: 0x7aae4a,
      leafDark: 0x2e6a3a,
      stone: 0xb4a898,
      frame: 0xc8a050,
      frameDark: 0x4a3020,
      curtain: 0xf0dcb0,
      curtainDark: 0xd8c098,
      sill: 0xf0e6d0,
      sky: 0xd8eef8,
      flower: 0xf06a7a,
      book1: 0xa83a30,
      book2: 0x2e5a7a,
      book3: 0xe0a840,
      book4: 0x4a7a4a,
      book5: 0x7a4a7a,
      wicker: 0xc49a60,
      cabinet: 0xe8dcc0,
      cabinetLight: 0xf2e8d0,
      towel: 0x4a7aa0,
      jar: 0xf2e8d0,
      jarB: 0xc87048,
      door: 0xe0d2b4,
      doorDark: 0xccbc98,
      coat: 0xa84a3a,
    });
  });
});
