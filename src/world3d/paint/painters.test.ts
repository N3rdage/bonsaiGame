import { describe, expect, it } from 'vitest';
import { SURFACES } from '../look';
import {
  PAINT,
  TILES_DEFAULTS,
  WALL_DEFAULTS,
  WOOD_DEFAULTS,
  paintTiles,
  paintWallpaper,
  paintWood,
  texelsPerMetre,
} from './painters';
import { hashRaster, type Raster } from './raster';

/** The mean colour of the texels in rows `y0` to `y1` (exclusive) and columns `x0` to `x1`. */
function mean(r: Raster, y0: number, y1: number, x0 = 0, x1 = r.width): [number, number, number] {
  const sum = [0, 0, 0];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      for (let c = 0; c < 3; c++) sum[c] = (sum[c] ?? 0) + (r.data[(y * r.width + x) * 4 + c] ?? 0);
    }
  }
  const n = (y1 - y0) * (x1 - x0);
  return [(sum[0] ?? 0) / n, (sum[1] ?? 0) / n, (sum[2] ?? 0) / n];
}

function near(got: readonly number[], hex: number, tolerance: number): void {
  const want = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  for (let c = 0; c < 3; c++) {
    expect(Math.abs((got[c] ?? 0) - (want[c] ?? 0))).toBeLessThan(tolerance);
  }
}

function brightness(c: readonly number[]): number {
  return (c[0] ?? 0) + (c[1] ?? 0) + (c[2] ?? 0);
}

function opaque(r: Raster): boolean {
  for (let i = 3; i < r.data.length; i += 4) if (r.data[i] !== 255) return false;
  return true;
}

describe('PAINT', () => {
  it('pins the sizes and the brush', () => {
    expect(PAINT.size).toEqual({ wall: 512, floor: 512, tiles: 256 });
    expect(PAINT.metres).toEqual({
      wall: { u: 2, v: 2.4 },
      floor: { u: 4, v: 4 },
      tiles: { u: 2, v: 2 },
    });
    expect(PAINT.strokeWidthCm).toEqual([3, 7]);
    expect(PAINT.strokeLengthCm).toEqual([10, 26]);
    expect(PAINT.coverage).toBe(2.4);
  });

  it('has power-of-two textures', () => {
    for (const size of Object.values(PAINT.size)) expect(Math.log2(size) % 1).toBe(0);
  });

  it('keeps a stroke at least 2 texels wide on every surface', () => {
    for (const p of [WALL_DEFAULTS, WOOD_DEFAULTS, TILES_DEFAULTS]) {
      const scale = texelsPerMetre(p);
      expect((PAINT.strokeWidthCm[0] / 100) * Math.min(scale.u, scale.v)).toBeGreaterThanOrEqual(2);
    }
  });

  it('takes its default colours from the look', () => {
    expect(WALL_DEFAULTS.paper).toBe(SURFACES.walls.paper);
    expect(WOOD_DEFAULTS.plank).toBe(SURFACES.floor.plank);
    expect(TILES_DEFAULTS.grout).toBe(SURFACES.tiles.grout);
  });
});

describe('paintWallpaper', () => {
  it('is deterministic, seeded, opaque and pinned', () => {
    const small = { size: 32 };
    const a = paintWallpaper(small);
    expect(hashRaster(paintWallpaper(small))).toBe(hashRaster(a));
    expect(hashRaster(paintWallpaper({ ...small, seed: 1 }))).not.toBe(hashRaster(a));
    expect(opaque(a)).toBe(true);
    expect(hashRaster(a)).toBe('593bc138');
  });

  it('shows its bands in the right rows', () => {
    const r = paintWallpaper({ size: 256 });
    // 2.4 m over 256 rows: the skirting is the last 14, the rail rows 153-157, the wainscot 158-241.
    near(mean(r, 8, 148), SURFACES.walls.paper, 28);
    near(mean(r, 165, 235), SURFACES.walls.wainscot, 28);
    near(mean(r, 154, 158), SURFACES.walls.rail, 28);
    near(mean(r, 245, 256), SURFACES.walls.skirting, 28);
  });

  it('tiles seamlessly across its left and right edges', () => {
    const r = paintWallpaper({ size: 128 });
    const column = (x: number): number => brightness(mean(r, 0, 70, x, x + 1));
    expect(Math.abs(column(0) - column(127))).toBeLessThan(60);
  });
});

describe('paintWood', () => {
  it('is deterministic, seeded, opaque and pinned', () => {
    const small = { size: 64 };
    const a = paintWood(small);
    expect(hashRaster(paintWood(small))).toBe(hashRaster(a));
    expect(hashRaster(paintWood({ ...small, seed: 8 }))).not.toBe(hashRaster(a));
    expect(opaque(a)).toBe(true);
    expect(hashRaster(a)).toBe('75cc8e3e');
  });

  it('wobbles a grain line by 4 texels at the default size, so the default texture is pinned', () => {
    expect((PAINT.wood.grainWobbleCm / 100) * texelsPerMetre(WOOD_DEFAULTS).v).toBe(4);
    expect(hashRaster(paintWood())).toBe('c02e16f8');
  });

  it('has dark gap rows between its planks', () => {
    const r = paintWood({ size: 256 });
    const rowHeight = 256 / PAINT.wood.rows;
    for (let row = 0; row < PAINT.wood.rows; row++) {
      const top = Math.round(row * rowHeight);
      const gap = mean(r, top, top + 1);
      near(gap, SURFACES.floor.gap, 12);
      expect(brightness(gap)).toBeLessThan(brightness(mean(r, top + 3, top + 7)));
    }
  });

  it('staggers its rows round the repeat, so no column is a joint in every row', () => {
    const r = paintWood({ size: 256 });
    const rowHeight = 256 / PAINT.wood.rows;
    const plank = brightness(mean(r, 0, 256));
    let worst = 0;
    for (let x = 0; x < r.width; x++) {
      let dark = 0;
      for (let row = 0; row < PAINT.wood.rows; row++) {
        const mid = Math.round(row * rowHeight + rowHeight / 2);
        if (brightness(mean(r, mid, mid + 1, x, x + 1)) < plank * 0.7) dark++;
      }
      worst = Math.max(worst, dark);
    }
    expect(worst).toBeLessThan(PAINT.wood.rows / 2);
  });

  it('is plank coloured between the gaps', () => {
    const r = paintWood({ size: 256 });
    near(mean(r, 0, 256), SURFACES.floor.plank, 50);
  });
});

describe('paintTiles', () => {
  it('is deterministic, seeded, opaque and pinned', () => {
    const small = { size: 32 };
    const a = paintTiles(small);
    expect(hashRaster(paintTiles(small))).toBe(hashRaster(a));
    expect(hashRaster(paintTiles({ ...small, seed: 100 }))).not.toBe(hashRaster(a));
    expect(opaque(a)).toBe(true);
    expect(hashRaster(a)).toBe('e8e20fb2');
  });

  it('alternates light and dark tiles with grout between', () => {
    const r = paintTiles({ size: 128 });
    const cell = 128 / PAINT.tiles.across;
    const tile = (i: number, j: number): [number, number, number] =>
      mean(r, j * cell + 3, (j + 1) * cell - 3, i * cell + 3, (i + 1) * cell - 3);
    expect(brightness(tile(0, 0))).toBeGreaterThan(brightness(tile(1, 0)) + 100);
    expect(brightness(tile(1, 1))).toBeGreaterThan(brightness(tile(1, 0)) + 100);
    near(tile(0, 0), SURFACES.tiles.tile, 28);
    near(mean(r, 0, 1), SURFACES.tiles.grout, 12);
    near(mean(r, 0, 128, 0, 1), SURFACES.tiles.grout, 12);
  });
});
