/**
 * The 3D world's plan, derived from the 2D room data (src/world/*Room.ts)
 * and never authored beside it: `roomPlan3d` turns a `Room` into axis-aligned
 * boxes and anchor points in metres. Pure data; no rendering, so it is fully
 * unit-testable. Movement and collision stay on the 2D plan: the plan's solid
 * footprints are the room's collision rects (walls and solid furniture), cut
 * only where a door or window opens a wall above the floor.
 *
 * The frame is the room's, in metres: x east, y south (room px / 32 each), z
 * up from the floor, the floor's top at z 0.
 */

import { SHEETS, sheetPxPerLogical, type Sheet } from '../world/assets';
import type { PALETTE } from '../world/palette';
import { BACK_WALL_FACE, FENCE_HEIGHT, LOW_FENCE_HEIGHT, ROOM_STYLES } from '../world/roomArt';
import {
  WALL_BAND,
  furnitureWalls,
  ringWalls,
  type Furniture,
  type Prop,
  type Rect,
  type Room,
  type RoomKey,
  type Wall,
} from '../world/shedRoom';
import { MODELLED_SHEETS, type FurnitureKind } from './furnitureModels';

/** An Inked wash: a key of `PALETTE`, each mirroring art/inked/style.mjs's WASHES. */
export type WashKey = keyof typeof PALETTE;

/**
 * Metres of a length in room px: every room draws 32 px to the metre (the
 * front garden's METRE; a 16 px tile is 0.5 m). The only place the scale
 * appears.
 */
export function metres(px: number): number {
  return px / 32;
}

/** Room px of a length in metres: the inverse of `metres`. */
export function pixels(m: number): number {
  return m * 32;
}

/**
 * Metres of a height in px: heights are the scale rule's 21.33 px to the
 * metre (`Furniture.stands`, roomArt's FENCE_HEIGHT), not the plan's 32.
 */
export function heightMetres(px: number): number {
  return (px * 3) / 64;
}

/** The back wall's height, the scale rule's 2.4 m (roomArt's BACK_WALL_FACE, 48 px). */
export const WALL_HEIGHT = 2.4;
/** The back garden's fence, 0.75 m (roomArt's FENCE_HEIGHT, 16 px). */
export const FENCE_HEIGHT_M = 0.75;
/** The front garden's low fence, 0.5 m (roomArt's LOW_FENCE_HEIGHT, 11 px). */
export const LOW_FENCE_HEIGHT_M = 0.5;
/** The floor slab's depth below z 0. */
export const FLOOR_THICKNESS = 0.1;
/** The thickness of a `flat` piece lying on the floor (a runner, the drive, the beds). */
export const FLAT_THICKNESS = 0.01;
/** A door is 1 m wide at least (the shed's door is 32 px; a prop's own extent is its interact box) and 2 m high. */
export const DOOR_WIDTH = 1;
export const DOOR_HEIGHT = 2;
/** A window's sill and head above the floor: roomArt's 20 px (0.94 m) sill and 44 px (2.06 m) top, to the nearest 0.1 m. */
export const WINDOW_SILL = 0.9;
export const WINDOW_HEAD = 2;
/** How far a window's frame or the roller door stands proud of the building's face, on each side of it, metres. */
export const FACE_RELIEF = 0.04;
/** Where a prop's anchor point sits above the floor, about where a hand reaches. */
export const ANCHOR_HEIGHT = 1;

/** Wall heights by the px `ROOM_STYLES` give them, in metres; a height that is none of these converts by `heightMetres`. */
const STYLE_HEIGHTS = new Map<number, number>([
  [BACK_WALL_FACE, WALL_HEIGHT],
  [FENCE_HEIGHT, FENCE_HEIGHT_M],
  [LOW_FENCE_HEIGHT, LOW_FENCE_HEIGHT_M],
]);

/** What each room's floor and ring of walls are washed with; the buildings in a garden are rendered. */
const SURFACES: Record<RoomKey, { readonly floor: WashKey; readonly wall: WashKey }> = {
  shed: { floor: 'floor', wall: 'wall' },
  garden: { floor: 'outside', wall: 'wood' },
  frontGarden: { floor: 'outside', wall: 'wood' },
  lounge: { floor: 'carpet', wall: 'wallpaper' },
  hallway: { floor: 'floor', wall: 'wall' },
  study: { floor: 'parquet', wall: 'studyPaper' },
  greenhouse: { floor: 'stone', wall: 'paint' },
};

/** A gable roof's pitch, 30 degrees, and the most it may rise above its eaves, metres: a deep footprint's ridge stops here. */
export const ROOF_PITCH = Math.PI / 6;
export const ROOF_RISE_MAX = 1.2;
/** How far a gable roof overhangs its walls, metres. */
export const ROOF_OVERHANG = 0.15;
/** The low edge of the front garden's roof strip, metres: the back of the house's roof, seen from above, falls from its eaves to here. */
export const ROOF_STRIP_LOW = 0.4;

/** The sheets of a building's roof, which `roomPlan3d` draws as a `Roof`. */
const ROOF_SHEETS: ReadonlySet<string> = new Set([
  'spr_house_roof',
  'spr_shed_roof',
  'spr_greenhouse_roof',
]);

/** The wash of a piece of furniture by its sheet's key; any other is wood. */
const FURNITURE_WASHES: Readonly<Record<string, WashKey>> = {
  spr_road: 'asphalt',
  spr_drive: 'stone',
  spr_path: 'stone',
  spr_bed: 'soil',
  spr_runner: 'runner',
  spr_floor_kitchen: 'stone',
  spr_house_face: 'render',
  spr_house_cap_v: 'render',
  spr_house_roof: 'tile',
  spr_shed_roof: 'tile',
  spr_shed_face: 'render',
  spr_greenhouse_face: 'paint',
  spr_greenhouse_roof: 'paint',
  spr_greenhouse_cap: 'paint',
  spr_greenhouse_cap_v: 'paint',
  spr_shed_rug: 'tile',
};

/** The sheet of the lounge's hallway mass: a papered wall, so it wears its room's wall wash and dressing, not furniture's. */
const PAPER_SHEET = 'spr_paper';

/** Whether `f` is a mass drawn as the paper, a wall of the room that is solid furniture in its plan. */
export const isPapered = (f: Furniture): boolean => f.sheet.key === PAPER_SHEET;

/** The sheet of the windows set in a building's face. */
export const WINDOW_SHEET = 'spr_house_window';
/** The garage's door, which stands against its face. */
export const ROLLER_DOOR_SHEET = 'spr_roller_door';

/** A window or the roller door: drawn as a detail hung from the face it is on (details.ts), not as a box. */
export const isFaceFixture = (f: Furniture): boolean =>
  f.sheet.key === WINDOW_SHEET || f.sheet.key === ROLLER_DOOR_SHEET;

/**
 * A wall's cap (`spr_*_cap`, `spr_*_cap_v`) is the 0.25 m top of a wall seen
 * edge-on in 2D: the wall it caps is already a box of the plan, so a cap is
 * drawn as no box of its own.
 */
const isCap = (f: Furniture): boolean => /_cap(_v)?$/.test(f.sheet.key);

/** Whether the plan draws `f` as a box or model of its own: not a cap, and not a fixture of a face. */
export const isBoxed = (f: Furniture): boolean => !isCap(f) && !isFaceFixture(f);

/** The shed's working furniture, props that stand as a model over their footprint, as tall as their 2D frame. */
const PROP_MODELS: Readonly<
  Record<string, { readonly sheet: Sheet; readonly model: FurnitureKind }>
> = {
  workbench: { sheet: SHEETS.workbench, model: 'workbench' },
  planting_table: { sheet: SHEETS.plantingTable, model: 'planting_table' },
  shop_kiosk: { sheet: SHEETS.shopKiosk, model: 'kiosk' },
};

/** The side of the room a wall bounds, or `interior` for a wall against none of its edges. */
export type WallSide = Wall | 'interior';

/** A box in metres. */
export interface Box {
  readonly name: string;
  readonly wash: WashKey;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly z0: number;
  readonly z1: number;
  /** Stops the player in the 2D plan; the plan's solid boxes cover exactly that collision. */
  readonly solid: boolean;
  /** A piece of furniture drawn as this model (furnitureModels.ts) in place of the box. */
  readonly model?: FurnitureKind;
}

/** A piece of wall, which side of the room it bounds so a camera can cut away those that face it. */
export interface WallBox extends Box {
  readonly side: WallSide;
}

/** A hole in a wall: the span a door or window clears, over its full depth. */
export interface Opening {
  readonly name: string;
  readonly kind: 'door' | 'window';
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly z0: number;
  readonly z1: number;
}

/**
 * A roof over a building, drawn as a prism in place of a slab. `x0`..`y1` is
 * its outer footprint, eaves overhang included. A gable roof rises from `low`
 * (the eaves, on both long sides) to `high` (the ridge, which runs along
 * `axis`); a slope falls from `high` at the `high` edge to `low` at the
 * opposite one.
 */
export interface Roof {
  readonly name: string;
  readonly wash: WashKey;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly low: number;
  readonly high: number;
  readonly form:
    | { readonly kind: 'gable'; readonly axis: 'x' | 'y' }
    | { readonly kind: 'slope'; readonly high: Wall };
}

/** A prop's place: no geometry, a point to hang a label or an interaction on. */
export interface Anchor {
  readonly key: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** The prop's footprint, east-west and north-south, metres: what a tap on it can hit. */
  readonly width: number;
  readonly depth: number;
  /** Doors only: the wall the door sits in. */
  readonly wall?: Wall;
}

export interface RoomPlan3d {
  readonly key: RoomKey;
  /** The slab under `bounds`, and any flat ground drawn beyond it (the front garden's road). */
  readonly floor: readonly Box[];
  readonly walls: readonly WallBox[];
  readonly furniture: readonly Box[];
  /** The roofs over the room's buildings: on top of the furniture boxes at their eaves, or in place of a box that would hide the room. */
  readonly roofs: readonly Roof[];
  readonly openings: readonly Opening[];
  readonly anchors: readonly Anchor[];
  readonly playerStart: { readonly x: number; readonly y: number };
}

/** A rect in metres. */
interface Footprint {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

/** A span along a wall, cleared from `z0` to `z1`. */
interface Cut {
  readonly a0: number;
  readonly a1: number;
  readonly z0: number;
  readonly z1: number;
  readonly key: string;
}

const EPSILON = 1e-6;
const near = (a: number, b: number): boolean => Math.abs(a - b) < EPSILON;

function footprint(r: Rect): Footprint {
  return {
    x0: metres(r.x),
    x1: metres(r.x + r.w),
    y0: metres(r.y),
    y1: metres(r.y + r.h),
  };
}

const sameRect = (a: Rect, b: Rect): boolean =>
  near(a.x, b.x) && near(a.y, b.y) && near(a.w, b.w) && near(a.h, b.h);

const contains = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** A band, a wall of the ring's depth or less, is cut by a door; a building a door stands against is not. */
const isBand = (r: Rect): boolean => Math.min(r.w, r.h) <= WALL_BAND;

/** The edge of `bounds` a wall lies against, the one along its length first; none is `interior`. */
function sideOf(r: Rect, bounds: Rect): WallSide {
  const edges: Record<Wall, boolean> = {
    N: near(r.y, bounds.y),
    S: near(r.y + r.h, bounds.y + bounds.h),
    W: near(r.x, bounds.x),
    E: near(r.x + r.w, bounds.x + bounds.w),
  };
  const order: readonly Wall[] = r.w >= r.h ? ['N', 'S', 'W', 'E'] : ['W', 'E', 'N', 'S'];
  return order.find((side) => edges[side]) ?? 'interior';
}

function box(
  name: string,
  wash: WashKey,
  f: Footprint,
  z0: number,
  z1: number,
  solid: boolean,
): Box {
  return { name, wash, ...f, z0, z1, solid };
}

/**
 * A wall's pieces, `height` tall, around the cuts along its length: full
 * pieces between them, a sill piece under a cut that starts above the floor
 * and a lintel over one that ends below the top.
 */
function cutWall(
  name: string,
  wash: WashKey,
  f: Footprint,
  side: WallSide,
  height: number,
  cuts: readonly Cut[],
): WallBox[] {
  const alongX = f.x1 - f.x0 >= f.y1 - f.y0;
  const start = alongX ? f.x0 : f.y0;
  const end = alongX ? f.x1 : f.y1;
  const piece = (pieceName: string, a0: number, a1: number, z0: number, z1: number): WallBox => ({
    ...box(
      pieceName,
      wash,
      alongX ? { ...f, x0: a0, x1: a1 } : { ...f, y0: a0, y1: a1 },
      z0,
      z1,
      true,
    ),
    side,
  });
  if (cuts.length === 0) return [piece(name, start, end, 0, height)];
  const pieces: WallBox[] = [];
  let cursor = start;
  for (const cut of [...cuts].sort((a, b) => a.a0 - b.a0)) {
    if (cut.a0 > cursor)
      pieces.push(piece(`${name}.${String(pieces.length)}`, cursor, cut.a0, 0, height));
    if (cut.z0 > 0) pieces.push(piece(`${name}.sill.${cut.key}`, cut.a0, cut.a1, 0, cut.z0));
    if (cut.z1 < height) {
      pieces.push(piece(`${name}.lintel.${cut.key}`, cut.a0, cut.a1, cut.z1, height));
    }
    cursor = cut.a1;
  }
  if (cursor < end) pieces.push(piece(`${name}.${String(pieces.length)}`, cursor, end, 0, height));
  return pieces;
}

/** How tall a wall stands: the room style's height for a ring band, a building's 2.4 m otherwise. */
function wallHeightOf(room: Room, rect: Rect): number {
  const ring = ringWalls(room.bounds).findIndex((r) => sameRect(r, rect));
  if (ring < 0) return WALL_HEIGHT;
  const { row, column } = ROOM_STYLES[room.key].wallHeight;
  const px = ring < 2 ? row : column;
  return STYLE_HEIGHTS.get(px) ?? heightMetres(px);
}

/** The opening a cut makes, over a wall's full depth. */
function openingOf(name: string, kind: Opening['kind'], f: Footprint, along: Cut): Opening {
  const alongX = f.x1 - f.x0 >= f.y1 - f.y0;
  return {
    name,
    kind,
    x0: alongX ? along.a0 : f.x0,
    x1: alongX ? along.a1 : f.x1,
    y0: alongX ? f.y0 : along.a0,
    y1: alongX ? f.y1 : along.a1,
    z0: along.z0,
    z1: along.z1,
  };
}

/** The sheets that draw a building's face: 48 px tall, standing on the bottom `WALL_BAND` of their rect. */
const FACE_SHEETS: ReadonlySet<string> = new Set([
  'spr_house_face',
  'spr_shed_face',
  'spr_greenhouse_face',
]);

/**
 * A piece of furniture's box: over its `foot` if it has one, tall as it
 * `stands`, a slab if `flat`; a building's face is `WALL_HEIGHT` tall over its
 * rect's bottom band.
 */
export function furnitureBox(f: Furniture, index: number, room: RoomKey): Box {
  const isFace = f.stands === undefined && FACE_SHEETS.has(f.sheet.key);
  const foot = isFace ? WALL_BAND : f.stands?.foot;
  const rect = foot === undefined ? f : { ...f, y: f.y + f.h - foot, h: foot };
  const name = `furniture.${String(index)}.${f.sheet.key}`;
  const wash = isPapered(f) ? SURFACES[room].wall : (FURNITURE_WASHES[f.sheet.key] ?? 'wood');
  if (f.flat === true) return box(name, wash, footprint(rect), 0, FLAT_THICKNESS, f.solid);
  if (isFace) return box(name, wash, footprint(rect), 0, WALL_HEIGHT, f.solid);
  if (f.stands === undefined) return box(name, wash, footprint(rect), 0, FLAT_THICKNESS, f.solid);
  const height = heightMetres(f.stands.height);
  const model = MODELLED_SHEETS[f.sheet.key];
  return {
    ...box(name, wash, footprint(rect), 0, height, f.solid),
    ...(model === undefined ? {} : { model }),
  };
}

/**
 * The roof over a building's `eaves` box. A gable roof (the back garden's):
 * the ridge runs along the longer axis, rises at `ROOF_PITCH` from the eaves
 * to `ROOF_RISE_MAX` at most, and the roof overhangs the walls by
 * `ROOF_OVERHANG`. A `strip` (the front garden's, which lies between the
 * camera and the room) is one slope, from the eaves at its north edge to
 * `ROOF_STRIP_LOW` at its south.
 */
export function roofOf(name: string, eaves: Box, strip: boolean): Roof {
  const { wash, x0, x1, y0, y1, z1 } = eaves;
  if (strip) {
    const form = { kind: 'slope', high: 'N' } as const;
    return { name, wash, x0, x1, y0, y1, low: ROOF_STRIP_LOW, high: z1, form };
  }
  const axis = x1 - x0 >= y1 - y0 ? 'x' : 'y';
  const outer = {
    x0: x0 - ROOF_OVERHANG,
    x1: x1 + ROOF_OVERHANG,
    y0: y0 - ROOF_OVERHANG,
    y1: y1 + ROOF_OVERHANG,
  };
  const across = axis === 'x' ? outer.y1 - outer.y0 : outer.x1 - outer.x0;
  const rise = Math.min(ROOF_RISE_MAX, (across / 2) * Math.tan(ROOF_PITCH));
  return { name, wash, ...outer, low: z1, high: z1 + rise, form: { kind: 'gable', axis } };
}

/**
 * The box of a prop that stands as a model (the shed's workbench, planting
 * table and kiosk): over the prop's footprint, as tall as its 2D frame rises
 * above it (the frame's logical px less the footprint's depth, the top face).
 * Not solid: the 2D collision of a prop is its interact box.
 */
export function propBox(prop: Prop): Box | undefined {
  const stands = PROP_MODELS[prop.key];
  if (stands === undefined) return undefined;
  const { sheet, model } = stands;
  const height = heightMetres(sheet.frameHeight / sheetPxPerLogical(sheet) - prop.h);
  const rect = { x: prop.x - prop.w / 2, y: prop.y - prop.h / 2, w: prop.w, h: prop.h };
  return { ...box(`prop.${prop.key}`, 'wood', footprint(rect), 0, height, false), model };
}

/** True if no part of `r` is inside `bounds`: ground beyond the walkable floor, as the front garden's road. */
const beyond = (r: Rect, bounds: Rect): boolean =>
  r.x + r.w <= bounds.x ||
  r.x >= bounds.x + bounds.w ||
  r.y + r.h <= bounds.y ||
  r.y >= bounds.y + bounds.h;

/**
 * The 3D plan of a room. Walls are the room's `walls` extruded; a wall that
 * is a solid piece of furniture's own rect (a hallway block, a counter, a
 * greenhouse) is that piece's box and not a wall. A door prop that sits in a
 * band of wall opens it over the door's span, `DOOR_HEIGHT` high, and a window
 * opens the top wall from `WINDOW_SILL` to `WINDOW_HEAD`. A door against a
 * building (the garden's doors into the house, shed and greenhouse) cuts
 * nothing. Doors are interacted with, not walked through: the 2D collision is
 * solid across them, so a door's opening is the part of the wall's footprint
 * the pieces leave clear.
 */
export function roomPlan3d(room: Room): RoomPlan3d {
  const { bounds, key } = room;
  const surfaces = SURFACES[key];
  const solidPieces = furnitureWalls(room.furniture);
  const walls = room.walls
    .map((rect, index) => ({ rect, index }))
    .filter(({ rect }) => !solidPieces.some((piece) => sameRect(piece, rect)));

  const cuts = new Map<number, Cut[]>();
  const openings: Opening[] = [];
  const open = (index: number, rect: Rect, kind: Opening['kind'], name: string, cut: Cut): void => {
    cuts.set(index, [...(cuts.get(index) ?? []), cut]);
    openings.push(openingOf(name, kind, footprint(rect), cut));
  };

  for (const prop of room.props) {
    if (prop.wall === undefined) continue;
    const host = walls.find(({ rect }) => isBand(rect) && contains(rect, prop.x, prop.y));
    if (host === undefined) continue;
    const alongX = host.rect.w >= host.rect.h;
    const centre = metres(alongX ? prop.x : prop.y);
    const half = Math.max(DOOR_WIDTH, metres(alongX ? prop.w : prop.h)) / 2;
    const f = footprint(host.rect);
    const cut: Cut = {
      a0: Math.max(centre - half, alongX ? f.x0 : f.y0),
      a1: Math.min(centre + half, alongX ? f.x1 : f.y1),
      z0: 0,
      z1: DOOR_HEIGHT,
      key: prop.key,
    };
    open(host.index, host.rect, 'door', prop.key, cut);
  }

  const topWall = walls.find(
    ({ rect }) => isBand(rect) && rect.w >= rect.h && near(rect.y, bounds.y),
  );
  if (topWall !== undefined) {
    const f = footprint(topWall.rect);
    room.windows.forEach((window, n) => {
      const name = `window.${String(n)}`;
      const cut: Cut = {
        a0: Math.max(metres(window.x), f.x0),
        a1: Math.min(metres(window.x + window.w), f.x1),
        z0: WINDOW_SILL,
        z1: WINDOW_HEAD,
        key: name,
      };
      open(topWall.index, topWall.rect, 'window', name, cut);
    });
  }

  const wallBoxes = walls.flatMap(({ rect, index }) => {
    const height = wallHeightOf(room, rect);
    const ring = ringWalls(bounds).some((r) => sameRect(r, rect));
    const wash = ring ? surfaces.wall : 'render';
    const wallCuts = (cuts.get(index) ?? []).map((cut) =>
      cut.z0 === 0 ? { ...cut, z1: Math.min(cut.z1, height) } : cut,
    );
    return cutWall(
      `wall.${String(index)}`,
      wash,
      footprint(rect),
      sideOf(rect, bounds),
      height,
      wallCuts,
    );
  });

  const floor = [box('floor', surfaces.floor, footprint(bounds), -FLOOR_THICKNESS, 0, false)];
  const furniture: Box[] = [];
  const roofs: Roof[] = [];
  room.furniture.forEach((piece, index) => {
    if (!isBoxed(piece)) return;
    const built = furnitureBox(piece, index, key);
    if (ROOF_SHEETS.has(piece.sheet.key)) {
      const strip = key === 'frontGarden';
      roofs.push(roofOf(`roof.${String(index)}.${piece.sheet.key}`, built, strip));
      if (strip) return;
    }
    if (piece.flat === true && beyond(piece, bounds)) {
      floor.push({ ...built, z0: -FLOOR_THICKNESS, z1: 0 });
    } else {
      furniture.push(built);
    }
  });
  furniture.push(...room.props.flatMap((prop) => propBox(prop) ?? []));
  const { rug } = ROOM_STYLES[key];
  if (rug !== undefined) {
    const name = `furniture.rug.${rug.sheet.key}`;
    furniture.push(
      box(
        name,
        FURNITURE_WASHES[rug.sheet.key] ?? 'wood',
        footprint(rug),
        0,
        FLAT_THICKNESS,
        false,
      ),
    );
  }

  return {
    key,
    floor,
    walls: wallBoxes,
    furniture,
    roofs,
    openings,
    anchors: room.props.map((prop) => ({
      key: prop.key,
      label: prop.label,
      x: metres(prop.x),
      y: metres(prop.y),
      z: ANCHOR_HEIGHT,
      width: metres(prop.w),
      depth: metres(prop.h),
      ...(prop.wall === undefined ? {} : { wall: prop.wall }),
    })),
    playerStart: { x: metres(room.playerStart.x), y: metres(room.playerStart.y) },
  };
}
