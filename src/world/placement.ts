/**
 * The furniture the player lays out (pedestals, floor shelves) as pure data
 * and the rule for putting it down and picking it up. A placed item's spots
 * are display spots like the rooms' own: a tree on one has location
 * `displayed:placed_<id>` (`placed_<id>_<n>` for a shelf's further spots) and
 * earns display revenue like any displayed tree. Pure; no Phaser.
 */

import { inventoryAdd, inventoryRemove } from '../sim/inventory';
import { DISPLAYED_PREFIX, treeOnPedestal } from '../sim/tree';
import type { GameState, PlaceableKind, PlacedItem } from '../sim/types';
import { SHEETS, type Sheet } from './assets';
import { TILE } from './roomArt';
import { insideWalls, type Furniture, type Prop, type Rect, type Room } from './shedRoom';

/** Each kind's label, footprint in logical px and display spots, side by side along its width. */
export const PLACEABLES: Readonly<
  Record<
    PlaceableKind,
    { readonly label: string; readonly w: number; readonly h: number; readonly spots: number }
  >
> = {
  pedestal: { label: 'Pedestal', w: 16, h: 16, spots: 1 },
  floor_shelf: { label: 'Floor shelf', w: 32, h: 16, spots: 2 },
};

/** Each kind's sprite, its frame the footprint at half scale. */
export const PLACEABLE_SHEETS: Readonly<Record<PlaceableKind, Sheet>> = {
  pedestal: SHEETS.pedestal,
  floor_shelf: SHEETS.floorShelf,
};

/** A placed spot's prompt: the pedestal flow (Place while carrying, the inspector with a tree on it)... */
export const DISPLAY_PROMPT = 'Display';
/** ...or, empty-handed at an empty spot, picking the item back up. */
export const PICK_UP_PROMPT = 'Pick up';

/** The rooms furniture can be put down in. */
export const PLACEABLE_ROOMS: readonly string[] = ['greenhouse'];

/** Why a placement is refused, in the order `placementCheck` tests. */
export type PlacementRefusal = 'not here' | 'off the floor' | 'in the way' | 'too close';

/** A placed item's display spot: its key (as in `displayed:<key>`) and its tile's rect, top-left. */
export interface PlacedSpot extends Rect {
  readonly key: string;
}

/** (x, y) floored to the 16 px grid. */
export function snapToGrid(x: number, y: number): { x: number; y: number } {
  return { x: Math.floor(x / TILE) * TILE, y: Math.floor(y / TILE) * TILE };
}

/** `kind`'s footprint with its top-left at (x, y). */
export function footprint(kind: PlaceableKind, x: number, y: number): Rect {
  const { w, h } = PLACEABLES[kind];
  return { x, y, w, h };
}

/** The spot key of item `id`'s spot `n` (from 1): `placed_<id>`, then `placed_<id>_<n>`. */
function spotKey(id: number, n: number): string {
  return n === 1 ? `placed_${String(id)}` : `placed_${String(id)}_${String(n)}`;
}

/** `item`'s display spots, left to right, each its own 16x16 tile of the footprint (centre = interact origin). */
export function placedSpots(item: PlacedItem): PlacedSpot[] {
  const { spots, h } = PLACEABLES[item.kind];
  return Array.from({ length: spots }, (_, i) => ({
    key: spotKey(item.id, i + 1),
    x: item.x + i * TILE,
    y: item.y,
    w: TILE,
    h,
  }));
}

function placedIn(state: GameState, room: Room): PlacedItem[] {
  return state.placed.filter((p) => p.room === room.key);
}

/**
 * The display spots of the furniture placed in `room` as props, centred on
 * their tiles: `Display` (the pedestal flow), or `Pick up` at an empty spot
 * while no tree is carried.
 */
export function placedProps(state: GameState, room: Room, carrying: boolean): Prop[] {
  return placedIn(state, room).flatMap((item) =>
    placedSpots(item).map((s): Prop => {
      const empty = treeOnPedestal(state, s.key) === undefined;
      return {
        key: s.key,
        label: PLACEABLES[item.kind].label,
        prompt: empty && !carrying ? PICK_UP_PROMPT : DISPLAY_PROMPT,
        x: s.x + s.w / 2,
        y: s.y + s.h / 2,
        w: s.w,
        h: s.h,
        pedestalKey: s.key,
        placedId: item.id,
      };
    }),
  );
}

/** The furniture placed in `room` as sorted, walk-through pieces over their footprints (roomArt's `furnitureSprites`). */
export function placedFurniture(state: GameState, room: Room): Furniture[] {
  return placedIn(state, room).map((item) => ({
    ...footprint(item.kind, item.x, item.y),
    sheet: PLACEABLE_SHEETS[item.kind],
    solid: false,
    sorted: true,
  }));
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function inside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

/**
 * Whether `kind` can go down with its top-left at (x, y) in `room`, or the
 * first refusal: a room that takes no furniture, a footprint off the floor
 * inside the wall band, one over a wall, prop, solid furniture or another
 * placed item, or one over the player's own position.
 */
export function placementCheck(
  room: Room,
  state: GameState,
  kind: PlaceableKind,
  x: number,
  y: number,
  player: { x: number; y: number },
): 'ok' | PlacementRefusal {
  if (!PLACEABLE_ROOMS.includes(room.key)) return 'not here';
  const rect = footprint(kind, x, y);
  if (!inside(rect, insideWalls(room))) return 'off the floor';
  const blockers: Rect[] = [
    ...room.walls,
    ...room.props.map((p) => ({ x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h })),
    ...room.furniture.filter((f) => f.solid),
    ...placedIn(state, room).map((p) => footprint(p.kind, p.x, p.y)),
  ];
  if (blockers.some((b) => overlaps(rect, b))) return 'in the way';
  const covers =
    player.x >= rect.x &&
    player.x < rect.x + rect.w &&
    player.y >= rect.y &&
    player.y < rect.y + rect.h;
  return covers ? 'too close' : 'ok';
}

/**
 * Puts one `kind` from the inventory down at (x, y) in `room`. The placement
 * check comes first, so a refusal says what is wrong with the spot even with
 * none in hand; then `'none left'` when the inventory has none.
 */
export function placeItem(
  state: GameState,
  room: Room,
  kind: PlaceableKind,
  x: number,
  y: number,
  player: { x: number; y: number },
): PlacedItem | PlacementRefusal | 'none left' {
  const check = placementCheck(room, state, kind, x, y, player);
  if (check !== 'ok') return check;
  if (!inventoryRemove(state.inventory, kind)) return 'none left';
  const item: PlacedItem = { id: state.nextPlacedId++, kind, room: room.key, x, y };
  state.placed.push(item);
  return item;
}

/** Picks placed item `id` back into the inventory; refused while a tree is displayed on any of its spots. */
export function pickUpItem(state: GameState, id: number): 'ok' | 'a tree is on it' | 'not found' {
  const item = state.placed.find((p) => p.id === id);
  if (item === undefined) return 'not found';
  const spots = new Set(placedSpots(item).map((s) => DISPLAYED_PREFIX + s.key));
  if (state.trees.some((t) => spots.has(t.location))) return 'a tree is on it';
  state.placed = state.placed.filter((p) => p !== item);
  inventoryAdd(state.inventory, item.kind);
  return 'ok';
}
