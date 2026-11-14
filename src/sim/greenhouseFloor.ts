/**
 * The greenhouse's floor and the footprints of the furniture that stands on
 * it, as plain numbers, so the save's version 6 migration (save.ts) and the
 * world (src/world/greenhouseRoom.ts, placement.ts) read one source.
 *
 * The floor is 5 x 3.5 m at 50 cm a tile (16 logical px), a 10 x 7 tile grid,
 * 160 x 112 px, centred on the 480 px canvas's x 240 inside the glass ring.
 * The version 6 migration keeps every placed greenhouse item wholly inside it.
 */

import type { PlaceableKind } from './types';

/** The greenhouse floor inside its glass, logical px: x 160..320, y 80..192. */
export const GREENHOUSE_FLOOR = { x: 160, y: 80, w: 160, h: 112 } as const;

/** Each placeable kind's footprint, logical px: a pedestal one 16 px tile, a floor shelf two side by side. */
export const PLACEABLE_SIZES: Readonly<
  Record<PlaceableKind, { readonly w: number; readonly h: number }>
> = {
  pedestal: { w: 16, h: 16 },
  floor_shelf: { w: 32, h: 16 },
};

/** Whether `kind` with its top-left at (x, y) lies wholly on the greenhouse floor. */
export function onGreenhouseFloor(kind: PlaceableKind, x: number, y: number): boolean {
  const { w, h } = PLACEABLE_SIZES[kind];
  const f = GREENHOUSE_FLOOR;
  return x >= f.x && y >= f.y && x + w <= f.x + f.w && y + h <= f.y + f.h;
}
