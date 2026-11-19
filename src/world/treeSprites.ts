/**
 * Where the room draws its trees, as pure data: obj_tree_sprite on the floor
 * grid of the controller's Room Start (obj_game_controller/Other_4.gml lines
 * 48-63) and the tree on each display spot (obj_pedestal, now on furniture). Moving a tree
 * is changing its `location` (src/sim/tree.ts); this only reads it.
 */

import { getSpecies } from '../sim/species';
import { treeOnPedestal, treesInRoom } from '../sim/tree';
import type { BonsaiTree, GameState } from '../sim/types';
import type { Interactable } from './interactables';
import { PEDESTAL_EMPTY_LABEL, PEDESTAL_LABEL_DY } from './roomArt';
import { SHED_ROOM, fromPrototype, insideWalls, type Prop, type Room } from './shedRoom';

/**
 * First floor spot, prototype (340, 320); columns 64 and rows 80 prototype px
 * apart, 5 to a row. Other_4 kept adding rows, but its third, at 480, is
 * below the shed's bottom wall (SHED_Y1 416), where a tree is drawn in the
 * dark margin out of the player's reach. Here the grid has the two rows that
 * fit inside the walls and wraps: the eleventh floor tree takes the first spot
 * again, drawn behind the tree already there.
 */
export const FLOOR_GRID = {
  x: fromPrototype(340),
  y: fromPrototype(320),
  dx: fromPrototype(64),
  dy: fromPrototype(80),
  perRow: 5,
  rows: 2,
} as const;

/** Each lap round the grid draws this much further back, so the first tree on a spot is in front. */
export const FLOOR_LAP_DEPTH = 0.01;

/**
 * The grid's rows that lie on the room's floor: both in every room but the
 * greenhouse, whose floor (y 80..192) holds only the first.
 */
export function floorRows(room: Room): number[] {
  const floor = insideWalls(room);
  return Array.from({ length: FLOOR_GRID.rows }, (_, r) => FLOOR_GRID.y + r * FLOOR_GRID.dy).filter(
    (y) => y > floor.y && y <= floor.y + floor.h,
  );
}

/**
 * The grid's columns that lie on the room's floor: all five in every room but
 * the hallway, whose floor (x 192..288) holds the middle three.
 */
export function floorColumns(room: Room): number[] {
  const floor = insideWalls(room);
  return Array.from(
    { length: FLOOR_GRID.perRow },
    (_, c) => FLOOR_GRID.x + c * FLOOR_GRID.dx,
  ).filter((x) => x > floor.x && x < floor.x + floor.w);
}

/** The i-th floor tree's spot and draw depth in the room, wrapping round the grid's spots on its floor. */
export function floorSpot(
  i: number,
  room: Room = SHED_ROOM,
): { x: number; y: number; depth: number } {
  const rows = floorRows(room);
  const columns = floorColumns(room);
  const perRow = columns.length;
  const spot = i % (perRow * rows.length);
  const lap = Math.floor(i / (perRow * rows.length));
  const sy = rows[Math.floor(spot / perRow)] ?? FLOOR_GRID.y;
  const sx = columns[spot % perRow] ?? FLOOR_GRID.x;
  return { x: sx, y: sy, depth: sy - lap * FLOOR_LAP_DEPTH };
}

/**
 * Sprite height per cm of trunk: the prototype drew a fixed 48 px sprite, 24
 * logical px, for the 25 cm starter, so 25 cm is the anchor.
 */
export const SPRITE_PX_PER_CM = fromPrototype(48) / 25;
export const SPRITE_MIN_PX = 12;
export const SPRITE_MAX_PX = 48;

/** obj_tree_sprite/Create_0.gml line 6. */
export const TREE_PROMPT = 'Inspect';

export interface TreeSprite {
  readonly tree: BonsaiTree;
  readonly label: string;
  /** Bottom centre of the pot, logical px; a floor tree's interact origin. */
  readonly x: number;
  readonly y: number;
  /** Height of the whole sprite, pot to canopy top. */
  readonly size: number;
  /** Draw depth against the props and the player (their bottom edges). */
  readonly depth: number;
  /** The pedestal it is displayed on, or undefined on the floor. */
  readonly pedestalKey: string | undefined;
}

/** A floor tree as an interactable: `tree:<id>`, prompt `Inspect`. */
export interface TreeTarget extends Interactable {
  readonly tree: BonsaiTree;
}

/** The name, or the species' display name when it has none (obj_pedestal Draw_0, obj_ui_pedestal). */
export function treeLabel(tree: BonsaiTree): string {
  return tree.name === '' ? getSpecies(tree.speciesKey).displayName : tree.name;
}

export function spriteSize(heightCm: number): number {
  return Math.min(SPRITE_MAX_PX, Math.max(SPRITE_MIN_PX, heightCm * SPRITE_PX_PER_CM));
}

/** Every tree on the room's floor (grid spot i for the i-th) or on one of its pedestals. */
export function treeSprites(state: GameState, room: Room): TreeSprite[] {
  const floor = treesInRoom(state, room.key).map((tree, i): TreeSprite => ({
    tree,
    label: treeLabel(tree),
    ...floorSpot(i, room),
    size: spriteSize(tree.trunk.heightCm),
    pedestalKey: undefined,
  }));
  const displayed = room.props.flatMap((p): TreeSprite[] => {
    const tree = p.pedestalKey === undefined ? undefined : treeOnPedestal(state, p.pedestalKey);
    if (!tree) return [];
    // Stands on the spot's top edge, the top of the furniture it is on (displaySpot), drawn in front of the spot.
    return [
      {
        tree,
        label: treeLabel(tree),
        x: p.x,
        y: p.y - p.h / 2,
        size: spriteSize(tree.trunk.heightCm),
        depth: p.y + p.h / 2 + 0.5,
        pedestalKey: p.pedestalKey,
      },
    ];
  });
  return [...floor, ...displayed];
}

/**
 * The depth of a display label: above every sorted world depth (a bottom edge
 * in the room, or the player's feet, never past a few hundred px), so a label
 * reads over the player standing in front of its furniture; under the weather.
 */
export const DISPLAY_LABEL_DEPTH = 8_000;

/** Between the names of the trees on one piece of furniture. */
export const DISPLAY_LABEL_JOIN = ' · ';

/** One piece of display furniture's label (obj_pedestal Draw_0): top centre, logical px. */
export interface DisplayLabel {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  /** No tree on any of the piece's spots: `(empty)`, in the softer ink. */
  readonly empty: boolean;
  readonly depth: number;
}

/**
 * One label per piece of display furniture in `room`: a placed item's spots
 * (one per `placedId`) share one, a built-in spot has its own. It is centred
 * under the piece's spots, `PEDESTAL_LABEL_DY` below their centre, and reads
 * the names of the trees on them left to right, joined, or `(empty)` when
 * none holds a tree.
 */
export function displayLabels(state: GameState, room: Room): DisplayLabel[] {
  const pieces = new Map<string, Prop[]>();
  for (const p of room.props) {
    if (p.pedestalKey === undefined) continue;
    const piece = p.placedId === undefined ? `spot:${p.key}` : `placed:${String(p.placedId)}`;
    pieces.set(piece, [...(pieces.get(piece) ?? []), p]);
  }
  return [...pieces.values()].map((spots) => {
    const names = [...spots]
      .sort((a, b) => a.x - b.x)
      .flatMap((p) => {
        const tree = p.pedestalKey === undefined ? undefined : treeOnPedestal(state, p.pedestalKey);
        return tree ? [treeLabel(tree)] : [];
      });
    const left = Math.min(...spots.map((p) => p.x - p.w / 2));
    const right = Math.max(...spots.map((p) => p.x + p.w / 2));
    const centreY = Math.min(...spots.map((p) => p.y));
    return {
      x: (left + right) / 2,
      y: centreY + PEDESTAL_LABEL_DY,
      text: names.length === 0 ? PEDESTAL_EMPTY_LABEL : names.join(DISPLAY_LABEL_JOIN),
      empty: names.length === 0,
      depth: DISPLAY_LABEL_DEPTH,
    };
  });
}

/** The floor trees as interactables; a displayed tree is reached through its pedestal. */
export function treeTargets(sprites: readonly TreeSprite[]): TreeTarget[] {
  return sprites
    .filter((s) => s.pedestalKey === undefined)
    .map((s) => ({
      key: `tree:${String(s.tree.id)}`,
      prompt: TREE_PROMPT,
      x: s.x,
      y: s.y,
      tree: s.tree,
    }));
}
