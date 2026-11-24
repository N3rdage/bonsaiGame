import { describe, expect, it } from 'vitest';
import { dab, fillRect, hashRaster, mix, raster, rng, shade, stroke } from './raster';

function texel(r: ReturnType<typeof raster>, x: number, y: number): number[] {
  const i = (y * r.width + x) * 4;
  return [...r.data.slice(i, i + 4)];
}

describe('raster', () => {
  it('is opaque and filled', () => {
    const r = raster(2, 2, 0x102030);
    expect(r.data.length).toBe(16);
    expect(texel(r, 1, 1)).toEqual([0x10, 0x20, 0x30, 255]);
  });
});

describe('rng', () => {
  it('repeats for a seed and differs between seeds', () => {
    const a = rng(5);
    const b = rng(5);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect(rng(6)()).not.toBe(first[0]);
    for (const v of first) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('colour helpers', () => {
  it('shade scales and clamps', () => {
    expect(shade(0x804020, 0.5)).toBe(0x402010);
    expect(shade(0x804020, 10)).toBe(0xffffff);
  });

  it('mix moves toward a colour', () => {
    expect(mix(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mix(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mix(0x000000, 0x646464, 0.5)).toBe(0x323232);
  });
});

describe('dab', () => {
  it('blends source-over, full in the middle and half at the edge texel', () => {
    const r = raster(3, 3, 0x000000);
    dab(r, 1.5, 1.5, 1, 0xffffff, 0.5);
    expect(texel(r, 1, 1)).toEqual([128, 128, 128, 255]);
    expect(texel(r, 0, 1)).toEqual([64, 64, 64, 255]);
    expect(texel(r, 1, 0)).toEqual([64, 64, 64, 255]);
    expect(texel(r, 0, 0)[0]).toBeLessThan(20);
  });

  it('lays a second dab over the first', () => {
    const r = raster(1, 1, 0x000000);
    dab(r, 0.5, 0.5, 0.5, 0xffffff, 0.5);
    dab(r, 0.5, 0.5, 0.5, 0xffffff, 0.5);
    expect(texel(r, 0, 0)).toEqual([192, 192, 192, 255]);
  });

  it('wraps round the edges', () => {
    const r = raster(8, 8, 0x000000);
    dab(r, 0.5, 0.5, 1, 0xffffff, 1);
    expect(texel(r, 0, 0)).toEqual([255, 255, 255, 255]);
    expect(texel(r, 7, 0)[0]).toBe(128);
    expect(texel(r, 0, 7)[0]).toBe(128);
    expect(texel(r, 4, 4)[0]).toBe(0);
  });

  it('stays inside a clip, wrapping included', () => {
    const r = raster(8, 8, 0x000000);
    dab(r, 0.5, 0.5, 1, 0xffffff, 1, { x: 0, y: 0, w: 4, h: 8 });
    expect(texel(r, 0, 0)[0]).toBe(255);
    expect(texel(r, 7, 0)[0]).toBe(0);
  });
});

describe('stroke', () => {
  it('paints a body near its alpha, not a string of beads', () => {
    const r = raster(40, 12, 0x000000);
    stroke(
      r,
      { x: 6, y: 6 },
      { x: 20, y: 6 },
      { x: 34, y: 6 },
      { width: 6, colour: 0xffffff, alpha: 0.5 },
    );
    const mid = texel(r, 20, 5)[0] ?? 0;
    expect(mid).toBeGreaterThan(110);
    expect(mid).toBeLessThan(140);
    const along = [14, 15, 16, 17].map((x) => texel(r, x, 5)[0] ?? 0);
    expect(Math.max(...along) - Math.min(...along)).toBeLessThan(12);
    expect(texel(r, 20, 0)[0]).toBe(0);
  });
});

describe('fillRect', () => {
  it('fills and blends, cut to the raster', () => {
    const r = raster(4, 4, 0x000000);
    fillRect(r, { x: 2, y: 2, w: 10, h: 10 }, 0xffffff, 0.5);
    expect(texel(r, 3, 3)).toEqual([128, 128, 128, 255]);
    expect(texel(r, 1, 1)).toEqual([0, 0, 0, 255]);
  });
});

describe('hashRaster', () => {
  it('is stable, eight hex digits and sensitive to a byte', () => {
    const r = raster(4, 4, 0x336699);
    expect(hashRaster(r)).toBe(hashRaster(raster(4, 4, 0x336699)));
    expect(hashRaster(r)).toMatch(/^[0-9a-f]{8}$/);
    const other = raster(4, 4, 0x336699);
    other.data[5] = 0;
    expect(hashRaster(other)).not.toBe(hashRaster(r));
  });

  it('is the FNV-1a of an empty-ish input', () => {
    expect(hashRaster({ width: 0, height: 0, data: new Uint8ClampedArray(0) })).toBe('811c9dc5');
  });
});
