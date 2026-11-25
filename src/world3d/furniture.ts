/**
 * Where the 3D world stands furniture, as pure data: the pieces of a room the
 * 2D world draws (its own furniture and the player's placed items, which the
 * scene's live room already holds) that have a model, as footprint, height and
 * rotation in plan metres. The footprint and height are plan.ts's box of the
 * piece, so a piece's top is the height trees stand at (trees.ts). The
 * renderer stands one instance of the kind's model per piece.
 */

import type { Room } from '../world/shedRoom';
import { modelVertices, type FurnitureKind } from './furnitureModels';
import { furnitureBox, isBoxed, propBox, type Box } from './plan';

/** A piece of furniture to stand: the middle of its footprint, its size and its turn about the vertical. */
export interface FurniturePiece {
  readonly kind: FurnitureKind;
  readonly x: number;
  readonly y: number;
  /** East-west and north-south extent of the footprint, and the height of the top above the floor, metres. */
  readonly w: number;
  readonly d: number;
  readonly h: number;
  /** Radians about the vertical. The 2D world draws every piece front-on, so it is 0. */
  readonly rotation: number;
  /** Changes exactly when the piece's instance must change: equal keys mean the same place, size and turn. */
  readonly key: string;
}

/** The turn of every piece: the 2D world has no rotated furniture. */
const FRONT_ON = 0;

/** Every modelled piece of `room`'s furniture, in the room's order. */
export function furniturePieces(room: Room): FurniturePiece[] {
  const boxes: Box[] = [
    ...room.furniture.flatMap((f, index) => (isBoxed(f) ? [furnitureBox(f, index, room.key)] : [])),
    ...room.props.flatMap((prop) => propBox(prop) ?? []),
  ];
  return boxes.flatMap(({ model, x0, x1, y0, y1, z1 }) => {
    if (model === undefined) return [];
    const piece = {
      kind: model,
      x: (x0 + x1) / 2,
      y: (y0 + y1) / 2,
      w: x1 - x0,
      d: y1 - y0,
      h: z1,
      rotation: FRONT_ON,
    };
    return [{ ...piece, key: Object.values(piece).join('|') }];
  });
}

/**
 * The most vertices of modelled furniture one room may draw, instances counted.
 * The shed, the one room with furniture of its own, comes to 7,560; the budget
 * leaves room to dress other rooms, and keeps a room that gains furniture, or a
 * model that gains parts, from creeping up unseen on a phone's GPU.
 */
export const FURNITURE_VERTEX_BUDGET = 30_000;

/** The vertices `room`'s modelled furniture draws: each piece's model, once per piece. */
export function furnitureVertices(room: Room): number {
  return furniturePieces(room).reduce((sum, piece) => sum + modelVertices(piece.kind), 0);
}
