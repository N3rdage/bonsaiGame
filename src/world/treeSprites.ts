/**
 * Where the room draws its trees, as pure data: obj_tree_sprite on the floor
 * grid of the controller's Room Start (obj_game_controller/Other_4.gml lines
 * 48-63) and the tree on each display pedestal (obj_pedestal). Moving a tree
 * is changing its `location` (src/sim/tree.ts); this only reads it.
 */

import { getSpecies } from '../sim/species';
import { treeOnPedestal, treesInRoom } from '../sim/tree';
import type { BonsaiTree, GameState } from '../sim/types';
import type { Interactable } from './interactables';
import { fromPrototype, type Room } from './shedRoom';

/** First floor spot, prototype (340, 320); columns 64 and rows 80 prototype px apart, 5 to a row. */
export const FLOOR_GRID = {
  x: fromPrototype(340),
  y: fromPrototype(320),
  dx: fromPrototype(64),
  dy: fromPrototype(80),
  perRow: 5,
} as const;

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
  const floor = treesInRoom(state, room.key).map((tree, i): TreeSprite => {
    const y = FLOOR_GRID.y + Math.floor(i / FLOOR_GRID.perRow) * FLOOR_GRID.dy;
    return {
      tree,
      label: treeLabel(tree),
      x: FLOOR_GRID.x + (i % FLOOR_GRID.perRow) * FLOOR_GRID.dx,
      y,
      size: spriteSize(tree.trunk.heightCm),
      depth: y,
      pedestalKey: undefined,
    };
  });
  const displayed = room.props.flatMap((p): TreeSprite[] => {
    const tree = p.pedestalKey === undefined ? undefined : treeOnPedestal(state, p.pedestalKey);
    if (!tree) return [];
    // Stands on the pedestal's top edge, drawn just in front of the pedestal.
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
