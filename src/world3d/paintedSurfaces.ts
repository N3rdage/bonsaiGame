/**
 * Which of the look's painted surfaces (src/world3d/paint/) an indoor room's
 * floor and walls wear in place of the Inked sheets, and how they are laid:
 * UVs in metres, so one texture repeat spans `PAINT.metres` whatever the room's
 * size. Pure data; the renderer turns each painted raster into a texture once.
 */

import { SHEETS, type Sheet } from '../world/assets';
import { ROOM_STYLES, floorTiles } from '../world/roomArt';
import type { Room } from '../world/shedRoom';
import type { FloorQuad } from './floorTiles';
import { paintKey } from './paint/cache';
import {
  PAINT,
  TILES_DEFAULTS,
  WALL_DEFAULTS,
  WOOD_DEFAULTS,
  paintTiles,
  paintWallpaper,
  paintWood,
} from './paint/painters';
import type { Raster } from './paint/raster';
import { metres } from './plan';
import { wallSheets } from './wallTiles';

/** The painted surfaces. */
export type Surface = 'wallpaper' | 'wood' | 'tiles';

/** A surface's cache key, the metres one repeat spans and its painter. */
interface SurfaceSpec {
  readonly key: string;
  readonly metres: { readonly u: number; readonly v: number };
  readonly paint: () => Raster;
}

export const SURFACE_SPECS: Record<Surface, SurfaceSpec> = {
  wallpaper: {
    key: paintKey('wallpaper', WALL_DEFAULTS),
    metres: PAINT.metres.wall,
    paint: () => paintWallpaper(),
  },
  wood: {
    key: paintKey('wood', WOOD_DEFAULTS),
    metres: PAINT.metres.floor,
    paint: () => paintWood(),
  },
  tiles: {
    key: paintKey('tiles', TILES_DEFAULTS),
    metres: PAINT.metres.tiles,
    paint: () => paintTiles(),
  },
};

/**
 * Painted rasters are uploaded with `invertY`, so the texture's v runs up the
 * image as it does for the Inked sheets: v 0 is the raster's last row, which
 * the wallpaper painter makes the floor line.
 */
export const RASTER_V_UP = true;

/**
 * What each indoor floor sheet is replaced by: the shed's, the hallway's and
 * the study's parquet read as boards, the lounge's warm speckle is nearer
 * wood than tile, the greenhouse's grey flags are tiles.
 */
const FLOORS: Record<string, Surface> = {
  [SHEETS.floorShed.key]: 'wood',
  [SHEETS.floorLounge.key]: 'wood',
  [SHEETS.floorHallway.key]: 'wood',
  [SHEETS.floorStudy.key]: 'wood',
  [SHEETS.floorGreenhouse.key]: 'tiles',
};

/** The back-wall face sheets that are wallpaper; the greenhouse's glass stays Inked. */
const PAPERS = new Set<string>([
  SHEETS.shedWall.key,
  SHEETS.wallLounge.key,
  SHEETS.wallHallway.key,
  SHEETS.wallStudy.key,
]);

/** The surface `room`'s floor wears, undefined for a floor that keeps its Inked tiles. */
export function paintedFloor(room: Room): Surface | undefined {
  return FLOORS[ROOM_STYLES[room.key].floor.key];
}

/** Whether `room`'s walls wear wallpaper on the faces that look into it. */
export function paintedWalls(room: Room): boolean {
  const face = ROOM_STYLES[room.key].face;
  return face !== undefined && PAPERS.has(face.sheet.key);
}

/** The Inked sheets `room`'s walls still wear: all of `wallSheets`, but the face sheet wallpaper replaces. */
export function inkedWallSheets(room: Room): Sheet[] {
  const face = ROOM_STYLES[room.key].face?.sheet.key;
  return wallSheets(room).filter((sheet) => !paintedWalls(room) || sheet.key !== face);
}

/**
 * One quad covering `room`'s floor area with the surface's UVs in metres: u
 * east, v north (up the raster), so a metre of floor has the same texel in
 * every room.
 */
export function paintedFloorQuad(surface: Surface, room: Room): FloorQuad {
  const { u, v } = SURFACE_SPECS[surface].metres;
  const { area } = floorTiles(room);
  const [x0, x1] = [metres(area.x), metres(area.x + area.w)];
  const [y0, y1] = [metres(area.y), metres(area.y + area.h)];
  return { x0, y0, x1, y1, frame: 0, u0: x0 / u, u1: x1 / u, v0: -y1 / v, v1: -y0 / v };
}
