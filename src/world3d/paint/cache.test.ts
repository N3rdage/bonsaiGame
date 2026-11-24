import { describe, expect, it, vi } from 'vitest';
import { PaintCache, paintKey } from './cache';
import { raster } from './raster';

describe('paintKey', () => {
  it('names the painter and every parameter, in a fixed order', () => {
    expect(paintKey('wood', { size: 64, seed: 3 })).toBe('wood?seed=3&size=64');
    expect(paintKey('wood', { seed: 3, size: 64 })).toBe(paintKey('wood', { size: 64, seed: 3 }));
    expect(paintKey('wood', { size: 64, seed: 4 })).not.toBe(
      paintKey('wood', { size: 64, seed: 3 }),
    );
    expect(paintKey('tiles', { size: 64, seed: 3 })).not.toBe(
      paintKey('wood', { size: 64, seed: 3 }),
    );
  });
});

describe('PaintCache', () => {
  it('paints on the first ask only and returns the same raster after', () => {
    const cache = new PaintCache();
    const paint = vi.fn(() => raster(2, 2, 0xffffff));
    const first = cache.get('a', paint);
    const second = cache.get('a', paint);
    expect(second).toBe(first);
    expect(paint).toHaveBeenCalledTimes(1);
    expect(cache.painted).toBe(1);
  });

  it('paints distinct keys separately', () => {
    const cache = new PaintCache();
    const a = cache.get('a', () => raster(2, 2, 0xff0000));
    const b = cache.get('b', () => raster(2, 2, 0x00ff00));
    expect(b).not.toBe(a);
    expect(cache.painted).toBe(2);
  });

  it('forgets everything on clear', () => {
    const cache = new PaintCache();
    cache.get('a', () => raster(1, 1, 0));
    cache.clear();
    expect(cache.painted).toBe(0);
    const paint = vi.fn(() => raster(1, 1, 0));
    cache.get('a', paint);
    expect(paint).toHaveBeenCalledTimes(1);
  });
});
