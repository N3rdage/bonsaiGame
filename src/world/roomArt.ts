/**
 * How a room is drawn, as pure data in logical px: the floor tiles
 * (obj_game_controller Draw_0), the wall and fence runs (Other_4's ring,
 * obj_wall Draw_0), the garden's mitred fence corners (Draw_73), the shed's
 * floor dim and rug, each prop's sprite and the drop shadows (the props' Draw
 * events). The prototype's numbers are in prototype px and halved here.
 */

import { SHEETS, PEDESTAL_SCALE, SPRITE_SCALE, floorFrame, sourcePlantFrame } from './assets';
import type { Sheet } from './assets';
import { DOORWAY } from './gardenRoom';
import { fromPrototype, type Prop, type Rect, type Room } from './shedRoom';

/** One prototype tile, 32 px, in logical px. */
export const TILE = fromPrototype(32);

/** The floor sheet and its frame per tile, rows top to bottom, tiles from the room's top-left. */
export interface FloorTiles {
  readonly sheet: Sheet;
  readonly frames: readonly (readonly number[])[];
}

export function floorTiles(room: Room): FloorTiles {
  const sheet = room.key === 'shed' ? SHEETS.floorShed : SHEETS.floorGarden;
  const columns = Math.ceil(room.width / TILE);
  const rows = Math.ceil(room.height / TILE);
  const frames = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => floorFrame(column, row, sheet.frames)),
  );
  return { sheet, frames };
}

/** A run of one wall sprite repeated from its top-left over the rect. */
export interface WallRun extends Rect {
  readonly sheet: Sheet;
}

/**
 * Other_4's ring of 32 px tiles round the room: the top and bottom rows
 * across it, then the left and right columns between them (the garden's left
 * one broken by the doorway). The rows start at 0 and room_height - 32, so on
 * the 540 px rooms the side columns' last tile overlaps the bottom row. The
 * shed's tiles are all `spr_wall`; the garden's rows are `spr_fence`, its
 * columns `spr_fence_v`, and its four corner tiles are left out (obj_wall Draw_0)
 * for the mitred corners.
 */
export function wallRuns(room: Room): WallRun[] {
  const garden = room.key === 'garden';
  const bottom = room.height - TILE;
  const right = room.width - TILE;
  const rowFrom = garden ? TILE : 0;
  const rowW = room.width - 2 * rowFrom;
  const row = garden ? SHEETS.fence : SHEETS.wall;
  const column = garden ? SHEETS.fenceV : SHEETS.wall;
  // Other_4: for (_wy = _y0 + 32; _wy < _y1; _wy += 32), so the last tile starts before the bottom row.
  const columnEnd = TILE * Math.ceil(bottom / TILE);
  const left: Rect[] = garden
    ? [
        { x: 0, y: TILE, w: TILE, h: DOORWAY.top - TILE },
        { x: 0, y: DOORWAY.bottom, w: TILE, h: columnEnd - DOORWAY.bottom },
      ]
    : [{ x: 0, y: TILE, w: TILE, h: columnEnd - TILE }];
  return [
    { sheet: row, x: rowFrom, y: 0, w: rowW, h: TILE },
    { sheet: row, x: rowFrom, y: bottom, w: rowW, h: TILE },
    ...left.map((r) => ({ ...r, sheet: column })),
    { sheet: column, x: right, y: TILE, w: TILE, h: columnEnd - TILE },
  ];
}

export interface ColourRect extends Rect {
  readonly colour: number;
}

/** Draw_73's wood tones: the art palette's wood_mid, dark and light. */
const WOOD_MID = 0x785537;
const WOOD_DARK = 0x462d19;
const WOOD_LIGHT = 0xa06e46;
/** spr_fence's rails sit at rows 13 and 22, spr_fence_v's at columns 12 and 18, 3 px wide. */
const RAIL_ROWS = [13, 22] as const;
const RAIL_COLUMNS = [12, 18] as const;
const RAIL = 3;
const TILE_PX = 32;

/**
 * Draw_73: each garden corner tile mitres the two rails of the runs it joins
 * into two nested L's, each leg a 3 px rail (mid, a light first pixel, a dark
 * last one). Rects in logical px, in draw order; none for the shed.
 */
export function fenceCorners(room: Room): ColourRect[] {
  if (room.key !== 'garden') return [];
  const w = room.width * 2;
  const h = room.height * 2;
  const corners = [
    [0, 0, true, true],
    [w - TILE_PX, 0, false, true],
    [0, h - TILE_PX, true, false],
    [w - TILE_PX, h - TILE_PX, false, false],
  ] as const;
  const rects: ColourRect[] = [];
  const rail = (x0: number, y0: number, x1: number, y1: number, vertical: boolean): void => {
    // Prototype px [x0, x1) x [y0, y1); the light pixel on the top or left edge, the dark on the other.
    const lo = vertical ? { x1: x0 + 1 } : { y1: y0 + 1 };
    const hi = vertical ? { x0: x0 + 2 } : { y0: y0 + 2 };
    for (const [colour, r] of [
      [WOOD_MID, {}],
      [WOOD_LIGHT, lo],
      [WOOD_DARK, hi],
    ] as const) {
      const b = { x0, y0, x1, y1, ...r };
      rects.push({
        colour,
        x: fromPrototype(b.x0),
        y: fromPrototype(b.y0),
        w: fromPrototype(b.x1 - b.x0),
        h: fromPrototype(b.y1 - b.y0),
      });
    }
  };
  for (const [tx, ty, left, top] of corners) {
    const outerRow = top ? RAIL_ROWS[0] : RAIL_ROWS[1];
    const innerRow = top ? RAIL_ROWS[1] : RAIL_ROWS[0];
    const outerColumn = left ? RAIL_COLUMNS[0] : RAIL_COLUMNS[1];
    const innerColumn = left ? RAIL_COLUMNS[1] : RAIL_COLUMNS[0];
    for (const [ry, rx] of [
      [outerRow, outerColumn],
      [innerRow, innerColumn],
    ] as const) {
      const hx0 = left ? rx : 0;
      const hx1 = left ? TILE_PX : rx + RAIL;
      rail(tx + hx0, ty + ry, tx + hx1, ty + ry + RAIL, false);
      const vy0 = top ? ry : 0;
      const vy1 = top ? TILE_PX : ry + RAIL;
      rail(tx + rx, ty + vy0, tx + rx + RAIL, ty + vy1, true);
    }
  }
  return rects;
}

/** Draw_0: the shed floor dimmed by black at 0.12 alpha. */
export const SHED_FLOOR_DIM = 0.12;

/** Draw_0's central rug: prototype (360, 220)..(600, 360), its outline and the border inset 7 px. */
export const SHED_RUG = {
  x: fromPrototype(360),
  y: fromPrototype(220),
  w: fromPrototype(600 - 360),
  h: fromPrototype(360 - 220),
  inset: fromPrototype(7),
  fill: 0x784842,
  outline: 0x55322e,
  border: 0x9b6e5f,
} as const;

/** A prop's sprite: sheet and frame, centred on (x, y) at `scale`. */
export interface PropSprite {
  readonly sheet: Sheet;
  readonly frame: number;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

const PROP_SHEETS: Record<string, Sheet> = {
  workbench: SHEETS.workbench,
  planting_table: SHEETS.plantingTable,
  shop_kiosk: SHEETS.shopKiosk,
};

/**
 * The prop's sprite, centred on the prop: the workbench, planting table and
 * kiosk at 1x, a pedestal at 1.5x (obj_pedestal), a door at 1x on the centre
 * of its rect (spr_door's origin is its top-left; the garden door's rect is
 * that 32 px square, halved), a source plant's species frame at 1x.
 */
export function propSprite(prop: Prop): PropSprite | undefined {
  const at = { x: prop.x, y: prop.y, frame: 0, scale: SPRITE_SCALE };
  if (prop.speciesKey) {
    return { ...at, sheet: SHEETS.sourcePlant, frame: sourcePlantFrame(prop.speciesKey) };
  }
  if (prop.pedestalKey !== undefined)
    return { ...at, sheet: SHEETS.pedestal, scale: PEDESTAL_SCALE };
  if (prop.target) return { ...at, sheet: SHEETS.door };
  const sheet = PROP_SHEETS[prop.key];
  return sheet && { ...at, sheet };
}

/** obj_pedestal Draw_0: the label's top, below the pedestal's centre; `(empty)` in grey, else the tree's label in white. */
export const PEDESTAL_LABEL_DY = fromPrototype(30);
export const PEDESTAL_EMPTY_LABEL = '(empty)';
export const PEDESTAL_EMPTY_COLOUR = '#969696';

/** A translucent black ellipse on the floor, centre and size in logical px. */
export interface Shadow {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly alpha: number;
}

/** draw_ellipse(x + x0, y + y0, x + x1, y + y1) around an origin, in prototype px. */
function ellipse(
  x: number,
  y: number,
  box: readonly [number, number, number, number],
  alpha: number,
  scale = SPRITE_SCALE,
): Shadow {
  const [x0, y0, x1, y1] = box;
  return {
    x: x + ((x0 + x1) / 2) * scale,
    y: y + ((y0 + y1) / 2) * scale,
    w: (x1 - x0) * scale,
    h: (y1 - y0) * scale,
    alpha,
  };
}

/** obj_source_plant and obj_pedestal's drop shadows; other props have none. */
export function propShadow(prop: Prop): Shadow | undefined {
  if (prop.speciesKey) return ellipse(prop.x, prop.y, [-18, 18, 18, 22], 0.25);
  if (prop.pedestalKey !== undefined) return ellipse(prop.x, prop.y, [-18, 20, 18, 25], 0.3);
  return undefined;
}

/** obj_player_2d's drop shadow round its centre origin. */
export function playerShadow(x: number, y: number): Shadow {
  return ellipse(x, y, [-16, 9, 16, 18], 0.25);
}

/** obj_tree_sprite's drop shadow round the sprite's centre, at the tree's scale (logical px per prototype px). */
export function treeShadow(x: number, y: number, scale: number): Shadow {
  return ellipse(x, y, [-16, 16, 16, 21], 0.25, scale);
}
