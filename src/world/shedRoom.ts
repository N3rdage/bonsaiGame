/**
 * The shed, the room a new game starts in, as pure data, and the shape every
 * room shares (the garden is in gardenRoom.ts, the lounge in loungeRoom.ts, the hallway in
 * hallwayRoom.ts, the study in studyRoom.ts).
 *
 * Every prototype coordinate and distance halves (`fromPrototype`, prototype.ts).
 *
 * Positions are ported from archive/gamemaker/rooms/rm_shed/rm_shed.yy (the
 * instance list). The shed is the prototype's inset room: the controller built
 * its `obj_wall` ring on entry (obj_game_controller Other_4) at SHED_X0..SHED_Y1
 * (scr_settings), well inside the canvas, and the dark background frames it.
 */

import type { SpeciesKey } from '../sim/types';
import { SHEETS, type Sheet } from './assets';
import { fromPrototype } from './prototype';

export { PROTOTYPE_SCALE, fromPrototype } from './prototype';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The rooms the world can show; also the `location` of a tree on that room's floor. */
export type RoomKey = 'shed' | 'garden' | 'lounge' | 'hallway' | 'study';

/** Where a door leads (obj_door's `target_room`, `target_x`, `target_y`), logical px. */
export interface DoorTarget {
  readonly room: RoomKey;
  readonly x: number;
  readonly y: number;
}

export interface Prop {
  readonly key: string;
  readonly label: string;
  /** The prototype object's `prompt` (Create_0 of obj_workbench, obj_door, ...): what E does here. */
  readonly prompt: string;
  /** Centre of the prop's footprint, logical px. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /**
   * Display spots only: the prototype's `pedestal_key` (instance creation
   * code), as in `displayed:<pedestalKey>`. A spot is on a piece of furniture
   * (`displaySpot`) and draws nothing of its own.
   */
  readonly pedestalKey?: string;
  /** Doors only: the room and spot E takes the player to. */
  readonly target?: DoorTarget;
  /** Doors only: the door's sprite when it is not the prototype's `spr_door` (the study's glazed doors and the garden's to them). */
  readonly sheet?: Sheet;
  /** Garden source plants only (obj_source_plant's `species_key`): what a cutting is of. */
  readonly speciesKey?: SpeciesKey;
}

/**
 * A window in the room's top wall (the house rooms' are new content; the
 * shed's is the prototype's): from `x` for `w` logical px along the wall
 * band, drawn over it and not collision; the wall under it still stops the
 * player.
 */
export interface RoomWindow {
  readonly x: number;
  readonly w: number;
}

/**
 * A piece of furniture (the house rooms', new content, or the shed's decor):
 * its sheet drawn from the rect's top-left, one frame the rect's size or a
 * tile repeated over it, baked into the room with the walls (roomArt's
 * `furnitureRuns`). A solid piece's rect joins the room's walls.
 */
export interface Furniture extends Rect {
  readonly sheet: Sheet;
  readonly solid: boolean;
  /** The shed's decor: a faint ground shadow under the piece's foot (roomArt's `furnitureShadows`). */
  readonly shadow?: boolean;
}

export interface Room {
  readonly key: RoomKey;
  /** The canvas the room is drawn on, logical px. */
  readonly width: number;
  readonly height: number;
  /** The outer edge of the wall ring, on the 16 px tile grid; the walls are `WALL_BAND` deep inside it. */
  readonly bounds: Rect;
  /** The windows in the top wall, left to right. */
  readonly windows: readonly RoomWindow[];
  /** The player is kept at least this far inside `bounds`. */
  readonly edgeMargin: number;
  readonly playerStart: { readonly x: number; readonly y: number };
  readonly walls: readonly Rect[];
  /** Drawn in order, after the walls and windows. */
  readonly furniture: readonly Furniture[];
  readonly props: readonly Prop[];
  /** Floor colour, from the room's background layer. */
  readonly floor: number;
}

/** Other_4's ring is one row of 32 px tiles (`_tw`): each wall is a band that deep, so the player stops at the drawn tile. */
export const WALL_BAND = fromPrototype(32);

/** A gap in the ring's left side from `top` to `bottom`, logical px. */
export interface Gap {
  readonly top: number;
  readonly bottom: number;
}

/**
 * Other_4's ring as collision bands just inside `bounds`: the top and bottom
 * rows across it and the left and right columns down it, the left one broken
 * by `leftGap` if there is one.
 */
export function ringWalls(bounds: Rect, leftGap?: Gap): Rect[] {
  const { x, y, w, h } = bounds;
  const band = WALL_BAND;
  const left = leftGap
    ? [
        { x, y, w: band, h: leftGap.top - y },
        { x, y: leftGap.bottom, w: band, h: y + h - leftGap.bottom },
      ]
    : [{ x, y, w: band, h }];
  return [
    { x, y, w, h: band },
    { x, y: y + h - band, w, h: band },
    ...left,
    { x: x + w - band, y, w: band, h },
  ];
}

/** The solid pieces' rects, which a room adds to its `ringWalls`. */
export function furnitureWalls(furniture: readonly Furniture[]): Rect[] {
  return furniture.filter((f) => f.solid).map(({ x, y, w, h }) => ({ x, y, w, h }));
}

/**
 * A display spot (`Use Pedestal`, as obj_pedestal) on a piece of furniture:
 * its rect runs across `x`..`x + w` (the whole piece by default) from `top`,
 * where the displayed tree's pot stands, down to the piece's front edge. So
 * the tree stands on the rect's top edge as it stood on a pedestal's, the
 * rect's centre is the interact origin, and the label 15 px below it falls
 * just under the piece.
 */
export function displaySpot(
  key: string,
  pedestalKey: string,
  on: Rect,
  top: number,
  x = on.x,
  w = on.w,
): Prop {
  const h = on.y + on.h - top;
  return {
    key,
    label: 'Pedestal',
    prompt: 'Use Pedestal',
    x: x + w / 2,
    y: top + h / 2,
    w,
    h,
    pedestalKey,
  };
}

/** The floor inside the ring's bands. */
export function insideWalls(room: Room): Rect {
  const { x, y, w, h } = room.bounds;
  return { x: x + WALL_BAND, y: y + WALL_BAND, w: w - 2 * WALL_BAND, h: h - 2 * WALL_BAND };
}

/** scr_settings: the top-left corners of the shed ring's corner tiles, (160, 96) and (768, 416). */
export const SHED_RING = {
  x0: fromPrototype(160),
  y0: fromPrototype(96),
  x1: fromPrototype(768),
  y1: fromPrototype(416),
} as const;

/** The shed ring's outer edge; each house room has its own. */
export const SHED_BOUNDS: Rect = {
  x: SHED_RING.x0,
  y: SHED_RING.y0,
  w: SHED_RING.x1 + WALL_BAND - SHED_RING.x0,
  h: SHED_RING.y1 + WALL_BAND - SHED_RING.y0,
};

const WIDTH = fromPrototype(960);
const HEIGHT = fromPrototype(540);

/** A prop centred on prototype (px, py), `w` x `h` logical px. */
export function prop(
  key: string,
  label: string,
  prompt: string,
  px: number,
  py: number,
  w: number,
  h: number,
): Prop {
  return { key, label, prompt, x: fromPrototype(px), y: fromPrototype(py), w, h };
}

/**
 * obj_game_controller Draw_0's decor: `sheet`'s one frame at 1x, its
 * bottom-centre origin (each sprite's `.yy`) at prototype (px, py), so the
 * rect is the frame halved, standing on that point. Not solid: the
 * prototype's decor was draw-only, with no collision, and a solid shelf
 * against the top wall would block the walk up from the left half of the
 * shed along y 66.
 */
function decor(sheet: Sheet, px: number, py: number): Furniture {
  return {
    sheet,
    x: fromPrototype(px - sheet.frameWidth / 2),
    y: fromPrototype(py - sheet.frameHeight),
    w: fromPrototype(sheet.frameWidth),
    h: fromPrototype(sheet.frameHeight),
    solid: false,
    shadow: true,
  };
}

export const SHED_ROOM: Room = {
  key: 'shed',
  width: WIDTH,
  height: HEIGHT,
  bounds: SHED_BOUNDS,
  // Draw_73's spr_window, 56 px wide, centred at prototype x 560 in the top
  // wall band: drawn as the house rooms' window, two 16 px panes centred on 280.
  windows: [{ x: 264, w: 32 }],
  // Step_0: clamp(x, 8, room_width - 8), against the room's bounds.
  edgeMargin: fromPrototype(8),
  playerStart: { x: fromPrototype(480), y: fromPrototype(270) },
  // Other_4: solid all round; the door is drawn on the bottom wall, not cut into it.
  walls: ringWalls(SHED_BOUNDS),
  // The workshop's working furniture is its props; this is Draw_0's clutter.
  furniture: [
    decor(SHEETS.shelf, 440, 174),
    decor(SHEETS.tools, 212, 352),
    decor(SHEETS.wateringCan, 706, 256),
    decor(SHEETS.potStack, 706, 388),
    decor(SHEETS.sack, 300, 384),
  ],
  props: [
    prop('workbench', 'Workbench', 'Make Pot', 250, 180, 40, 20),
    prop('planting_table', 'Planting', 'Plant Cutting', 330, 180, 32, 20),
    prop('shop_kiosk', 'Shop', 'Shop', 250, 290, 28, 24),
    // rm_shed's two pedestals (shed_main, shed_window) moved to the lounge;
    // saves before version 4 migrate their trees there (save.ts).
    // inst_52E224DC: a 32x32 door with its origin top-left at (464, 416), on the
    // bottom wall; its creation code: target_room = rm_garden_back, (100, 450).
    {
      ...prop('door', 'Door', 'To Garden', 464 + 16, 416 + 16, 16, 16),
      target: { room: 'garden', x: fromPrototype(100), y: fromPrototype(450) },
    },
    // New content (the prototype had no interiors): the lounge door, the same
    // 32 px square in the top wall, landing 26 px below it in the lounge.
    {
      ...prop('door_lounge', 'Door', 'To Lounge', 464 + 16, 96 + 16, 16, 16),
      target: { room: 'lounge', x: 240, y: 190 },
    },
  ],
  // rm_shed's background colour 4279770660 is ABGR 0xff181e24.
  floor: 0x241e18,
};

/** True if the point lies inside any wall. */
export function hitsWall(room: Room, x: number, y: number): boolean {
  return room.walls.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}
