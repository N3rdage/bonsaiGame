/**
 * The once-per-session cache of painted textures. A key names a painter and
 * its parameters; the first `get` for a key paints, every later one returns
 * the same raster. `painted` counts the paintings made.
 */

import type { Raster } from './raster';

/** A stable key for a painter and its numeric parameters, whatever order they were written in. */
export function paintKey<T extends Record<keyof T, number>>(name: string, params: T): string {
  const keys = (Object.keys(params) as (keyof T)[]).sort();
  return `${name}?${keys.map((k) => `${String(k)}=${params[k].toString()}`).join('&')}`;
}

export class PaintCache {
  private readonly rasters = new Map<string, Raster>();
  private count = 0;

  /** How many rasters have been painted (not fetched) since the last `clear`. */
  get painted(): number {
    return this.count;
  }

  /** The raster for `key`, painted by `paint` only the first time it is asked for. */
  get(key: string, paint: () => Raster): Raster {
    const kept = this.rasters.get(key);
    if (kept) return kept;
    const made = paint();
    this.rasters.set(key, made);
    this.count++;
    return made;
  }

  /** Forgets every raster and resets the count. */
  clear(): void {
    this.rasters.clear();
    this.count = 0;
  }
}
