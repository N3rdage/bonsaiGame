/**
 * The sprite sheets the world draws, as pure data shared by the boot scene
 * (which loads them), the world scene and the tests. Each pixel sheet is one
 * prototype sprite, packed by `npm run art:sheets` (art/sheets.mjs) from
 * archive/gamemaker/sprites/<key>/ into public/assets/<key>.png as a
 * horizontal strip in the order of the sprite's `.yy` frames: spr_door. Every
 * other sheet is Inked. `npm run art:paper` (art/inked/paperSheet.mjs)
 * draws the Inked rooms' paper, `spr_paper`, `npm run art:player`
 * (art/inked/player.mjs) the Inked player, `spr_player`, in the prototype's
 * frame order, `npm run art:shed` (art/inked/shed.mjs) every sheet the shed
 * draws: its floor, wall face and caps, window, doors, furniture, decor and
 * rug, and `npm run art:garden` (art/inked/garden.mjs) the back garden's:
 * its lawn, fences, corners, side gate and source plants (the lawn, fences
 * and gate shared with the front garden) and the buildings seen from it,
 * their faces, roofs, caps, kitchen window and glazed door (the house's
 * face, roof and window shared with the front garden too), and `npm run
 * art:front-garden` (art/inked/frontGarden.mjs) the front garden's own: its
 * road, low fence, drive, path, beds, front door and roller door, and `npm
 * run art:lounge`, `art:hallway` and `art:study` (art/inked/lounge.mjs,
 * hallway.mjs and study.mjs) every sheet each house room draws: its floor
 * (and the kitchen's), wall face and caps, window and furniture, and `npm
 * run art:doors` (art/inked/doors.mjs) the house's own doors: the study's
 * glazed double door and the side-on doors between rooms, and `npm run
 * art:greenhouse` (art/inked/greenhouse.mjs) the greenhouse's paving and its
 * back wall's face (its caps are the garden's frame rails), and `npm run
 * art:placeables` (art/inked/placeables.mjs) the furniture the player
 * places: the pedestal and the floor shelf.
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
  // The gardens' lawn, fences and side gate, drawn by art/inked/garden.mjs: 3 variants of each
  // 16 px tile (the fence's face front-on, a north-south fence in three-quarter view), the ring's
  // corners NW, NE, SW, SE, and the gate's leaf, as tall as the 0.75 m fence.
  floorGarden: inked('spr_floor_garden', 3, 16),
  fence: inked('spr_fence', 3, 16),
  fenceV: inked('spr_fence_v', 3, 16),
  fenceCorner: inked('spr_fence_corner', 4, 16),
  gate: inked('spr_gate', 1, 16),
  // The source plants, one frame per species (juniper, maple, pine), each standing on its frame's foot.
  sourcePlant: inked('spr_source_plant', 3, 24, 32),
  // The buildings seen from the back garden, drawn by art/inked/garden.mjs: each face 2.4 m (16 x
  // 48) over its roof's 16 px tiles, 3 variants each; the house's edge-on east wall as its 8 px
  // cap, the kitchen window, the greenhouse's frame rails on its edges, and one glazed leaf
  // front-on, the garden's doors to the study and the greenhouse and the greenhouse's back to the
  // garden. The house's face, roof and window are the front garden's too, for the garage's face
  // and roof as well.
  shedFace: inked('spr_shed_face', 3, 16, 48),
  shedRoof: inked('spr_shed_roof', 3, 16),
  houseFace: inked('spr_house_face', 3, 16, 48),
  houseRoof: inked('spr_house_roof', 3, 16),
  houseCapV: inked('spr_house_cap_v', 3, 8, 16),
  houseWindow: inked('spr_house_window', 1, 40, 24),
  greenhouseRoof: inked('spr_greenhouse_roof', 3, 16),
  greenhouseFace: inked('spr_greenhouse_face', 3, 16, 48),
  greenhouseCap: inked('spr_greenhouse_cap', 3, 16, 8),
  greenhouseCapV: inked('spr_greenhouse_cap_v', 3, 8, 16),
  doorGlazed: inked('spr_door_glazed', 1, 24, 40),
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
  // The lounge-kitchen, drawn by art/inked/lounge.mjs: 3 variants each of its carpet and the
  // kitchen's quarry tiles (16 px), its back wall's 2.4 m face (16 x 48) and its 8 px caps (16 x 8,
  // 8 x 16), and, cut out, its window on the face between curtains, the fireplace (1.0 x 0.75 x
  // 0.9 m), the low side table (0.4 m) and the kitchen counter's two runs (0.9 m).
  floorLounge: inked('spr_floor_lounge', 3, 16),
  floorKitchen: inked('spr_floor_kitchen', 3, 16),
  wallLounge: inked('spr_wall_lounge', 3, 16, 48),
  loungeCap: inked('spr_lounge_cap', 3, 16, 8),
  loungeCapV: inked('spr_lounge_cap_v', 3, 8, 16),
  loungeWindow: inked('spr_lounge_window', 1, 32, 24),
  fireplace: inked('spr_fireplace', 1, 32, 44),
  sideTable: inked('spr_side_table', 1, 16, 24),
  counter: inked('spr_counter', 1, 96, 40),
  counterV: inked('spr_counter_v', 1, 20, 60),
  // The hallway, drawn by art/inked/hallway.mjs: its floorboards, face and caps, 3 variants each,
  // and, cut out, the runner flat on the floor and the 0.75 m console table.
  floorHallway: inked('spr_floor_hallway', 3, 16),
  wallHallway: inked('spr_wall_hallway', 3, 16, 48),
  hallwayCap: inked('spr_hallway_cap', 3, 16, 8),
  hallwayCapV: inked('spr_hallway_cap_v', 3, 8, 16),
  runner: inked('spr_runner', 1, 60, 24),
  hallTable: inked('spr_hall_table', 1, 16, 28),
  // The study, drawn by art/inked/study.mjs: its parquet, face and caps, 3 variants each, and, cut
  // out, its window on the face under a blind, the 0.75 m desk and the 0.6 m low bookcase.
  floorStudy: inked('spr_floor_study', 3, 16),
  wallStudy: inked('spr_wall_study', 3, 16, 48),
  studyCap: inked('spr_study_cap', 3, 16, 8),
  studyCapV: inked('spr_study_cap_v', 3, 8, 16),
  studyWindow: inked('spr_study_window', 1, 32, 24),
  desk: inked('spr_desk', 1, 32, 32),
  bookshelf: inked('spr_bookshelf', 1, 48, 28),
  // The house's doors, drawn by art/inked/doors.mjs, cut out: the study's glazed double door
  // front-on (two leaves, 1.5 x 2.0 m), and the doors between rooms seen side-on, each an 8 x 40
  // frame on its wall's cap with the leaf ajar into the room, in a left (W) wall and, mirrored, a
  // right (E) one.
  doorGlass: inked('spr_door_glass', 1, 48, 40),
  doorSideW: inked('spr_door_side_w', 1, 8, 40),
  doorSideE: inked('spr_door_side_e', 1, 8, 40),
  // The greenhouse, drawn by art/inked/greenhouse.mjs: 3 variants each of its stone paving (16 px)
  // and its back wall's 2.4 m face from inside (16 x 48), glass over a brick dwarf wall with the
  // garden green through the lower panes; its caps are the garden's greenhouseCap and greenhouseCapV.
  floorGreenhouse: inked('spr_floor_greenhouse', 3, 16),
  greenhouseWall: inked('spr_greenhouse_wall', 3, 16, 48),
  // The shed's decor (obj_game_controller Draw_0), drawn by art/inked/shed.mjs at the scale rule's heights.
  shelf: inked('spr_shelf', 1, 24, 20),
  tools: inked('spr_tools', 1, 12, 32),
  wateringCan: inked('spr_watering_can', 1, 16, 12),
  potStack: inked('spr_pot_stack', 1, 12, 20),
  sack: inked('spr_sack', 1, 16, 20),
  // The front garden's own sheets, drawn by art/inked/frontGarden.mjs: 3 variants each of a 32 x 96
  // slice of the 3 m road (its centre-line dash and kerb), the low front fence (16 px, cut out),
  // the drive's block paving, the path's flags and a bed (16 px), and, cut out, the front door
  // front-on (0.8 x 2.0 m, 24 x 40) and the garage's 2.4 m roller door (77 x 40).
  road: inked('spr_road', 3, 32, 96),
  fenceLow: inked('spr_fence_low', 3, 16),
  drive: inked('spr_drive', 3, 16),
  path: inked('spr_path', 3, 16),
  bed: inked('spr_bed', 3, 16),
  frontDoor: inked('spr_front_door', 1, 24, 40),
  rollerDoor: inked('spr_roller_door', 1, 77, 40),
  // The placed furniture, drawn by art/inked/placeables.mjs at the scale rule's heights, cut out:
  // the 0.6 m pedestal on its 16 x 16 footprint and the 0.4 m floor shelf on its 32 x 16 one.
  pedestal: inked('spr_pedestal', 1, 16, 28),
  floorShelf: inked('spr_floor_shelf', 1, 32, 24),
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
