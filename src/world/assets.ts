/**
 * The sprite sheets the world draws, as pure data shared by the boot scene
 * (which loads them), the world scene and the tests. Each sheet is one
 * prototype sprite, packed by `npm run art:sheets` (art/sheets.mjs) from
 * archive/gamemaker/sprites/<key>/ into public/assets/<key>.png as a
 * horizontal strip in the order of the sprite's `.yy` frames. The house
 * rooms' tiles (lounge, hallway, study) have no prototype sprite; `npm run art:interiors` (art/interiors.mjs)
 * draws them.
 */

import type { SpeciesKey } from '../sim/types';
import type { Facing } from './player';
import { PROTOTYPE_SCALE } from './shedRoom';

export interface Sheet {
  /** Texture key and file name (without `.png`), the prototype sprite's name. */
  readonly key: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frames: number;
}

const sheet = (key: string, frames = 1, size = 32): Sheet => ({
  key,
  frameWidth: size,
  frameHeight: size,
  frames,
});

export const SHEETS = {
  player: sheet('spr_player', 16),
  floorShed: sheet('spr_floor_shed', 3),
  floorGarden: sheet('spr_floor_garden', 3),
  sourcePlant: sheet('spr_source_plant', 3, 48),
  wall: sheet('spr_wall'),
  fence: sheet('spr_fence'),
  fenceV: sheet('spr_fence_v'),
  door: sheet('spr_door'),
  workbench: sheet('spr_workbench'),
  plantingTable: sheet('spr_planting_table'),
  shopKiosk: sheet('spr_shop_kiosk'),
  pedestal: sheet('spr_pedestal'),
  // The house rooms' placeholder tiles, drawn by art/interiors.mjs (the prototype had no interiors).
  floorLounge: sheet('spr_floor_lounge', 3),
  wallLounge: sheet('spr_wall_lounge'),
  floorHallway: sheet('spr_floor_hallway', 3),
  wallHallway: sheet('spr_wall_hallway'),
  floorStudy: sheet('spr_floor_study', 3),
  wallStudy: sheet('spr_wall_study'),
} as const satisfies Record<string, Sheet>;

/** Every sheet, in load order. */
export const ALL_SHEETS: readonly Sheet[] = Object.values(SHEETS);

/** The sheet's URL under the app's base path (`import.meta.env.BASE_URL`, which ends in `/`). */
export function sheetUrl(base: string, s: Sheet): string {
  return `${base}assets/${s.key}.png`;
}

/** Logical px per prototype px: a sprite drawn at 1x in the prototype is drawn at this scale. */
export const SPRITE_SCALE = 1 / PROTOTYPE_SCALE;
/** obj_player_2d and obj_pedestal draw their sprites at 1.5x. */
export const PLAYER_SCALE = 1.5 * SPRITE_SCALE;
export const PEDESTAL_SCALE = 1.5 * SPRITE_SCALE;

/** obj_player_2d Draw_0: the sheet's rows of four, down, up, left, right. */
const FACING_ROW: Record<Facing, number> = { down: 0, up: 1, left: 2, right: 3 };

/** obj_player_2d Draw_0: `row * 4 + floor(walk_anim)`; walk index 0 is the standing pose. */
export function playerFrame(facing: Facing, walkAnim: number): number {
  return FACING_ROW[facing] * 4 + Math.floor(walkAnim);
}

/** obj_source_plant Draw_0: frame 0 juniper, 1 maple, 2 pine. */
const SOURCE_PLANT_FRAME: Record<SpeciesKey, number> = { juniper: 0, maple: 1, pine: 2 };

export function sourcePlantFrame(species: SpeciesKey): number {
  return SOURCE_PLANT_FRAME[species];
}

/**
 * The controller's floor draw: a stable frame per tile, a hash of the tile's
 * column and row, so the variation scatters without animating.
 */
export function floorFrame(column: number, row: number, frames: number): number {
  return (column * 7 + row * 13) % frames;
}
