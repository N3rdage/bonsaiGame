/**
 * How a room is drawn, as pure data in logical px: the floor tiles
 * (obj_game_controller Draw_0), the wall and fence runs (Other_4's ring,
 * obj_wall Draw_0), the rooms' windows and furniture (the shed's decor), the
 * garden's mitred fence corners (Draw_73), the shed's
 * floor dim and rug, each prop's sprite and the drop shadows (the props' Draw
 * events), with each room's sheets and extras in one table, ROOM_STYLES. The
 * prototype's numbers are in prototype px and halved here.
 */

import { SHEETS, SPRITE_SCALE, floorFrame, sourcePlantFrame } from './assets';
import type { Sheet } from './assets';
import { DOORWAY } from './gardenRoom';
import {
  fromPrototype,
  insideWalls,
  type Gap,
  type Prop,
  type Rect,
  type Room,
  type RoomKey,
} from './shedRoom';

/** One prototype tile, 32 px, in logical px. */
export const TILE = fromPrototype(32);

/** The floor sheet, the area it covers and its frame per tile, rows top to bottom, tiles from the area's top-left. */
export interface FloorTiles {
  readonly sheet: Sheet;
  readonly area: Rect;
  readonly frames: readonly (readonly number[])[];
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

/** How a room's static art is drawn: its sheets, and what lies on and around its floor. */
export interface RoomStyle {
  readonly floor: Sheet;
  /** The ring's top and bottom rows, and its left and right columns. */
  readonly wallRow: Sheet;
  readonly wallColumn: Sheet;
  /** An inset room's floor fills only the inside of its ring; an outdoor one fills the canvas. */
  readonly inset: boolean;
  /** The ring's four corner tiles are left out for the mitred fence corners (fenceCorners). */
  readonly fenced: boolean;
  /** A gap in the ring's left column (the garden's doorway). */
  readonly leftGap?: Gap;
  /** Black over the floor at this alpha, 0 for none. */
  readonly floorDim: number;
  readonly rug?: typeof SHED_RUG;
}

/** The house rooms (new content: lounge, hallway, study) are drawn as the shed is, each with its own floor and walls and no dim or rug. */
export const ROOM_STYLES: Record<RoomKey, RoomStyle> = {
  shed: {
    floor: SHEETS.floorShed,
    wallRow: SHEETS.wall,
    wallColumn: SHEETS.wall,
    inset: true,
    fenced: false,
    floorDim: SHED_FLOOR_DIM,
    rug: SHED_RUG,
  },
  garden: {
    floor: SHEETS.floorGarden,
    wallRow: SHEETS.fence,
    wallColumn: SHEETS.fenceV,
    inset: false,
    fenced: true,
    leftGap: DOORWAY,
    floorDim: 0,
  },
  lounge: {
    floor: SHEETS.floorLounge,
    wallRow: SHEETS.wallLounge,
    wallColumn: SHEETS.wallLounge,
    inset: true,
    fenced: false,
    floorDim: 0,
  },
  hallway: {
    floor: SHEETS.floorHallway,
    wallRow: SHEETS.wallHallway,
    wallColumn: SHEETS.wallHallway,
    inset: true,
    fenced: false,
    floorDim: 0,
  },
  study: {
    floor: SHEETS.floorStudy,
    wallRow: SHEETS.wallStudy,
    wallColumn: SHEETS.wallStudy,
    inset: true,
    fenced: false,
    floorDim: 0,
  },
};

/**
 * Draw_0: an inset room's floor (the shed's, the house rooms') fills only the
 * inside of its ring, (SHED_X0 + 32, SHED_Y0 + 32) to (SHED_X1, SHED_Y1), the
 * dark background showing round it; the garden's fills the room. Each tile's
 * frame hashes its column and row in the room, so a tile keeps its frame
 * wherever the area starts.
 */
export function floorTiles(room: Room): FloorTiles {
  const style = ROOM_STYLES[room.key];
  const sheet = style.floor;
  const area = style.inset ? insideWalls(room) : { x: 0, y: 0, w: room.width, h: room.height };
  const column0 = area.x / TILE;
  const row0 = area.y / TILE;
  const frames = Array.from({ length: Math.ceil(area.h / TILE) }, (_, row) =>
    Array.from({ length: Math.ceil(area.w / TILE) }, (_, column) =>
      floorFrame(column0 + column, row0 + row, sheet.frames),
    ),
  );
  return { sheet, area, frames };
}

/** A run of one wall sprite repeated from its top-left over the rect. */
export interface WallRun extends Rect {
  readonly sheet: Sheet;
}

/**
 * Other_4's ring of 32 px tiles round the room's bounds: the top and bottom
 * rows across it, then the left and right columns between them (the garden's
 * left one broken by the doorway). The garden's rows start at 0 and
 * room_height - 32, so on its 540 px room the side columns' last tile overlaps
 * the bottom row; the shed's ring, SHED_X0..SHED_Y1, is whole tiles. The shed's
 * tiles are all `spr_wall` and each house room's all its own wall sheet; the
 * garden's rows are `spr_fence`, its columns `spr_fence_v`, and its four
 * corner tiles are left out (obj_wall Draw_0) for the mitred corners. The
 * room's windows follow (windowRuns), so the bake draws them over the top
 * row, and its furniture comes last (furnitureRuns), over the floor and walls.
 */
export function wallRuns(room: Room): WallRun[] {
  const { wallRow: row, wallColumn: column, fenced, leftGap } = ROOM_STYLES[room.key];
  const { x, y, w, h } = room.bounds;
  const bottom = y + h - TILE;
  const right = x + w - TILE;
  const rowFrom = fenced ? x + TILE : x;
  const rowW = w - (fenced ? 2 * TILE : 0);
  const top = y + TILE;
  // Other_4: for (_wy = _y0 + 32; _wy < _y1; _wy += 32), so the last tile starts before the bottom row.
  const columnEnd = top + TILE * Math.ceil((bottom - top) / TILE);
  const left: Rect[] = leftGap
    ? [
        { x, y: top, w: TILE, h: leftGap.top - top },
        { x, y: leftGap.bottom, w: TILE, h: columnEnd - leftGap.bottom },
      ]
    : [{ x, y: top, w: TILE, h: columnEnd - top }];
  return [
    { sheet: row, x: rowFrom, y, w: rowW, h: TILE },
    { sheet: row, x: rowFrom, y: bottom, w: rowW, h: TILE },
    ...left.map((r) => ({ ...r, sheet: column })),
    { sheet: column, x: right, y: top, w: TILE, h: columnEnd - top },
    ...windowRuns(room),
    ...furnitureRuns(room),
  ];
}

/** Each piece of the room's furniture as a run of its sheet over its rect, in the room's order. */
export function furnitureRuns(room: Room): WallRun[] {
  return room.furniture.map(({ sheet, x, y, w, h }) => ({ sheet, x, y, w, h }));
}

/** Each of the room's windows as a run of `spr_window` along its top wall band, one 16 px pane a tile. */
export function windowRuns(room: Room): WallRun[] {
  const { y } = room.bounds;
  return room.windows.map(({ x, w }) => ({ sheet: SHEETS.window, x, y, w, h: TILE }));
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
 * last one). Rects in logical px, in draw order; none for the indoor rooms.
 */
export function fenceCorners(room: Room): ColourRect[] {
  if (!ROOM_STYLES[room.key].fenced) return [];
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

/** A prop's sprite: sheet and frame, centred on (x, y) at `scale`, drawn at `depth`. */
export interface PropSprite {
  readonly sheet: Sheet;
  readonly frame: number;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly depth: number;
}

const PROP_SHEETS: Record<string, Sheet> = {
  workbench: SHEETS.workbench,
  planting_table: SHEETS.plantingTable,
  shop_kiosk: SHEETS.shopKiosk,
};

/**
 * The prop's sprite, centred on the prop: the workbench, planting table and
 * kiosk at 1x, a door at 1x on the centre of its rect (spr_door's origin is
 * its top-left; each door's rect is that 32 px square, halved), in its own
 * `sheet` if it has one (the study's glazed double door is 64x32), a source
 * plant's species frame at 1x, and none for a display spot, which is drawn
 * by the furniture it is on (obj_pedestal's 1.5x pedestal is gone). A prop sorts
 * against the player at its bottom edge; a door sits in its wall or fence, so
 * it sorts at its top edge, behind the player as the walls are (obj_player_2d
 * Step_0 draws the player in front of walls and doors).
 */
export function propSprite(prop: Prop): PropSprite | undefined {
  const at = { x: prop.x, y: prop.y, frame: 0, scale: SPRITE_SCALE, depth: prop.y + prop.h / 2 };
  if (prop.speciesKey) {
    return { ...at, sheet: SHEETS.sourcePlant, frame: sourcePlantFrame(prop.speciesKey) };
  }
  if (prop.pedestalKey !== undefined) return undefined;
  if (prop.target) return { ...at, sheet: prop.sheet ?? SHEETS.door, depth: prop.y - prop.h / 2 };
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

/** obj_source_plant's drop shadow; other props have none (a display spot is on furniture, not obj_pedestal). */
export function propShadow(prop: Prop): Shadow | undefined {
  if (prop.speciesKey) return ellipse(prop.x, prop.y, [-18, 18, 18, 22], 0.25);
  return undefined;
}

/**
 * Draw_0's ground shadow under each piece of the shed's decor, black at 0.18
 * alpha: `draw_ellipse(dx - w/3, dy - 4, dx + w/3, dy + 2)` round the
 * sprite's bottom-centre origin, `w` its prototype width. The bake draws them
 * on the floor, under the furniture as the prototype drew each before its sprite.
 */
export function furnitureShadows(room: Room): Shadow[] {
  return room.furniture
    .filter((f) => f.shadow)
    .map(({ x, y, w, h }) => {
      const third = w / SPRITE_SCALE / 3;
      return ellipse(x + w / 2, y + h, [-third, -4, third, 2], 0.18);
    });
}

/** obj_player_2d's drop shadow round its centre origin. */
export function playerShadow(x: number, y: number): Shadow {
  return ellipse(x, y, [-16, 9, 16, 18], 0.25);
}

/** obj_tree_sprite's drop shadow round the sprite's centre, at the tree's scale (logical px per prototype px). */
export function treeShadow(x: number, y: number, scale: number): Shadow {
  return ellipse(x, y, [-16, 16, 16, 21], 0.25, scale);
}
