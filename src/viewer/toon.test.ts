import { describe, expect, it } from 'vitest';
import { unit } from './meshArrays';
import {
  INK_RGB,
  LIGHT_DIRECTION,
  OUTLINE_DEPTH,
  OUTLINE_WIDTH_PX,
  SURROUND_RGB,
  TOON_RAMP,
  bothWindings,
  toonRampBytes,
} from './toon';

describe('the toon ramp', () => {
  it('pins three bands, darkest first, the lit band the palette colour itself', () => {
    expect(TOON_RAMP).toEqual([150, 205, 255, 255]);
    expect(new Set(TOON_RAMP).size).toBe(3);
    expect([...TOON_RAMP].sort((a, b) => a - b)).toEqual(TOON_RAMP);
    expect(TOON_RAMP.at(-1)).toBe(255);
  });

  it('becomes one byte per texel', () => {
    expect(Array.from(toonRampBytes())).toEqual([150, 205, 255, 255]);
    expect(Array.from(toonRampBytes([0, 128]))).toEqual([0, 128]);
  });

  it('refuses levels a byte cannot hold', () => {
    expect(() => toonRampBytes([0, 256])).toThrow();
    expect(() => toonRampBytes([-1])).toThrow();
    expect(() => toonRampBytes([12.5])).toThrow();
  });
});

describe('bothWindings', () => {
  it('lists each triangle forwards then reversed', () => {
    expect(Array.from(bothWindings(6))).toEqual([0, 1, 2, 0, 2, 1, 3, 4, 5, 3, 5, 4]);
  });

  it('is empty for an empty mesh and refuses a partial triangle', () => {
    expect(bothWindings(0)).toHaveLength(0);
    expect(() => bothWindings(4)).toThrow();
  });
});

describe('the Inked viewer constants', () => {
  it('pins ink and surround to art/inked/style.mjs', () => {
    expect(INK_RGB).toEqual({ r: 50, g: 42, b: 38 });
    expect(SURROUND_RGB).toEqual({ r: 62, g: 54, b: 50 });
  });

  it('lights from above, at unit length', () => {
    const { x, y, z } = LIGHT_DIRECTION;
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 12);
    expect(z).toBeGreaterThan(0.7);
  });

  it('pins the outline', () => {
    expect(OUTLINE_WIDTH_PX).toBe(2);
    expect(OUTLINE_DEPTH).toBe(0.1);
  });
});

describe('unit', () => {
  it('scales to unit length and falls back to straight up', () => {
    expect(unit({ x: 3, y: 0, z: 4 })).toEqual({ x: 0.6, y: 0, z: 0.8 });
    expect(unit({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 1 });
  });
});
