/**
 * The shapes the 3D world gives furniture, as pure data: each kind of piece is
 * a handful of boxes in metres with a palette wash, built in code. A model is
 * drawn once per kind and stood wherever that kind repeats (renderer.ts, thin
 * instances), scaled from its nominal `size` to the footprint and height the
 * room data gives the piece. Frame as plan.ts's: x east, y south, z up, the
 * middle of the footprint at x 0, y 0 and the floor at z 0.
 */

import type { WashKey } from './plan';

/** The kinds of furniture that have a model: the player's placeables and the shed's clutter. */
export type FurnitureKind =
  'pedestal' | 'floor_shelf' | 'shelf' | 'tools' | 'watering_can' | 'pot_stack' | 'sack';

/** A box of a model: its corners relative to the middle of the footprint at the floor, and its wash. */
export interface ModelPart {
  readonly wash: WashKey;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly z0: number;
  readonly z1: number;
}

/** A kind's model: the footprint and height its parts are drawn for. The tallest part ends at `size.h`. */
export interface FurnitureModel {
  readonly size: { readonly w: number; readonly d: number; readonly h: number };
  readonly parts: readonly ModelPart[];
}

/** The sheets of room furniture that are drawn as a model, by the kind they stand for. */
export const MODELLED_SHEETS: Readonly<Record<string, FurnitureKind>> = {
  spr_pedestal: 'pedestal',
  spr_floor_shelf: 'floor_shelf',
  spr_shelf: 'shelf',
  spr_tools: 'tools',
  spr_watering_can: 'watering_can',
  spr_pot_stack: 'pot_stack',
  spr_sack: 'sack',
};

/** A box `w` wide, `d` deep and `h` tall, its middle over (`x`, `y`) and its bottom at `z`. */
function block(
  wash: WashKey,
  [w, d, h]: readonly [number, number, number],
  [x, y, z]: readonly [number, number, number] = [0, 0, 0],
): ModelPart {
  return {
    wash,
    x0: x - w / 2,
    x1: x + w / 2,
    y0: y - d / 2,
    y1: y + d / 2,
    z0: z,
    z1: z + h,
  };
}

/** The thickness of a plank or a pole, metres. */
const PLANK = 0.04;

/** The pedestal: 0.5 m square and 0.5625 m tall (12 px at the scale rule), a plinth, a column and a top slab. */
const PEDESTAL_SIZE = { w: 0.5, d: 0.5, h: 0.5625 } as const;
const PEDESTAL_PLINTH = 0.06;
const PEDESTAL_SLAB = 0.06;
const PEDESTAL_COLUMN = 0.3;

/** The floor shelf: 1 m by 0.5 m and 0.375 m tall (8 px), a top, a lower shelf and an end panel at each end. */
const FLOOR_SHELF_SIZE = { w: 1, d: 0.5, h: 0.375 } as const;
const FLOOR_SHELF_LOWER = 0.1;

/** The shed's wall shelf: 0.75 m wide, 0.25 m deep and 0.5625 m tall (12 px), three planks between two uprights. */
const SHELF_SIZE = { w: 0.75, d: 0.25, h: 0.5625 } as const;

/** The spade and rake: 0.375 m wide and 0.125 m deep, 1.3125 m tall (28 px), two poles, a blade and a head. */
const TOOLS_SIZE = { w: 0.375, d: 0.125, h: 1.3125 } as const;
const TOOLS_RAKE_HEIGHT = 1.2;

/** The watering can: 0.5 m wide and 0.1875 m deep, 0.28125 m tall (6 px), a body, a spout and a handle. */
const CAN_SIZE = { w: 0.5, d: 0.1875, h: 0.28125 } as const;

/** The stack of pots: 0.375 m wide and 0.25 m deep, 0.5625 m tall (12 px), three, each smaller than the last. */
const POTS_SIZE = { w: 0.375, d: 0.25, h: 0.5625 } as const;

/** The sack: 0.5 m wide and 0.25 m deep, 0.5625 m tall (12 px), a body and a tied neck. */
const SACK_SIZE = { w: 0.5, d: 0.25, h: 0.5625 } as const;

const { w: PW, d: PD, h: PH } = PEDESTAL_SIZE;
const { w: FW, d: FD, h: FH } = FLOOR_SHELF_SIZE;
const { w: SW, d: SD, h: SH } = SHELF_SIZE;

export const FURNITURE_MODELS: Readonly<Record<FurnitureKind, FurnitureModel>> = {
  pedestal: {
    size: PEDESTAL_SIZE,
    parts: [
      block('stone', [PW, PD, PEDESTAL_PLINTH]),
      block(
        'stone',
        [PEDESTAL_COLUMN, PEDESTAL_COLUMN, PH - PEDESTAL_PLINTH - PEDESTAL_SLAB],
        [0, 0, PEDESTAL_PLINTH],
      ),
      block('wood', [PW, PD, PEDESTAL_SLAB], [0, 0, PH - PEDESTAL_SLAB]),
    ],
  },
  floor_shelf: {
    size: FLOOR_SHELF_SIZE,
    parts: [
      block('wood', [FW, FD, PLANK], [0, 0, FH - PLANK]),
      block('wood', [FW - 2 * PLANK, FD, PLANK], [0, 0, FLOOR_SHELF_LOWER]),
      block('floor', [PLANK, FD, FH], [-(FW - PLANK) / 2, 0, 0]),
      block('floor', [PLANK, FD, FH], [(FW - PLANK) / 2, 0, 0]),
    ],
  },
  shelf: {
    size: SHELF_SIZE,
    parts: [
      block('floor', [SW, PLANK, SH], [0, (SD - PLANK) / 2, 0]),
      block('wood', [PLANK, SD, SH], [-(SW - PLANK) / 2, 0, 0]),
      block('wood', [PLANK, SD, SH], [(SW - PLANK) / 2, 0, 0]),
      block('wood', [SW, SD, PLANK], [0, 0, 0]),
      block('wood', [SW, SD, PLANK], [0, 0, (SH - PLANK) / 2]),
      block('wood', [SW, SD, PLANK], [0, 0, SH - PLANK]),
    ],
  },
  tools: {
    size: TOOLS_SIZE,
    parts: [
      block('wood', [PLANK, PLANK, TOOLS_SIZE.h], [-0.1, 0, 0]),
      block('asphalt', [0.12, 0.02, 0.25], [-0.1, 0, 0]),
      block('wood', [PLANK, PLANK, TOOLS_RAKE_HEIGHT], [0.1, 0, 0]),
      block('asphalt', [0.14, 0.06, 0.03], [0.1, 0, TOOLS_RAKE_HEIGHT - 0.03]),
    ],
  },
  watering_can: {
    size: CAN_SIZE,
    parts: [
      block('paint', [0.28, CAN_SIZE.d, 0.2], [-0.05, 0, 0]),
      block('paint', [0.2, 0.05, 0.05], [0.15, 0, 0.1]),
      block('paint', [0.04, 0.05, CAN_SIZE.h - 0.2], [-0.05, 0, 0.2]),
    ],
  },
  pot_stack: {
    size: POTS_SIZE,
    parts: [
      block('tile', [POTS_SIZE.w, POTS_SIZE.d, 0.19]),
      block('tile', [0.32, 0.22, 0.19], [0, 0, 0.19]),
      block('tile', [0.26, 0.18, POTS_SIZE.h - 0.38], [0, 0, 0.38]),
    ],
  },
  sack: {
    size: SACK_SIZE,
    parts: [
      block('render', [SACK_SIZE.w, SACK_SIZE.d, 0.4]),
      block('render', [0.26, 0.16, SACK_SIZE.h - 0.4], [0, 0, 0.4]),
    ],
  },
};
