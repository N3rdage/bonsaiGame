/**
 * How a room is drawn, as pure data in logical px: the floor tiles
 * (obj_game_controller Draw_0), the wall and fence runs (Other_4's ring,
 * obj_wall Draw_0), or a back wall's face and the other walls' caps, the
 * rooms' windows and furniture (the shed's decor, the garden's buildings),
 * the shed's rug, each prop's sprite, the drop shadows (the props' Draw
 * events) and the gardens' season wash, with each room's sheets and extras in
 * one table, ROOM_STYLES. The prototype's numbers are in prototype px and
 * halved here.
 */

import {
  PLAYER_FEET,
  SHEETS,
  SPRITE_SCALE,
  floorFrame,
  sheetPxPerLogical,
  sourcePlantFrame,
} from './assets';
import { PALETTE } from './palette';
import { PROTOTYPE_SCALE } from './prototype';
import type { Season } from '../sim/seasons';
import type { Sheet } from './assets';
import {
  fromPrototype,
  insideWalls,
  type Furniture,
  type Prop,
  type Rect,
  type Room,
  type RoomKey,
} from './shedRoom';
import { isIndoor } from './weather';

/** One prototype tile, 32 px, in logical px. */
export const TILE = fromPrototype(32);

/** The floor sheet, the area it covers and its frame per tile, rows top to bottom, tiles from the area's top-left. */
export interface FloorTiles {
  readonly sheet: Sheet;
  readonly area: Rect;
  readonly frames: readonly (readonly number[])[];
}

/** Draw_0's central rug: prototype (360, 220)..(600, 360), halved, where the shed lays spr_shed_rug. */
export const SHED_RUG: Rect = {
  x: fromPrototype(360),
  y: fromPrototype(220),
  w: fromPrototype(600 - 360),
  h: fromPrototype(360 - 220),
};

/** The scale rule's back wall, 2.4 m high: a 48 px face (art/inked/README.md). */
export const BACK_WALL_FACE = 48;
/** The scale rule's 0.25 m wall cap: an 8 px band. */
export const WALL_CAP = 8;

/**
 * A room whose back wall is drawn as its face: `sheet`, TILE wide and
 * `height` tall, repeated along the top of the ring with its bottom edge on
 * the floor line (the top band's bottom edge), so it rises `height - TILE`
 * above the ring; its frames scatter as the floor's. The side and south walls
 * are drawn as caps `cap` deep (the style's wallColumn and wallRow) on their
 * collision bands' inner edges, against the floor.
 */
export interface WallFace {
  readonly sheet: Sheet;
  readonly height: number;
  readonly cap: number;
}

/** The sheet a room's windows are drawn with, and its top's height above the floor line in logical px. */
export interface WindowStyle {
  readonly sheet: Sheet;
  readonly top: number;
}

/** How a room's static art is drawn: its sheets, and what lies on and around its floor. */
export interface RoomStyle {
  readonly floor: Sheet;
  /** The ring's top and bottom rows, and its left and right columns; with a `face`, the south and side caps. */
  readonly wallRow: Sheet;
  readonly wallColumn: Sheet;
  /** The back wall drawn as a face standing on the floor line, the other walls as caps; none for a ring of whole bands. */
  readonly face?: WallFace;
  readonly window: WindowStyle;
  /** An inset room's floor fills only the inside of its ring; an outdoor one fills the canvas. */
  readonly inset: boolean;
  /** The ring's four corner tiles drawn as this sheet's frames NW, NE, SW, SE (a fence's corner posts); none for corners of the row's sheet. */
  readonly corner?: Sheet;
  /** A sheet laid over its rect on the floor, under the shadows and furniture. */
  readonly rug?: WallRun;
  /** The Inked paper (spr_paper) laid over the whole room first, under the floor (paperTiles). */
  readonly paper: boolean;
}

/** The house rooms' window, spr_window, over the top wall band: its top is a band above the floor line. */
const BAND_WINDOW: WindowStyle = { sheet: SHEETS.window, top: TILE };

/** The house rooms (new content: lounge, hallway, study) are inset as the shed is, each with its own floor and a ring of its own wall sheet, and no rug. */
export const ROOM_STYLES: Record<RoomKey, RoomStyle> = {
  // The shed in Inked: its back wall's face, its caps, its window on the face (its sill 20 px,
  // 0.94 m, above the floor) and its rug, on paper: the surround outside the walls and the bands'
  // outer halves show spr_paper, and the HUD reads on it through its ink plate (TEXT_BACKING).
  shed: {
    floor: SHEETS.floorShed,
    wallRow: SHEETS.shedCap,
    wallColumn: SHEETS.shedCapV,
    face: { sheet: SHEETS.shedWall, height: BACK_WALL_FACE, cap: WALL_CAP },
    window: { sheet: SHEETS.shedWindow, top: 44 },
    inset: true,
    rug: { sheet: SHEETS.shedRug, ...SHED_RUG },
    paper: true,
  },
  // The back garden in Inked: its lawn, its fence ring with corner posts, its buildings in
  // EXTERIORS. No paper: the lawn fills the canvas, so nothing would show it.
  garden: {
    floor: SHEETS.floorGarden,
    wallRow: SHEETS.fence,
    wallColumn: SHEETS.fenceV,
    window: BAND_WINDOW,
    inset: false,
    corner: SHEETS.fenceCorner,
    paper: false,
  },
  // The front garden in Inked: its lawn, its north row the low front fence (cut out over the lawn;
  // the drive and the path drawn over it are its gaps), its south row under the faces' furniture,
  // its columns the back garden's side fence. Its corners are plain tiles of the row, the low
  // fence running out to the canvas's edges: spr_fence_corner's post and palings are the 0.75 m
  // fence's and would stand up out of the low one at the kerb. No paper: the lawn fills the
  // canvas, under the road and the roofs, so nothing would show it.
  frontGarden: {
    floor: SHEETS.floorGarden,
    wallRow: SHEETS.fenceLow,
    wallColumn: SHEETS.fenceV,
    window: BAND_WINDOW,
    inset: false,
    paper: false,
  },
  lounge: {
    floor: SHEETS.floorLounge,
    wallRow: SHEETS.wallLounge,
    wallColumn: SHEETS.wallLounge,
    window: BAND_WINDOW,
    inset: true,
    paper: false,
  },
  hallway: {
    floor: SHEETS.floorHallway,
    wallRow: SHEETS.wallHallway,
    wallColumn: SHEETS.wallHallway,
    window: BAND_WINDOW,
    inset: true,
    paper: false,
  },
  study: {
    floor: SHEETS.floorStudy,
    wallRow: SHEETS.wallStudy,
    wallColumn: SHEETS.wallStudy,
    window: BAND_WINDOW,
    inset: true,
    paper: false,
  },
  // The greenhouse is drawn as a house room: its glass on all four sides round a paved floor.
  greenhouse: {
    floor: SHEETS.floorGreenhouse,
    wallRow: SHEETS.wallGlass,
    wallColumn: SHEETS.wallGlass,
    window: BAND_WINDOW,
    inset: true,
    paper: false,
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

/** A run of one wall sprite's frame (0 unless given) repeated from its top-left over the rect. */
export interface WallRun extends Rect {
  readonly sheet: Sheet;
  readonly frame?: number;
}

/** One paper tile's top-left in logical px. */
export interface PaperTile {
  readonly sheet: Sheet;
  readonly x: number;
  readonly y: number;
}

/**
 * When the style lays paper, spr_paper over the whole room from (0, 0) in
 * steps of its own logical size (64 px, one grain period), rows top to
 * bottom, so the grain runs on unbroken across the room; none otherwise.
 */
export function paperTiles(room: Room, style: RoomStyle = ROOM_STYLES[room.key]): PaperTile[] {
  if (!style.paper) return [];
  const sheet = SHEETS.paper;
  const step = sheet.frameWidth / sheetPxPerLogical(sheet);
  return Array.from({ length: Math.ceil(room.height / step) }, (_, row) =>
    Array.from({ length: Math.ceil(room.width / step) }, (_, column) => ({
      sheet,
      x: column * step,
      y: row * step,
    })),
  ).flat();
}

/**
 * The baked room texture's px per logical px: the finest of PROTOTYPE_SCALE
 * and every sheet the bake draws (its floor, rug, wall, face and window runs,
 * baked furniture and, when laid, the paper), so no sheet is drawn below its
 * own resolution. Pixel sheets only give PROTOTYPE_SCALE; any Inked sheet
 * gives INKED_PER_LOGICAL.
 */
export function bakeScale(room: Room, style: RoomStyle = ROOM_STYLES[room.key]): number {
  const sheets = [
    style.floor,
    style.wallRow,
    style.wallColumn,
    ...(style.face ? [style.face.sheet] : []),
    ...(style.rug ? [style.rug.sheet] : []),
    ...windowRuns(room).map((r) => r.sheet),
    ...furnitureRuns(room).map((r) => r.sheet),
    ...paperTiles(room, style).map((t) => t.sheet),
  ];
  return Math.max(PROTOTYPE_SCALE, ...sheets.map(sheetPxPerLogical));
}

/**
 * Other_4's ring round the room's bounds, then the room's windows
 * (windowRuns), so the bake draws them over the wall, and last its furniture
 * (furnitureRuns), over the floor and walls: the garden's buildings cover the
 * ring where the plan has no fence. A room with a `face` (the shed) draws its
 * ring as the face and caps (faceRuns); every other room as bands of whole
 * tiles (bandRuns).
 */
export function wallRuns(room: Room): WallRun[] {
  const style = ROOM_STYLES[room.key];
  return [
    ...(style.face ? faceRuns(room, style.face, style) : bandRuns(room, style)),
    ...windowRuns(room),
    ...furnitureRuns(room),
  ];
}

/**
 * The ring as 32 px tiles: the top and bottom rows across the bounds, then the
 * left and right columns between them (runsOver: a sheet with variants
 * scatters them tile by tile). Each house room's tiles are all its own wall
 * sheet; the garden's rows are `spr_fence`, its columns `spr_fence_v`, and,
 * with a `corner` sheet, its four corner tiles are left out of the rows
 * (obj_wall Draw_0) and drawn last as that sheet's frames, NW, NE, SW, SE.
 */
function bandRuns(room: Room, { wallRow: row, wallColumn: column, corner }: RoomStyle): WallRun[] {
  const { x, y, w, h } = room.bounds;
  const bottom = y + h - TILE;
  const right = x + w - TILE;
  const rowFrom = corner ? x + TILE : x;
  const rowW = w - (corner ? 2 * TILE : 0);
  const top = y + TILE;
  // Other_4: for (_wy = _y0 + 32; _wy < _y1; _wy += 32), so the last tile starts before the bottom row.
  const columnEnd = top + TILE * Math.ceil((bottom - top) / TILE);
  const corners = corner
    ? (
        [
          [x, y],
          [right, y],
          [x, bottom],
          [right, bottom],
        ] as const
      ).map(([cx, cy], frame) => ({ sheet: corner, frame, x: cx, y: cy, w: TILE, h: TILE }))
    : [];
  return [
    ...runsOver(row, { x: rowFrom, y, w: rowW, h: TILE }),
    ...runsOver(row, { x: rowFrom, y: bottom, w: rowW, h: TILE }),
    ...runsOver(column, { x, y: top, w: TILE, h: columnEnd - top }),
    ...runsOver(column, { x: right, y: top, w: TILE, h: columnEnd - top }),
    ...corners,
  ];
}

/** A one-frame sheet as one run repeated over the rect; a sheet of variants cut into its tiles, each frame hashed from where it lands (tileRuns). */
function runsOver(sheet: Sheet, area: Rect): WallRun[] {
  return sheet.frames > 1 ? tileRuns(sheet, area) : [{ sheet, ...area }];
}

/**
 * The ring as a back wall's face and caps: the face's tiles across the top
 * band between the side walls, standing on the floor line; the side walls'
 * caps on their bands' inner edges from the face's top down to the south
 * band; the south wall's cap on its band's inner edge across both side caps.
 * The bands' outer parts show the paper. Each tile is its own run, its frame
 * hashed from its column and row as the floor's (floorFrame), so neighbours
 * differ. Collision is still the whole ring (ringWalls).
 */
function faceRuns(room: Room, face: WallFace, { wallRow, wallColumn }: RoomStyle): WallRun[] {
  const { x, y, w, h } = room.bounds;
  const faceTop = y + TILE - face.height;
  const left = x + TILE - face.cap;
  const right = x + w - TILE;
  const south = y + h - TILE;
  return [
    ...tileRuns(face.sheet, { x: x + TILE, y: faceTop, w: right - x - TILE, h: face.height }),
    ...tileRuns(wallColumn, { x: left, y: faceTop, w: face.cap, h: south - faceTop }),
    ...tileRuns(wallColumn, { x: right, y: faceTop, w: face.cap, h: south - faceTop }),
    ...tileRuns(wallRow, { x: left, y: south, w: right + face.cap - left, h: face.cap }),
  ];
}

/** The rect cut into the sheet's frames at their logical size, rows top to bottom, each frame hashed from where it lands. */
function tileRuns(sheet: Sheet, area: Rect): WallRun[] {
  const tw = sheet.frameWidth / sheetPxPerLogical(sheet);
  const th = sheet.frameHeight / sheetPxPerLogical(sheet);
  return Array.from({ length: Math.ceil(area.h / th) }, (_, row) =>
    Array.from({ length: Math.ceil(area.w / tw) }, (_, column) => {
      const x = area.x + column * tw;
      const y = area.y + row * th;
      const frame = floorFrame(Math.floor(x / TILE), Math.floor(y / TILE), sheet.frames);
      return { sheet, frame, x, y, w: tw, h: th };
    }),
  ).flat();
}

/**
 * Each baked piece of the room's furniture as runs of its sheet over its rect,
 * in the room's order (runsOver: one run for a one-frame sheet, a run per
 * tile for a sheet of variants, so the garden's faces and roofs scatter
 * theirs); the sorted pieces are sprites (furnitureSprites).
 */
export function furnitureRuns(room: Room): WallRun[] {
  return room.furniture
    .filter((f) => !f.sorted)
    .flatMap(({ sheet, x, y, w, h }) => runsOver(sheet, { x, y, w, h }));
}

/**
 * Each of the room's windows as a run of its style's window sheet, its top
 * `top` above the floor line and its sheet's height tall: in the house rooms
 * `spr_window` along the top wall band, one 16 px pane a tile; in the shed
 * one `spr_shed_window` on the back wall's face.
 */
export function windowRuns(room: Room): WallRun[] {
  const { sheet, top } = ROOM_STYLES[room.key].window;
  const y = room.bounds.y + TILE - top;
  const h = sheet.frameHeight / sheetPxPerLogical(sheet);
  return room.windows.map(({ x, w }) => ({ sheet, x, y, w, h }));
}

/** A translucent colour laid over a room's whole baked art. */
export interface Wash {
  readonly colour: number;
  readonly alpha: number;
}

/**
 * The gardens' per-season wash (new content, #113): a touch fresher in
 * spring, today's look in summer, browning in autumn, pale and frosted in
 * winter. A wash rather than a multiply tint, since a multiply only darkens
 * and the green grass can neither turn brown nor pale under one. The colours
 * are Inked palette entries (palette.ts); the alphas suit the Inked lawn.
 */
const GARDEN_SEASON_WASHES: Readonly<Record<Season, Wash | undefined>> = {
  spring: { colour: PALETTE.lawnSpring, alpha: 0.15 },
  summer: undefined,
  autumn: { colour: PALETTE.lawnAutumn, alpha: 0.35 },
  winter: { colour: PALETTE.frost, alpha: 0.45 },
};

/** The wash over the room's static art (floor, fence, furniture) in this season, or none; the gardens have it, the indoor rooms none. */
export function seasonWash(room: Room, season: Season): Wash | undefined {
  return isIndoor(room) ? undefined : GARDEN_SEASON_WASHES[season];
}

/**
 * A prop's sprite: sheet and frame, its origin (x centre, `originY` down the
 * frame: 0.5 its centre, 1 its bottom edge) at (x, y), drawn at `scale` and
 * `depth`.
 */
export interface PropSprite {
  readonly sheet: Sheet;
  readonly frame: number;
  readonly x: number;
  readonly y: number;
  readonly originY: number;
  readonly scale: number;
  readonly depth: number;
}

/**
 * A sheet's sprite on the footprint centred on (x, y), `h` deep, at one
 * logical px per sheetPxPerLogical sheet px: an Inked sheet stands
 * bottom-centre on the footprint's bottom edge, so its drawn height rises
 * above the footprint (the scale rule); a pixel sheet is centred on it at
 * SPRITE_SCALE, as the prototype drew it.
 */
function onFootprint(
  sheet: Sheet,
  frame: number,
  x: number,
  y: number,
  h: number,
  depth: number,
): PropSprite {
  const scale = 1 / sheetPxPerLogical(sheet);
  if (sheet.art === 'inked') return { sheet, frame, x, y: y + h / 2, originY: 1, scale, depth };
  return { sheet, frame, x, y, originY: 0.5, scale, depth };
}

/** The top edge of a sprite as drawn: its frame's height at its scale above (originY 1) or about (0.5) its y. */
function spriteTop({ sheet, y, originY, scale }: PropSprite): number {
  return y - sheet.frameHeight * scale * originY;
}

const PROP_SHEETS: Record<string, Sheet> = {
  workbench: SHEETS.workbench,
  planting_table: SHEETS.plantingTable,
  shop_kiosk: SHEETS.shopKiosk,
};

/**
 * The prop's sprite on its rect (onFootprint): the shed's Inked workbench,
 * planting table and kiosk standing on their footprints' bottom edges, a door
 * (any prop in a wall, the side gate too) in its own `sheet` if it has one
 * (the study's glazed double door is 64x32; the Inked doors, the shed's, the
 * garden's and the side gate, stand on their rects' bottom edges), else
 * spr_door at 1x on the centre of its rect (spr_door's origin is its
 * top-left; each door's rect is that 32 px square, halved), a source plant's
 * Inked species frame standing on its rect's bottom edge, and none for a display spot,
 * which is drawn by the furniture it is on (obj_pedestal's 1.5x pedestal is
 * gone). A prop sorts against the player at its bottom edge; a door sits in
 * its wall or fence, so it sorts at its top edge, behind the player as the
 * walls are (obj_player_2d Step_0 draws the player in front of walls and doors),
 * a door in a south wall at its sprite's drawn top if that is higher.
 */
export function propSprite(prop: Prop): PropSprite | undefined {
  const { x, y, h } = prop;
  if (prop.speciesKey) {
    return onFootprint(SHEETS.sourcePlant, sourcePlantFrame(prop.speciesKey), x, y, h, y + h / 2);
  }
  if (prop.pedestalKey !== undefined) return undefined;
  if (prop.wall) {
    const door = onFootprint(prop.sheet ?? SHEETS.door, 0, x, y, h, y - h / 2);
    // The player is only ever north of a south wall's door, and its face is baked under the
    // player, so the door sorts at its drawn top: one taller than the band (the front garden's
    // front door, 40 px on the face's foot) stays behind the player standing at it.
    return prop.wall === 'S' ? { ...door, depth: Math.min(door.depth, spriteTop(door)) } : door;
  }
  const sheet = PROP_SHEETS[prop.key];
  return sheet && onFootprint(sheet, 0, x, y, h, y + h / 2);
}

/** Each sorted piece of furniture's sprite, frame 0 on its rect (onFootprint), sorting against the player at its bottom edge as a prop does. */
export function furnitureSprites(room: Room): PropSprite[] {
  return room.furniture
    .filter((f) => f.sorted)
    .map(({ sheet, x, y, w, h }) => onFootprint(sheet, 0, x + w / 2, y + h / 2, h, y + h));
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
 * sprite's bottom-centre origin, `w` the piece's width in prototype px. The bake draws the
 * baked pieces' on the floor, under the furniture as the prototype drew each
 * before its sprite; the sorted pieces' are drawn live (sortedFurnitureShadows).
 */
export function furnitureShadows(room: Room): Shadow[] {
  return decorShadows(room.furniture.filter((f) => !f.sorted));
}

/** The sorted pieces' Draw_0 shadows, drawn with the props' on the live shadow layer. */
export function sortedFurnitureShadows(room: Room): Shadow[] {
  return decorShadows(room.furniture.filter((f) => f.sorted));
}

function decorShadows(furniture: readonly Furniture[]): Shadow[] {
  return furniture
    .filter((f) => f.shadow)
    .map(({ x, y, w, h }) => {
      const third = (w * PROTOTYPE_SCALE) / 3;
      return ellipse(x + w / 2, y + h, [-third, -4, third, 2], 0.18);
    });
}

/**
 * obj_player_2d's drop shadow, 16 x 4.5 logical px, centred under the figure's
 * feet at y + PLAYER_FEET (the box is in prototype px, halved by `ellipse`).
 */
export function playerShadow(x: number, y: number): Shadow {
  return ellipse(x, y, [-16, 2 * PLAYER_FEET - 4.5, 16, 2 * PLAYER_FEET + 4.5], 0.25);
}

/** obj_tree_sprite's drop shadow round the sprite's centre, at the tree's scale (logical px per prototype px). */
export function treeShadow(x: number, y: number, scale: number): Shadow {
  return ellipse(x, y, [-16, 16, 16, 21], 0.25, scale);
}
