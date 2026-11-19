import { describe, expect, it } from 'vitest';
import { inkedWashes } from '../testing/inkedWashes';
import { SOIL_RGB, potPalette, type Rgb } from './potPalette';

const hex = (c: Rgb): number => (c.r << 16) | (c.g << 8) | c.b;

describe('potPalette (scr_growth pot_palette)', () => {
  it('pins the terracotta standard pot', () => {
    expect(potPalette(0)).toEqual({
      body: { r: 204, g: 112, b: 74 },
      bodyLine: { r: 128, g: 68, b: 46 },
      rim: { r: 220, g: 136, b: 96 },
      rimLine: { r: 128, g: 68, b: 46 },
      disc: { r: 128, g: 68, b: 46 },
    });
  });

  it('pins the glazed celadon fancy pot', () => {
    expect(potPalette(1)).toEqual({
      body: { r: 132, g: 176, b: 156 },
      bodyLine: { r: 74, g: 114, b: 104 },
      rim: { r: 162, g: 200, b: 180 },
      rimLine: { r: 74, g: 114, b: 104 },
      disc: { r: 74, g: 114, b: 104 },
      highlight: { r: 222, g: 238, b: 226 },
    });
  });

  it('pins the soil colour', () => {
    expect(SOIL_RGB).toEqual({ r: 120, g: 96, b: 78 });
  });

  it("mirrors art/inked/style.mjs's WASHES entry each colour names", () => {
    const washes = inkedWashes();
    const standard = potPalette(0);
    const fancy = potPalette(1);
    const mirrors: [Rgb | undefined, string][] = [
      [standard.body, 'terracotta'],
      [standard.bodyLine, 'terracottaShade'],
      [standard.rim, 'terracottaRim'],
      [fancy.body, 'celadon'],
      [fancy.bodyLine, 'celadonShade'],
      [fancy.rim, 'celadonRim'],
      [fancy.highlight, 'celadonSheen'],
      [SOIL_RGB, 'soil'],
    ];
    for (const [colour, wash] of mirrors) {
      expect(washes[wash], wash).toBeDefined();
      expect(colour && hex(colour), wash).toBe(washes[wash]);
    }
    // The outlines and the disc are the body's shade.
    for (const palette of [standard, fancy]) {
      expect(palette.rimLine).toEqual(palette.bodyLine);
      expect(palette.disc).toEqual(palette.bodyLine);
    }
  });
});
