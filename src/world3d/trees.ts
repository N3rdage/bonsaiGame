/**
 * Where the 3D world stands its trees, as pure data: the same trees on the
 * same spots the 2D world draws (src/world/treeSprites.ts), turned into plan
 * metres (plan.ts's frame: x east, y south, z up from the floor). The tree's
 * shape is not decided here: the renderer builds it from the tree viewer's
 * mesh builders, so a tree is one model in both.
 */

import type { Season } from '../sim/seasons';
import { treeOnPedestal } from '../sim/tree';
import type { BonsaiTree, GameState } from '../sim/types';
import { treeSprites } from '../world/treeSprites';
import type { Furniture, Room } from '../world/shedRoom';
import { heightMetres, metres } from './plan';

/** A tree standing in the room: its feet (the middle of the bottom of the pot, on the surface it stands on) in plan metres. */
export interface TreeStand {
  readonly tree: BonsaiTree;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Changes exactly when the tree's meshes must be rebuilt (`treeKey`). */
  readonly key: string;
}

/**
 * What the tree's meshes are a function of: the tree (its id, `revision`,
 * which every morphology change bumps, and the trunk height, foliage density
 * and pot, which the builders read and growth moves between revisions) and the
 * season the foliage is coloured for. Equal keys mean equal meshes.
 */
export function treeKey(tree: BonsaiTree, season: Season): string {
  const { id, revision, trunk, foliageDensity, potTier } = tree;
  return [id, revision, trunk.heightCm, foliageDensity, potTier, season].join('|');
}

const contains = (f: Furniture, x: number, y: number): boolean =>
  x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h;

/** The height of the tallest piece of furniture whose rect covers the room px point, metres; the floor, 0, under none. */
function surfaceAt(room: Room, x: number, y: number): number {
  const heights = room.furniture
    .filter((f) => f.flat !== true && contains(f, x, y))
    .map((f) => heightMetres(f.stands?.height ?? 0));
  return Math.max(0, ...heights);
}

/**
 * A stand for every tree the 2D world draws in `room`: a floor tree where its
 * sprite stands; a displayed tree in the middle of its spot, on the top of the
 * furniture the spot is on, since the sprite's stand on the spot's top edge is
 * a drawing's depth, not a place on the surface.
 */
export function treeStands(state: GameState, room: Room, season: Season): TreeStand[] {
  return treeSprites(state, room).map((sprite) => {
    const spot =
      sprite.pedestalKey === undefined
        ? undefined
        : room.props.find((p) => p.pedestalKey === sprite.pedestalKey);
    const at = spot ?? sprite;
    return {
      tree: sprite.tree,
      x: metres(at.x),
      y: metres(at.y),
      z: spot ? surfaceAt(room, spot.x, spot.y) : 0,
      key: treeKey(sprite.tree, season),
    };
  });
}

/** A mat marking an empty display spot: its middle on the top of the furniture, in plan metres, where a displayed tree would stand. */
export interface SpotMat {
  /** The spot's `pedestalKey`. */
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A mat for every display spot of `room` (a prop with a `pedestalKey`) that holds no tree, at the stand a tree there would have. */
export function spotMats(state: GameState, room: Room): SpotMat[] {
  return room.props.flatMap((spot) =>
    spot.pedestalKey === undefined || treeOnPedestal(state, spot.pedestalKey) !== undefined
      ? []
      : [
          {
            key: spot.pedestalKey,
            x: metres(spot.x),
            y: metres(spot.y),
            z: surfaceAt(room, spot.x, spot.y),
          },
        ],
  );
}
