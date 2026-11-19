/**
 * How a room is drawn, as pure data in logical px: the floor tiles
 * (obj_game_controller Draw_0), the wall and fence runs (Other_4's ring,
 * obj_wall Draw_0), or a back wall's face and the other walls' caps, the
 * rooms' windows and furniture (the shed's decor, the garden's buildings),
 * the shed's rug, each prop's sprite, the shadows the walls and furniture
 * cast in the one light (lighting.ts), the prototype's drop shadows (the
 * props' Draw events) and the gardens' season wash, with each room's sheets
 * and extras in one table, ROOM_STYLES. The prototype's numbers are in
 * prototype px and halved here.
 */

import {
  PLAYER_FEET,
  SHEETS,
  SPRITE_SCALE,
  floorFrame,
  sheetPxPerLogical,
  sourcePlantFrame,
} from './assets';
import { SHADOW_ALPHA, castOffset } from './lighting';
import { PALETTE } from './palette';
import { PROTOTYPE_SCALE } from './prototype';
import type { Season } from '../sim/seasons';
import type { Sheet } from './assets';
import {
  fromPrototype,
  insideWalls,
  ringWalls,
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
/** The gardens' 0.75 m fence stands 16 px, the front garden's low 0.5 m fence 11 (10.67, the scale rule's 21.33 px/m). */
export const FENCE_HEIGHT = 16;
export const LOW_FENCE_HEIGHT = 11;

/** How tall a room's walls stand, logical px: its top and bottom rows, and its left and right columns. */
export interface WallHeight {
  readonly row: number;
  readonly column: number;
}

/** A room's walls the back wall's 2.4 m all round. */
const FULL_HEIGHT: WallHeight = { row: BACK_WALL_FACE, column: BACK_WALL_FACE };

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
  /**
   * How tall the ring's walls stand, so each casts its shadow on the floor
   * (castShadows): the face's 2.4 m all round where the room has a face,
   * the 0.75 m fence round the back garden, and the front garden's low
   * 0.5 m fence along its rows with the 0.75 m fence down its columns.
   */
  readonly wallHeight: WallHeight;
  /** The sheet the room's windows are drawn with; none for a room with no windows. */
  readonly window?: WindowStyle;
  /** An inset room's floor fills only the inside of its ring; an outdoor one fills the canvas. */
  readonly inset: boolean;
  /** The ring's four corner tiles drawn as this sheet's frames NW, NE, SW, SE (a fence's corner posts); none for corners of the row's sheet. */
  readonly corner?: Sheet;
  /** A sheet laid over its rect on the floor, under the shadows and furniture. */
  readonly rug?: WallRun;
  /** The Inked paper (spr_paper) laid over the whole room first, under the floor (paperTiles). */
  readonly paper: boolean;
}

/**
 * The house rooms (new content: lounge, hallway, study) are inset as the
 * shed is, and drawn in Inked as the shed is: each its own floor, its back
 * wall's face, its own caps and, but the hallway, its own window on the face,
 * its sill 20 px above the floor line as the shed's, on paper, with no rug.
 * The lounge's hallway block is solid furniture drawn as the paper (the house
 * beyond the room, as the surround is) with the lounge's caps on its two open
 * edges, each a non-solid run of a cap sheet (loungeRoom.ts's HALLWAY_BLOCK
 * and HALLWAY_BLOCK_CAPS); collision is still the whole block.
 */
export const ROOM_STYLES: Record<RoomKey, RoomStyle> = {
  // The shed in Inked: its back wall's face, its caps, its window on the face (its sill 20 px,
  // 0.94 m, above the floor) and its rug, on paper: the surround outside the walls and the bands'
  // outer halves show spr_paper, and the HUD reads on it from its paper plate (PANEL_STYLE.plate).
  shed: {
    floor: SHEETS.floorShed,
    wallRow: SHEETS.shedCap,
    wallColumn: SHEETS.shedCapV,
    face: { sheet: SHEETS.shedWall, height: BACK_WALL_FACE, cap: WALL_CAP },
    wallHeight: FULL_HEIGHT,
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
    wallHeight: { row: FENCE_HEIGHT, column: FENCE_HEIGHT },
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
    wallHeight: { row: LOW_FENCE_HEIGHT, column: FENCE_HEIGHT },
    inset: false,
    paper: false,
  },
  lounge: {
    floor: SHEETS.floorLounge,
    wallRow: SHEETS.loungeCap,
    wallColumn: SHEETS.loungeCapV,
    face: { sheet: SHEETS.wallLounge, height: BACK_WALL_FACE, cap: WALL_CAP },
    wallHeight: FULL_HEIGHT,
    window: { sheet: SHEETS.loungeWindow, top: 44 },
    inset: true,
    paper: true,
  },
  hallway: {
    floor: SHEETS.floorHallway,
    wallRow: SHEETS.hallwayCap,
    wallColumn: SHEETS.hallwayCapV,
    face: { sheet: SHEETS.wallHallway, height: BACK_WALL_FACE, cap: WALL_CAP },
    wallHeight: FULL_HEIGHT,
    inset: true,
    paper: true,
  },
  study: {
    floor: SHEETS.floorStudy,
    wallRow: SHEETS.studyCap,
    wallColumn: SHEETS.studyCapV,
    face: { sheet: SHEETS.wallStudy, height: BACK_WALL_FACE, cap: WALL_CAP },
    wallHeight: FULL_HEIGHT,
    window: { sheet: SHEETS.studyWindow, top: 44 },
    inset: true,
    paper: true,
  },
  // The greenhouse in Inked, drawn as the house rooms are: its paved floor, its back wall's face
  // the glass house seen from inside, and its side and south walls the garden's white frame rails
  // as caps, on paper. No window: the face is glass.
  greenhouse: {
    floor: SHEETS.floorGreenhouse,
    wallRow: SHEETS.greenhouseCap,
    wallColumn: SHEETS.greenhouseCapV,
    face: { sheet: SHEETS.greenhouseWall, height: BACK_WALL_FACE, cap: WALL_CAP },
    wallHeight: FULL_HEIGHT,
    inset: true,
    paper: true,
  },
};

/**
 * Draw_0: an inset room's floor (the shed's, the house rooms', the greenhouse's) fills only the
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
 * (windowRuns), so the bake draws them over the wall; the bake draws the
 * furniture (furnitureRuns) after them, over the floor and walls: the
 * garden's buildings cover the ring where the plan has no fence. A room with
 * a `face` (the shed, the house rooms, the greenhouse) draws its ring as the
 * face and caps (faceRuns); the gardens draw theirs as bands of whole tiles
 * (bandRuns).
 */
export function wallRuns(room: Room): WallRun[] {
  const style = ROOM_STYLES[room.key];
  return [
    ...(style.face ? faceRuns(room, style.face, style) : bandRuns(room, style)),
    ...windowRuns(room),
  ];
}

/**
 * The ring as 32 px tiles: the top and bottom rows across the bounds, then the
 * left and right columns between them (runsOver: a sheet with variants
 * scatters them tile by tile). The garden's rows are `spr_fence`, its columns `spr_fence_v`, and,
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
 * theirs); the sorted pieces are sprites (furnitureSprites). The bake draws
 * the `flat` pieces' runs (`layer` 'flat') under the cast shadows and the
 * rest ('standing') over them.
 */
export function furnitureRuns(room: Room, layer?: 'flat' | 'standing'): WallRun[] {
  return room.furniture
    .filter((f) => !f.sorted && (layer === undefined || (layer === 'flat') === (f.flat ?? false)))
    .flatMap(({ sheet, x, y, w, h }) => runsOver(sheet, { x, y, w, h }));
}

/**
 * Each of the room's windows as a run of its style's window sheet on the back
 * wall's face, its top `top` above the floor line and its sheet's height
 * tall: the shed's `spr_shed_window`, the lounge's `spr_lounge_window`, the
 * study's `spr_study_window`; none where the style has no window.
 */
export function windowRuns(room: Room): WallRun[] {
  const style = ROOM_STYLES[room.key].window;
  if (!style) return [];
  const { sheet, top } = style;
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
 * (the Inked doors stand on their rects' bottom edges, a side-on door in a
 * W or E wall against its band's inner edge, on the cap), else
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
    if (prop.wall === 'W' || prop.wall === 'E') {
      // A side-on door's frame narrower than its band stands on the band's inner edge, where the
      // wall's cap is (roomArt's faceRuns), not on the band's centre: the room is east of a W wall.
      const inset = (prop.w - door.sheet.frameWidth * door.scale) / 2;
      return { ...door, x: x + (prop.wall === 'W' ? inset : -inset) };
    }
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

/** obj_pedestal Draw_0: the label's top, below the pedestal's centre, and an empty pedestal's label. */
export const PEDESTAL_LABEL_DY = fromPrototype(30);
export const PEDESTAL_EMPTY_LABEL = '(empty)';

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

/** A point in logical px. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A cast shadow on the floor: a polygon in logical px, its points in order round it. */
export type ShadowPolygon = readonly Point[];

/**
 * Every cast shadow's wash: `WASHES.shadow` at `STYLE.shadowAlpha`, laid on
 * the shadows' non-overlapping pieces (washPieces), so where two shadows
 * overlap the floor is washed once, not twice.
 */
export const CAST_SHADOW_WASH: Wash = { colour: PALETTE.shadow, alpha: SHADOW_ALPHA };

/** Something that casts: its footprint on the floor and how tall it stands, logical px. */
export interface Caster {
  readonly footprint: Rect;
  readonly height: number;
}

/**
 * The shadows the room's walls, its furniture and its props cast in the one
 * light (lighting.ts), each clipped to the floor (castShadow): the ring's
 * four walls standing the style's `wallHeight` on their bands, every piece
 * of furniture that `stands`, sorted or baked, and each prop drawn standing
 * on its footprint (the shed's workbench, planting table and kiosk). All
 * static, so the bake lays them once, after the floor, the walls' runs and
 * the `flat` furniture and before the standing furniture, which covers its
 * own shadow under it. Only a wall whose shadow falls into the room shows:
 * with the light in the upper left, the north and west walls'.
 */
export function castShadows(room: Room): ShadowPolygon[] {
  const { row, column } = ROOM_STYLES[room.key].wallHeight;
  const heights = [row, row, column, column];
  const walls = ringWalls(room.bounds).map((footprint, i) => ({
    footprint,
    height: heights[i] ?? 0,
  }));
  const props = room.props.flatMap((p) => propCaster(p) ?? []);
  return [
    ...[...walls, ...props].flatMap((c) => castShadow(room, c)),
    ...pieceShadows(room, room.furniture),
  ];
}

/**
 * The shadows of `furniture` in `room` (castShadows' for its pieces): the
 * room's own in the bake, and the pieces the player has placed, which come
 * and go, on the live shadow layer.
 */
export function pieceShadows(room: Room, furniture: readonly Furniture[]): ShadowPolygon[] {
  return furniture.flatMap((f) => {
    const caster = furnitureCaster(f);
    return caster ? castShadow(room, caster) : [];
  });
}

/** A piece that `stands`, on its rect's bottom `foot` px (all of it unless given). */
export function furnitureCaster({ x, y, w, h, stands }: Furniture): Caster | undefined {
  if (!stands) return undefined;
  const foot = stands.foot ?? h;
  return { footprint: { x, y: y + h - foot, w, h: foot }, height: stands.height };
}

/**
 * A prop drawn standing on its footprint (an Inked sprite at originY 1 on
 * its rect's bottom edge; not a door, which is in its wall, nor a source
 * plant, which keeps obj_source_plant's drop shadow, propShadow): it stands
 * its drawn height less its footprint's depth, across its sprite's width.
 */
export function propCaster(prop: Prop): Caster | undefined {
  if (prop.wall || prop.speciesKey) return undefined;
  const sprite = propSprite(prop);
  if (sprite?.originY !== 1) return undefined;
  const w = sprite.sheet.frameWidth * sprite.scale;
  const height = sprite.sheet.frameHeight * sprite.scale - prop.h;
  return { footprint: { x: sprite.x - w / 2, y: sprite.y - prop.h, w, h: prop.h }, height };
}

/**
 * A caster's shadow: its footprint swept along the light's offset for its
 * height (the convex hull of the footprint and the footprint moved by
 * castOffset), clipped to the room's floor inside its walls (insideWalls: no
 * shadow lands on a wall's band, the surround or the road); none if the
 * caster has no height or nothing of the shadow is left.
 */
export function castShadow(room: Room, { footprint, height }: Caster): ShadowPolygon[] {
  if (height <= 0) return [];
  const { x, y, w, h } = footprint;
  const offset = castOffset(height);
  const corners = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
  const swept = convexHull([
    ...corners,
    ...corners.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y })),
  ]);
  const clipped = clipToRect(swept, insideWalls(room));
  return area(clipped) > SLIVER ? [clipped] : [];
}

/** A polygon's area with its sign, the shoelace formula: the sign says which way round its points run. */
function signedArea(polygon: readonly Point[]): number {
  const twice = polygon.reduce((sum, a, i) => {
    const b = polygon[(i + 1) % polygon.length] ?? a;
    return sum + a.x * b.y - b.x * a.y;
  }, 0);
  return twice / 2;
}

/** A polygon's area; 0 for one with no inside, as a shadow clipped to an edge of the floor. */
function area(polygon: readonly Point[]): number {
  return Math.abs(signedArea(polygon));
}

/** The convex hull of the points (Andrew's monotone chain), without collinear points. */
export function convexHull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point): number =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: readonly Point[]): Point[] => {
    const chain: Point[] = [];
    for (const p of list) {
      for (;;) {
        const a = chain.at(-2);
        const b = chain.at(-1);
        if (!a || !b || cross(a, b, p) > 0) break;
        chain.pop();
      }
      chain.push(p);
    }
    chain.pop();
    return chain;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/** The points p with a * p.x + b * p.y + c >= 0. */
interface HalfPlane {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

/** Below this area, logical px squared, a piece of shadow is a sliver from rounding, not a shadow. */
const SLIVER = 1e-6;

/** The polygon clipped to the rect (Sutherland–Hodgman, one edge of the rect at a time); empty if none of it lies inside. */
export function clipToRect(polygon: readonly Point[], rect: Rect): Point[] {
  const sides: readonly HalfPlane[] = [
    { a: 1, b: 0, c: -rect.x },
    { a: -1, b: 0, c: rect.x + rect.w },
    { a: 0, b: 1, c: -rect.y },
    { a: 0, b: -1, c: rect.y + rect.h },
  ];
  return sides.reduce<Point[]>((out, side) => clipToHalfPlane(out, side), [...polygon]);
}

/** The part of the polygon in the half-plane: one step of Sutherland–Hodgman. */
function clipToHalfPlane(polygon: readonly Point[], { a, b, c }: HalfPlane): Point[] {
  const side = (p: Point): number => a * p.x + b * p.y + c;
  const out: Point[] = [];
  polygon.forEach((q, i) => {
    const p = polygon.at(i - 1) ?? q;
    const [sp, sq] = [side(p), side(q)];
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq);
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
    if (sq >= 0) out.push(q);
  });
  // A point on the line is both kept and a crossing: keep it once.
  return out.filter((p, i) => {
    const prev = out.at(i - 1);
    return out.length === 1 || !prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 1e-9;
  });
}

/** A convex polygon's edges as the half-planes it lies in, whichever way round its points run. */
function sidesOf(polygon: readonly Point[]): HalfPlane[] {
  const turn = Math.sign(signedArea(polygon));
  return polygon.map((p, i) => {
    const q = polygon[(i + 1) % polygon.length] ?? p;
    const [dx, dy] = [q.x - p.x, q.y - p.y];
    return { a: -dy * turn, b: dx * turn, c: (dy * p.x - dx * p.y) * turn };
  });
}

/** The convex polygon less the convex polygon `hole`, as convex pieces that do not overlap. */
export function subtractConvex(polygon: readonly Point[], hole: readonly Point[]): Point[][] {
  const pieces: Point[][] = [];
  let rest: Point[] = [...polygon];
  for (const side of sidesOf(hole)) {
    const outside = clipToHalfPlane(rest, { a: -side.a, b: -side.b, c: -side.c });
    if (area(outside) > SLIVER) pieces.push(outside);
    rest = clipToHalfPlane(rest, side);
    if (area(rest) <= SLIVER) break;
  }
  return pieces;
}

/**
 * The convex polygons' union as convex pieces that do not overlap, less what
 * `washed` already covers: so a wash laid on each piece at one alpha lands
 * once on every point the shadows cover, never twice where two meet. The
 * bake's shadows are washed on their own; the live layer's, the placed
 * pieces', less the bake's.
 */
export function washPieces(
  polygons: readonly ShadowPolygon[],
  washed: readonly ShadowPolygon[] = [],
): ShadowPolygon[] {
  const covered = [...washed];
  return polygons.flatMap((polygon) => {
    const pieces = covered.reduce<Point[][]>(
      (parts, hole) => parts.flatMap((part) => subtractConvex(part, hole)),
      [[...polygon]],
    );
    covered.push(polygon);
    return pieces;
  });
}
