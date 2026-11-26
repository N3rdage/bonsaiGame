/**
 * The shapes the 3D world gives furniture, as pure data: each kind of piece is
 * a handful of rounded boxes, cylinders, cones and balls in metres with an object-palette colour,
 * built in code. A model is
 * drawn once per kind and stood wherever that kind repeats (renderer.ts, thin
 * instances), scaled from its nominal `size` to the footprint and height the
 * room data gives the piece. Frame as plan.ts's: x east, y south, z up, the
 * middle of the footprint at x 0, y 0 and the floor at z 0.
 */

import type { ObjectKey } from './look';
import type { WashKey } from './plan';
import {
  ballVertexCount,
  coneVertexCount,
  cylinderVertexCount,
  roundedBoxVertexCount,
} from './shapes';

/** The kinds of furniture that have a model: the player's placeables, the shed's clutter and the lounge's seating and dressing. */
export type FurnitureKind =
  | 'pedestal'
  | 'floor_shelf'
  | 'shelf'
  | 'tools'
  | 'watering_can'
  | 'pot_stack'
  | 'sack'
  | 'workbench'
  | 'planting_table'
  | 'kiosk'
  | 'sofa'
  | 'armchair'
  | 'coffee_table'
  | 'bookcase'
  | 'floor_lamp'
  | 'potted_plant';

/** A box of a model: its corners relative to the middle of the footprint at the floor, and its wash. */
export interface ModelPart {
  readonly wash: WashKey;
  /** A pane of glass: drawn translucent and without ink, its `wash` only a fallback. */
  readonly glass?: boolean;
  /**
   * What the part's box holds: a rounded or sharp box when absent, else a
   * cylinder, a cone or a ball filling the box, a cylinder or cone standing
   * on `z0` with its axis along z.
   */
  readonly shape?: 'cylinder' | 'cone' | 'ball';
  /** A cone's top as wide as this fraction of its base, 0 (a point) when absent. */
  readonly taper?: number;
  /** Rounds a box's edges to this radius, metres, at most half its smallest extent; without it the box is sharp. */
  readonly radius?: number;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly z0: number;
  readonly z1: number;
}

/** A box of a furniture model: a `ModelPart` coloured from the object palette (look.ts) rather than a wash. */
export type FurniturePart = Omit<ModelPart, 'wash'> & { readonly object: ObjectKey };

/** A kind's model: the footprint and height its parts are drawn for. The tallest part ends at `size.h`. */
export interface FurnitureModel {
  readonly size: { readonly w: number; readonly d: number; readonly h: number };
  readonly parts: readonly FurniturePart[];
}

/**
 * The sheets of room furniture that are drawn as a model, by the kind they
 * stand for. The workbench, planting table and kiosk are props, not furniture
 * (plan.ts's `propBox`), so they are not here.
 */
export const MODELLED_SHEETS: Readonly<Record<string, FurnitureKind>> = {
  spr_pedestal: 'pedestal',
  spr_floor_shelf: 'floor_shelf',
  spr_shelf: 'shelf',
  spr_tools: 'tools',
  spr_watering_can: 'watering_can',
  spr_pot_stack: 'pot_stack',
  spr_sack: 'sack',
  spr_sofa: 'sofa',
  spr_armchair: 'armchair',
  spr_coffee_table: 'coffee_table',
  spr_bookcase: 'bookcase',
  spr_floor_lamp: 'floor_lamp',
  spr_potted_plant: 'potted_plant',
};

/** The most a furniture box's edges are rounded: a few cm on a big slab; a thin plank or pole rounds to a third of its thickness. */
const ROUNDING = 0.03;

/** A box `w` wide, `d` deep and `h` tall, its middle over (`x`, `y`) and its bottom at `z`, its edges rounded to suit its size. */
function block(
  object: ObjectKey,
  [w, d, h]: readonly [number, number, number],
  [x, y, z]: readonly [number, number, number] = [0, 0, 0],
): FurniturePart {
  return {
    object,
    x0: x - w / 2,
    x1: x + w / 2,
    y0: y - d / 2,
    y1: y + d / 2,
    z0: z,
    z1: z + h,
    radius: Math.min(ROUNDING, Math.min(w, d, h) / 3),
  };
}

/** A cylinder, or a cone narrowing to `taper` of its base at the top, `diameter` wide and `h` tall, its axis over (`x`, `y`) and its bottom at `z`. */
function column(
  object: ObjectKey,
  [diameter, h]: readonly [number, number],
  [x, y, z]: readonly [number, number, number],
  taper?: number,
): FurniturePart {
  return {
    object,
    shape: taper === undefined ? 'cylinder' : 'cone',
    ...(taper === undefined ? {} : { taper }),
    x0: x - diameter / 2,
    x1: x + diameter / 2,
    y0: y - diameter / 2,
    y1: y + diameter / 2,
    z0: z,
    z1: z + h,
  };
}

/** A ball `diameter` across, its middle over (`x`, `y`) and its bottom at `z`. */
function ball(
  object: ObjectKey,
  diameter: number,
  [x, y, z]: readonly [number, number, number],
): FurniturePart {
  const r = diameter / 2;
  return {
    object,
    shape: 'ball',
    x0: x - r,
    x1: x + r,
    y0: y - r,
    y1: y + r,
    z0: z,
    z1: z + diameter,
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

/** The workbench: 1.25 m by 0.625 m and 0.9375 m tall (frame 40 px, 20 of it the top face), a top, four legs and a lower shelf. */
const BENCH_SIZE = { w: 1.25, d: 0.625, h: 0.9375 } as const;
const TABLE_TOP = 0.06;
const LEG = 0.06;

/** The planting table: 1 m by 0.625 m and 0.9375 m tall (frame 40 px, 20 of it the top face), a top with a soil tray on it, on four legs. */
const TABLE_SIZE = { w: 1, d: 0.625, h: 0.9375 } as const;
const TRAY_RAISE = 0.05;

/** The shop kiosk: 0.875 m by 0.75 m and 1.5 m tall (frame 56 px, 24 of it the top face), a counter with a sign on two posts behind it. */
const KIOSK_SIZE = { w: 0.875, d: 0.75, h: 1.5 } as const;
const KIOSK_COUNTER = 0.95;
const KIOSK_SIGN = 0.3;

/**
 * The sofa: 0.875 m by 1.875 m and 0.9375 m tall (28 x 60 px, 20 tall), its back along the west
 * edge (-x) and its seat facing east: a base on four feet between two arms, a back, and a seat
 * and a back cushion for each of its two places.
 */
const SOFA_SIZE = { w: 0.875, d: 1.875, h: 0.9375 } as const;
/** The armchair: 0.75 m square and 0.9375 m tall (24 px, 20 tall), its back along the east edge (+x), facing west. */
const ARMCHAIR_SIZE = { w: 0.75, d: 0.75, h: 0.9375 } as const;
/** The coffee table: 0.625 m by 1.0 m and 0.375 m tall (20 x 32 px, 8 tall), a top over four legs and a low shelf. */
const COFFEE_TABLE_SIZE = { w: 0.625, d: 1, h: 0.375 } as const;
/**
 * The tall bookcase: 0.875 m wide, 0.375 m deep and 1.78125 m tall (28 x 12 px, 38 tall), its back
 * along the north edge (-y) and its front open to the south: a plinth, two sides, a back, a top and
 * four shelves, with books standing on three of them.
 */
const BOOKCASE_SIZE = { w: 0.875, d: 0.375, h: 1.78125 } as const;
const BOOKCASE_PLINTH = 0.1;
const BOOKCASE_SIDE = 0.04;
const BOOKCASE_SHELVES = [0.1, 0.5, 0.9, 1.3] as const;
/** The books of the three upper shelves: each one's colour, width and height, in a row from the west side. */
const BOOKCASE_BOOKS: readonly (readonly (readonly [ObjectKey, number, number])[])[] = [
  [
    ['book1', 0.06, 0.3],
    ['book2', 0.07, 0.34],
    ['book3', 0.05, 0.28],
    ['book4', 0.08, 0.32],
  ],
  [
    ['book5', 0.07, 0.32],
    ['book1', 0.05, 0.26],
    ['book4', 0.08, 0.34],
  ],
  [
    ['book2', 0.06, 0.3],
    ['book3', 0.08, 0.34],
    ['book5', 0.05, 0.27],
  ],
];
/** The floor lamp: 0.4375 m square and 1.5 m tall (14 px, 32 tall), a round base, a pole and a tapering shade. */
const LAMP_SIZE = { w: 0.4375, d: 0.4375, h: 1.5 } as const;
/** The potted plant: 0.625 m wide, 0.5 m deep and 1.125 m tall (20 x 16 px, 24 tall), a round terracotta pot, a stem and balls of foliage. */
const PLANT_SIZE = { w: 0.625, d: 0.5, h: 1.125 } as const;

/** The books of the upper shelf `n`, standing on its plank from the west side with a hair between them, their spines 2 cm short of the open front. */
function books(n: number): FurniturePart[] {
  const shelf = BOOKCASE_SHELVES[n + 1] ?? 0;
  const { w, d } = BOOKCASE_SIZE;
  let x = -w / 2 + BOOKCASE_SIDE + 0.02;
  return (BOOKCASE_BOOKS[n] ?? []).map(([object, width, height]) => {
    const part = block(object, [width, d - 0.1, height], [x + width / 2, 0.03, shelf + PLANK]);
    x += width + 0.01;
    return part;
  });
}

/** How high an upholstered piece stands on its feet, and its base, arms and cushions, metres. */
const FOOT = 0.08;
const SEAT_BASE = 0.3;
const ARM = 0.55;
const BACK = 0.22;
const CUSHION = 0.13;

/** The four feet of a piece `w` by `d`, each 0.06 m square and `FOOT` tall, inset a little from its corners. */
function feet(w: number, d: number): FurniturePart[] {
  const [x, y] = [w / 2 - 0.06, d / 2 - 0.06];
  return [-1, 1].flatMap((sx) =>
    [-1, 1].map((sy) => block('woodDark', [0.06, 0.06, FOOT], [sx * x, sy * y, 0])),
  );
}

/** The four legs of a table `w` by `d` tall `h`, one at each corner. */
function legs(w: number, d: number, h: number): FurniturePart[] {
  const [x, y] = [(w - LEG) / 2, (d - LEG) / 2];
  return [
    block('wood', [LEG, LEG, h], [-x, -y, 0]),
    block('wood', [LEG, LEG, h], [x, -y, 0]),
    block('wood', [LEG, LEG, h], [-x, y, 0]),
    block('wood', [LEG, LEG, h], [x, y, 0]),
  ];
}

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
      block('woodDark', [PLANK, FD, FH], [-(FW - PLANK) / 2, 0, 0]),
      block('woodDark', [PLANK, FD, FH], [(FW - PLANK) / 2, 0, 0]),
    ],
  },
  shelf: {
    size: SHELF_SIZE,
    parts: [
      block('woodDark', [SW, PLANK, SH], [0, (SD - PLANK) / 2, 0]),
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
      block('soot', [0.12, 0.02, 0.25], [-0.1, 0, 0]),
      block('wood', [PLANK, PLANK, TOOLS_RAKE_HEIGHT], [0.1, 0, 0]),
      block('soot', [0.14, 0.06, 0.03], [0.1, 0, TOOLS_RAKE_HEIGHT - 0.03]),
    ],
  },
  watering_can: {
    size: CAN_SIZE,
    parts: [
      block('glaze', [0.28, CAN_SIZE.d, 0.2], [-0.05, 0, 0]),
      block('glaze', [0.2, 0.05, 0.05], [0.15, 0, 0.1]),
      block('glaze', [0.04, 0.05, CAN_SIZE.h - 0.2], [-0.05, 0, 0.2]),
    ],
  },
  pot_stack: {
    size: POTS_SIZE,
    parts: [
      block('terracotta', [POTS_SIZE.w, POTS_SIZE.d, 0.19]),
      block('terracotta', [0.32, 0.22, 0.19], [0, 0, 0.19]),
      block('terracotta', [0.26, 0.18, POTS_SIZE.h - 0.38], [0, 0, 0.38]),
    ],
  },
  sack: {
    size: SACK_SIZE,
    parts: [
      block('wicker', [SACK_SIZE.w, SACK_SIZE.d, 0.4]),
      block('wicker', [0.26, 0.16, SACK_SIZE.h - 0.4], [0, 0, 0.4]),
    ],
  },
  workbench: {
    size: BENCH_SIZE,
    parts: [
      ...legs(BENCH_SIZE.w, BENCH_SIZE.d, BENCH_SIZE.h - TABLE_TOP),
      block('wood', [BENCH_SIZE.w, BENCH_SIZE.d, TABLE_TOP], [0, 0, BENCH_SIZE.h - TABLE_TOP]),
      block('wood', [BENCH_SIZE.w - 2 * LEG, BENCH_SIZE.d - 2 * LEG, PLANK], [0, 0, 0.2]),
    ],
  },
  planting_table: {
    size: TABLE_SIZE,
    parts: [
      ...legs(TABLE_SIZE.w, TABLE_SIZE.d, TABLE_SIZE.h - TRAY_RAISE - TABLE_TOP),
      block(
        'wood',
        [TABLE_SIZE.w, TABLE_SIZE.d, TABLE_TOP],
        [0, 0, TABLE_SIZE.h - TRAY_RAISE - TABLE_TOP],
      ),
      block(
        'soil',
        [TABLE_SIZE.w - 0.2, TABLE_SIZE.d - 0.2, TRAY_RAISE],
        [0, 0, TABLE_SIZE.h - TRAY_RAISE],
      ),
    ],
  },
  sofa: {
    size: SOFA_SIZE,
    parts: [
      ...feet(SOFA_SIZE.w, SOFA_SIZE.d),
      block('sofa', [SOFA_SIZE.w, SOFA_SIZE.d, SEAT_BASE], [0, 0, FOOT]),
      block('sofa', [BACK, SOFA_SIZE.d, SOFA_SIZE.h - FOOT], [-(SOFA_SIZE.w - BACK) / 2, 0, FOOT]),
      ...[-1, 1].map((side) =>
        block('sofa', [SOFA_SIZE.w, 0.2, ARM], [0, (side * (SOFA_SIZE.d - 0.2)) / 2, FOOT]),
      ),
      ...[-1, 1].flatMap((side) => [
        block('sofaLight', [0.5, 0.75, CUSHION], [0.12, side * 0.4, FOOT + SEAT_BASE]),
        block('sofaLight', [0.14, 0.75, 0.38], [-0.14, side * 0.4, FOOT + SEAT_BASE]),
      ]),
      block('cushionA', [0.12, 0.3, 0.28], [-0.04, -0.42, 0.52]),
    ],
  },
  armchair: {
    size: ARMCHAIR_SIZE,
    parts: [
      ...feet(ARMCHAIR_SIZE.w, ARMCHAIR_SIZE.d),
      block('chair', [ARMCHAIR_SIZE.w, ARMCHAIR_SIZE.d, SEAT_BASE], [0, 0, FOOT]),
      block(
        'chair',
        [BACK, ARMCHAIR_SIZE.d, ARMCHAIR_SIZE.h - FOOT],
        [(ARMCHAIR_SIZE.w - BACK) / 2, 0, FOOT],
      ),
      ...[-1, 1].map((side) =>
        block(
          'chair',
          [ARMCHAIR_SIZE.w, 0.18, ARM],
          [0, (side * (ARMCHAIR_SIZE.d - 0.18)) / 2, FOOT],
        ),
      ),
      block('chairLight', [0.46, 0.38, CUSHION], [-0.08, 0, FOOT + SEAT_BASE]),
    ],
  },
  coffee_table: {
    size: COFFEE_TABLE_SIZE,
    parts: [
      ...legs(COFFEE_TABLE_SIZE.w, COFFEE_TABLE_SIZE.d, COFFEE_TABLE_SIZE.h - TABLE_TOP),
      block(
        'wood',
        [COFFEE_TABLE_SIZE.w, COFFEE_TABLE_SIZE.d, TABLE_TOP],
        [0, 0, COFFEE_TABLE_SIZE.h - TABLE_TOP],
      ),
      block(
        'woodDark',
        [COFFEE_TABLE_SIZE.w - 2 * LEG, COFFEE_TABLE_SIZE.d - 2 * LEG, PLANK / 2],
        [0, 0, 0.1],
      ),
    ],
  },
  bookcase: {
    size: BOOKCASE_SIZE,
    parts: [
      block('woodDark', [BOOKCASE_SIZE.w, BOOKCASE_SIZE.d, BOOKCASE_PLINTH]),
      ...[-1, 1].map((side) =>
        block(
          'wood',
          [BOOKCASE_SIDE, BOOKCASE_SIZE.d, BOOKCASE_SIZE.h - BOOKCASE_PLINTH],
          [(side * (BOOKCASE_SIZE.w - BOOKCASE_SIDE)) / 2, 0, BOOKCASE_PLINTH],
        ),
      ),
      block(
        'woodDark',
        [BOOKCASE_SIZE.w - 2 * BOOKCASE_SIDE, 0.02, BOOKCASE_SIZE.h - BOOKCASE_PLINTH],
        [0, -(BOOKCASE_SIZE.d - 0.02) / 2, BOOKCASE_PLINTH],
      ),
      ...BOOKCASE_SHELVES.map((z) =>
        block(
          'wood',
          [BOOKCASE_SIZE.w - 2 * BOOKCASE_SIDE, BOOKCASE_SIZE.d - 0.02, PLANK],
          [0, 0.01, z],
        ),
      ),
      block('wood', [BOOKCASE_SIZE.w, BOOKCASE_SIZE.d, 0.05], [0, 0, BOOKCASE_SIZE.h - 0.05]),
      ...[0, 1, 2].flatMap(books),
    ],
  },
  floor_lamp: {
    size: LAMP_SIZE,
    parts: [
      column('woodDark', [0.3, 0.04], [0, 0, 0]),
      column('brass', [0.03, 1.2], [0, 0, 0.04]),
      column('brass', [0.06, 0.04], [0, 0, 1.24]),
      column('shade', [LAMP_SIZE.w, 0.26], [0, 0, LAMP_SIZE.h - 0.26], 0.6),
    ],
  },
  potted_plant: {
    size: PLANT_SIZE,
    parts: [
      column('terracotta', [0.36, 0.36], [0, 0, 0]),
      column('terracotta', [0.44, 0.06], [0, 0, 0.34]),
      column('soil', [0.38, 0.03], [0, 0, 0.4]),
      column('bark', [0.04, 0.3], [0, 0, 0.42]),
      ball('leafDark', 0.46, [0, 0, 0.5]),
      ball('leaf', 0.38, [-0.1, 0.04, 0.6]),
      ball('leafLight', 0.32, [0.1, -0.04, 0.72]),
      ball('leaf', 0.28, [0.02, 0.06, PLANT_SIZE.h - 0.28]),
    ],
  },
  kiosk: {
    size: KIOSK_SIZE,
    parts: [
      block('wood', [KIOSK_SIZE.w, KIOSK_SIZE.d, KIOSK_COUNTER - 0.04]),
      block('stone', [KIOSK_SIZE.w, KIOSK_SIZE.d, 0.04], [0, 0, KIOSK_COUNTER - 0.04]),
      block(
        'wood',
        [PLANK, PLANK, KIOSK_SIZE.h - KIOSK_COUNTER],
        [-(KIOSK_SIZE.w - PLANK) / 2, -(KIOSK_SIZE.d - PLANK) / 2, KIOSK_COUNTER],
      ),
      block(
        'wood',
        [PLANK, PLANK, KIOSK_SIZE.h - KIOSK_COUNTER],
        [(KIOSK_SIZE.w - PLANK) / 2, -(KIOSK_SIZE.d - PLANK) / 2, KIOSK_COUNTER],
      ),
      block(
        'frame',
        [KIOSK_SIZE.w, PLANK, KIOSK_SIGN],
        [0, -(KIOSK_SIZE.d - PLANK) / 2, KIOSK_SIZE.h - KIOSK_SIGN],
      ),
    ],
  },
};

/** The vertices of a sharp box, as `CreateBox` makes it: four to each face. */
const SHARP_BOX_VERTICES = 24;

/** The vertices one instance of `kind`'s model draws. */
export function modelVertices(kind: FurnitureKind): number {
  return FURNITURE_MODELS[kind].parts.reduce((sum, part) => sum + partVertices(part), 0);
}

/** The vertices one part draws, as the renderer builds it. */
function partVertices({ shape, taper, radius, x0, x1, y0, y1, z0, z1 }: FurniturePart): number {
  if (shape === 'cylinder') return cylinderVertexCount();
  if (shape === 'cone') return coneVertexCount(undefined, taper);
  if (shape === 'ball') return ballVertexCount();
  return radius === undefined
    ? SHARP_BOX_VERTICES
    : roundedBoxVertexCount(x1 - x0, z1 - z0, y1 - y0, radius);
}
