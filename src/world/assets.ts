/**
 * The sprite sheets the world draws, as pure data shared by the boot scene
 * (which loads them), the world scene and the tests. Each pixel sheet is one
 * prototype sprite, packed by `npm run art:sheets` (art/sheets.mjs) from
 * archive/gamemaker/sprites/<key>/ into public/assets/<key>.png as a
 * horizontal strip in the order of the sprite's `.yy` frames. The house
 * rooms' tiles (lounge, hallway, study, greenhouse), their window and their furniture have
 * no prototype sprite; `npm run art:interiors` (art/interiors.mjs) draws them,
 * the buildings' roofs seen from the garden and the front garden's sheets.
 * `npm run art:paper` (art/inked/paperSheet.mjs) draws the Inked rooms'
 * paper, `spr_paper`, `npm run art:player` (art/inked/player.mjs) the Inked
 * player, `spr_player`, in the prototype's frame order, and `npm run
 * art:shed` (art/inked/shed.mjs) every sheet the shed draws: its floor, wall
 * face and caps, window, doors, furniture, decor and rug.
 */

import type { SpeciesKey } from '../sim/types';
import type { Facing } from './player';
import { PROTOTYPE_SCALE } from './prototype';

/**
 * How a sheet is authored and filtered: `pixel` is the prototype's crisp art at
 * PROTOTYPE_SCALE sheet px per logical px, drawn nearest-neighbour (the game
 * config's `pixelArt`); `inked` is Inked art (art/inked/README.md) at
 * INKED_PER_LOGICAL sheet px per logical px, drawn with linear filtering.
 */
export type SheetArt = 'pixel' | 'inked';

export interface Sheet {
  /** Texture key and file name (without `.png`), the prototype sprite's name. */
  readonly key: string;
  /** Frame size in sheet px. */
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frames: number;
  readonly art: SheetArt;
}

/** Sheet px per logical px of an Inked sheet: art/inked/style.mjs's PER_LOGICAL, the same 4. */
export const INKED_PER_LOGICAL = 4;

/** A prototype pixel sheet; its frame size in sheet (prototype) px. */
const sheet = (key: string, frames = 1, size = 32, height = size): Sheet => ({
  key,
  frameWidth: size,
  frameHeight: height,
  frames,
  art: 'pixel',
});

/** An Inked sheet; its frame size in logical px, authored at INKED_PER_LOGICAL. */
const inked = (
  key: string,
  frames: number,
  sizeLogical: number,
  heightLogical = sizeLogical,
): Sheet => ({
  key,
  frameWidth: sizeLogical * INKED_PER_LOGICAL,
  frameHeight: heightLogical * INKED_PER_LOGICAL,
  frames,
  art: 'inked',
});

/** Sheet px per logical px: PROTOTYPE_SCALE for a pixel sheet, INKED_PER_LOGICAL for an Inked one. */
export function sheetPxPerLogical(s: Sheet): number {
  return s.art === 'inked' ? INKED_PER_LOGICAL : PROTOTYPE_SCALE;
}

/** The texture filter the sheet is drawn with: pixel art stays crisp, Inked art scales smoothly. */
export function sheetFilter(s: Sheet): 'nearest' | 'linear' {
  return s.art === 'inked' ? 'linear' : 'nearest';
}

export const SHEETS = {
  // The player, drawn by art/inked/player.mjs: 16 frames of 16 x 32 logical px, a 1.7 m gardener.
  player: inked('spr_player', 16, 16, 32),
  // The shed's floorboards, drawn by art/inked/shed.mjs: 3 variants of a 16 px tile.
  floorShed: inked('spr_floor_shed', 3, 16),
  floorGarden: sheet('spr_floor_garden', 3),
  sourcePlant: sheet('spr_source_plant', 3, 48),
  wall: sheet('spr_wall'),
  fence: sheet('spr_fence'),
  fenceV: sheet('spr_fence_v'),
  door: sheet('spr_door'),
  // The shed's walls, drawn by art/inked/shed.mjs: the back wall's 2.4 m face (3 variants of a
  // 16 x 48 tile) and the 8 px caps of the south wall (16 x 8) and the side walls (8 x 16), 3 each.
  shedWall: inked('spr_shed_wall', 3, 16, 48),
  shedCap: inked('spr_shed_cap', 3, 16, 8),
  shedCapV: inked('spr_shed_cap_v', 3, 8, 16),
  // The shed's window on the face, its lounge door front-on in the face and its garden door in the south cap.
  shedWindow: inked('spr_shed_window', 1, 32, 24),
  shedDoor: inked('spr_shed_door', 1, 24, 40),
  shedDoorS: inked('spr_shed_door_s', 1, 24, 16),
  // The shed's furniture at the scale rule's heights and its rug, drawn by art/inked/shed.mjs.
  workbench: inked('spr_workbench', 1, 48, 40),
  plantingTable: inked('spr_planting_table', 1, 32, 40),
  shopKiosk: inked('spr_shop_kiosk', 1, 24, 56),
  shedRug: inked('spr_shed_rug', 1, 120, 70),
  // The house rooms' placeholder tiles, drawn by art/interiors.mjs (the prototype had no interiors).
  floorLounge: sheet('spr_floor_lounge', 3),
  wallLounge: sheet('spr_wall_lounge'),
  floorHallway: sheet('spr_floor_hallway', 3),
  wallHallway: sheet('spr_wall_hallway'),
  floorStudy: sheet('spr_floor_study', 3),
  wallStudy: sheet('spr_wall_study'),
  // The greenhouse's paving and its glass walls, drawn by art/interiors.mjs.
  floorGreenhouse: sheet('spr_floor_greenhouse', 3),
  wallGlass: sheet('spr_wall_glass'),
  window: sheet('spr_window'),
  // The study's glazed double door (two leaves) and the garden's single glazed leaf back to it.
  doorGlass: sheet('spr_door_glass', 1, 64, 32),
  doorGlassSingle: sheet('spr_door_glass_single'),
  // The house's doors between rooms seen from the side, in a left (W) wall and, mirrored, a right (E) one.
  doorSideW: sheet('spr_door_side_w'),
  doorSideE: sheet('spr_door_side_e'),
  // The house furniture, one frame at its exact size in prototype px (the bookshelf one bay of its run).
  fireplace: sheet('spr_fireplace', 1, 64, 48),
  sideTable: sheet('spr_side_table'),
  desk: sheet('spr_desk', 1, 64, 32),
  bookshelf: sheet('spr_bookshelf'),
  runner: sheet('spr_runner', 1, 416, 48),
  hallTable: sheet('spr_hall_table', 1, 32, 24),
  // The shed's decor (obj_game_controller Draw_0), drawn by art/inked/shed.mjs at the scale rule's heights.
  shelf: inked('spr_shelf', 1, 24, 20),
  tools: inked('spr_tools', 1, 12, 32),
  wateringCan: inked('spr_watering_can', 1, 16, 12),
  potStack: inked('spr_pot_stack', 1, 12, 20),
  sack: inked('spr_sack', 1, 16, 20),
  // The house's and the shed's roofs seen from the garden, drawn by art/interiors.mjs.
  roof: sheet('spr_roof'),
  // The front garden's road (3 m deep, its kerb at the foot), low front fence, drive, beds,
  // the garage's roller door (2.4 m) and the side gate, drawn by art/interiors.mjs.
  road: sheet('spr_road', 1, 64, 192),
  fenceLow: sheet('spr_fence_low'),
  drive: sheet('spr_drive'),
  bed: sheet('spr_bed'),
  rollerDoor: sheet('spr_roller_door', 1, 154, 32),
  gate: sheet('spr_gate'),
  // The placed furniture: the prototype's pedestal, packed, and the floor shelf, drawn by art/interiors.mjs.
  pedestal: sheet('spr_pedestal'),
  floorShelf: sheet('spr_floor_shelf', 1, 64, 32),
  // The Inked rooms' paper, drawn by art/inked/paperSheet.mjs: one 64 px grain period, so it tiles seamlessly.
  paper: inked('spr_paper', 1, 64),
} as const satisfies Record<string, Sheet>;

/** Every sheet, in load order. */
export const ALL_SHEETS: readonly Sheet[] = Object.values(SHEETS);

/** The sheet's URL under the app's base path (`import.meta.env.BASE_URL`, which ends in `/`). */
export function sheetUrl(base: string, s: Sheet): string {
  return `${base}assets/${s.key}.png`;
}

/** Logical px per prototype px: a sprite drawn at 1x in the prototype is drawn at this scale. */
export const SPRITE_SCALE = 1 / PROTOTYPE_SCALE;
/** The player sheet's draw scale: one logical px per INKED_PER_LOGICAL sheet px, 0.25, so a frame is 16 x 32 logical px. */
export const PLAYER_SCALE = 1 / sheetPxPerLogical(SHEETS.player);
/**
 * Logical px from the player's position (PlayerState's x, y) down to its feet,
 * the frame's bottom edge: the prototype's sprite, 24 px drawn, centred on the
 * position, halved, 12. The frame's extra height rises above the position.
 */
export const PLAYER_FEET = 12;

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
