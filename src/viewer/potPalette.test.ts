import { describe, expect, it } from 'vitest';
import { SOIL_RGB, potPalette } from './potPalette';

describe('potPalette (scr_growth pot_palette)', () => {
  it('pins the terracotta standard pot', () => {
    expect(potPalette(0)).toEqual({
      body: { r: 150, g: 90, b: 55 },
      bodyLine: { r: 85, g: 50, b: 30 },
      rim: { r: 170, g: 105, b: 65 },
      rimLine: { r: 85, g: 50, b: 30 },
      disc: { r: 70, g: 55, b: 45 },
    });
  });

  it('pins the glazed celadon fancy pot', () => {
    expect(potPalette(1)).toEqual({
      body: { r: 60, g: 110, b: 105 },
      bodyLine: { r: 35, g: 70, b: 68 },
      rim: { r: 95, g: 150, b: 140 },
      rimLine: { r: 35, g: 70, b: 68 },
      disc: { r: 45, g: 80, b: 75 },
      highlight: { r: 150, g: 200, b: 190 },
    });
  });

  it('pins the soil colour', () => {
    expect(SOIL_RGB).toEqual({ r: 48, g: 34, b: 24 });
  });
});
