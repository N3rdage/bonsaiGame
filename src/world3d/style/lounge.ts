/**
 * Backlog #446 (style frames, throwaway): the lounge-kitchen dressed to a
 * finished look, as pure data. Every piece is a handful of shapes (rounded
 * boxes, cylinders, cones, balls) in plan metres (x east, y south, z up, a
 * shape's `at` the middle of its footprint at its bottom), each with a
 * material and a colour key the take's palette (looks.ts) resolves, so one
 * set of models serves every take. The room's own solid pieces (fireplace,
 * side table, counter) are remodelled over their 2D footprints; the rest
 * (sofa, armchair, coffee table, bookcase, lamp, plant, cat) is new set
 * dressing a rollout would add to loungeRoom.ts as solid furniture.
 */

export type Mat =
  | 'wood'
  | 'fabric'
  | 'plain'
  | 'brick'
  | 'glow'
  | 'shade'
  | 'rug'
  | 'painting'
  | 'painting2'
  | 'painting3';

export type Kind = 'box' | 'cyl' | 'cone' | 'ball';

export interface Shape {
  readonly kind: Kind;
  readonly mat: Mat;
  readonly colour: string;
  /** Middle of the footprint and bottom, plan metres. */
  readonly at: readonly [number, number, number];
  /** Extent east-west, north-south and up, metres (a lying cylinder's length is along its axis). */
  readonly size: readonly [number, number, number];
  /** A box's rounding, metres. */
  readonly r?: number;
  /** A cone's top diameter as a fraction of its bottom's. */
  readonly top?: number;
  /** A cylinder lying along x or y instead of standing. */
  readonly lie?: 'x' | 'y';
  /** Turn about the vertical, radians. */
  readonly turn?: number;
  /** Tilt about x then y, radians (a leaning book, a slumped cushion). */
  readonly tilt?: readonly [number, number];
  /** Casts no shadow and takes no ink (a flame, a pane of sky). */
  readonly flat?: boolean;
}

type V3 = readonly [number, number, number];

const box = (
  mat: Mat,
  colour: string,
  at: V3,
  size: V3,
  r = 0.02,
  extra: Partial<Shape> = {},
): Shape => ({
  kind: 'box',
  mat,
  colour,
  at,
  size,
  r,
  ...extra,
});
const cyl = (mat: Mat, colour: string, at: V3, size: V3, extra: Partial<Shape> = {}): Shape => ({
  kind: 'cyl',
  mat,
  colour,
  at,
  size,
  ...extra,
});
const cone = (
  mat: Mat,
  colour: string,
  at: V3,
  size: V3,
  top: number,
  extra: Partial<Shape> = {},
): Shape => ({
  kind: 'cone',
  mat,
  colour,
  at,
  size,
  top,
  ...extra,
});
const ball = (mat: Mat, colour: string, at: V3, size: V3, extra: Partial<Shape> = {}): Shape => ({
  kind: 'ball',
  mat,
  colour,
  at,
  size,
  ...extra,
});

/** A small deterministic generator, so the books are the same every load. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sofa: Shape[] = [
  box('fabric', 'sofa', [5.45, 4.4, 0.08], [0.86, 1.9, 0.3], 0.07),
  ...[
    [5.1, 3.55],
    [5.8, 3.55],
    [5.1, 5.25],
    [5.8, 5.25],
  ].map(([x = 0, y = 0]) => cone('wood', 'woodDark', [x, y, 0], [0.06, 0.06, 0.09], 1.4)),
  box('fabric', 'sofa', [5.15, 4.4, 0.3], [0.26, 1.92, 0.6], 0.11),
  box('fabric', 'sofa', [5.47, 3.46, 0.22], [0.86, 0.22, 0.42], 0.1),
  box('fabric', 'sofa', [5.47, 5.34, 0.22], [0.86, 0.22, 0.42], 0.1),
  box('fabric', 'sofaLight', [5.56, 3.99, 0.36], [0.64, 0.8, 0.17], 0.075),
  box('fabric', 'sofaLight', [5.56, 4.81, 0.36], [0.64, 0.8, 0.17], 0.075),
  box('fabric', 'sofaLight', [5.33, 3.99, 0.5], [0.18, 0.78, 0.42], 0.08, { tilt: [0, -0.15] }),
  box('fabric', 'sofaLight', [5.33, 4.81, 0.5], [0.18, 0.78, 0.42], 0.08, { tilt: [0, -0.15] }),
  box('fabric', 'cushionA', [5.42, 3.72, 0.52], [0.14, 0.36, 0.34], 0.12, {
    turn: 0.3,
    tilt: [0.1, -0.2],
  }),
  box('fabric', 'cushionB', [5.42, 5.07, 0.52], [0.14, 0.34, 0.32], 0.12, {
    turn: -0.25,
    tilt: [0, -0.2],
  }),
  box('fabric', 'throw', [5.5, 5.34, 0.63], [0.62, 0.3, 0.05], 0.025),
  box('fabric', 'throw', [5.5, 5.47, 0.24], [0.62, 0.05, 0.42], 0.02),
];

const lamp: Shape[] = [
  cyl('plain', 'brass', [5.32, 5.95, 0], [0.3, 0.3, 0.035]),
  cyl('plain', 'brass', [5.32, 5.95, 0.03], [0.03, 0.03, 1.34]),
  cone('shade', 'shade', [5.32, 5.95, 1.22], [0.46, 0.46, 0.32], 0.62),
];

const coffeeTable: Shape[] = [
  box('wood', 'wood', [7.5, 3.85, 0.34], [1.04, 0.58, 0.06], 0.03),
  ...[
    [-0.44, -0.21],
    [0.44, -0.21],
    [-0.44, 0.21],
    [0.44, 0.21],
  ].map(([dx = 0, dy = 0]) =>
    cone('wood', 'woodDark', [7.5 + dx, 3.85 + dy, 0], [0.06, 0.06, 0.35], 1.4),
  ),
  box('wood', 'woodDark', [7.5, 3.85, 0.1], [0.9, 0.46, 0.03], 0.01),
  box('plain', 'book1', [7.2, 3.82, 0.4], [0.27, 0.2, 0.045], 0.008, { turn: 0.15 }),
  box('plain', 'book3', [7.21, 3.8, 0.445], [0.23, 0.17, 0.035], 0.008, { turn: -0.1 }),
  cyl('plain', 'ceramic', [7.72, 3.95, 0.4], [0.14, 0.14, 0.012]),
  cone('plain', 'ceramic', [7.72, 3.95, 0.41], [0.08, 0.08, 0.07], 1.2),
  ball('plain', 'ceramicB', [7.95, 3.75, 0.4], [0.17, 0.17, 0.14]),
  cone('plain', 'ceramicB', [8.05, 3.75, 0.45], [0.04, 0.04, 0.08], 0.5, { tilt: [0, 0.9] }),
  ball('plain', 'ceramicB', [7.95, 3.75, 0.52], [0.07, 0.07, 0.05]),
  cone('plain', 'terracotta', [7.45, 3.68, 0.4], [0.1, 0.1, 0.08], 1.2),
  ball('plain', 'leaf', [7.42, 3.67, 0.47], [0.07, 0.07, 0.06]),
  ball('plain', 'leafLight', [7.48, 3.69, 0.47], [0.06, 0.06, 0.07]),
  ball('plain', 'leaf', [7.45, 3.71, 0.5], [0.05, 0.05, 0.06]),
];

const rug: Shape[] = [
  box('rug', 'white', [7.5, 3.95, 0], [2.6, 1.8, 0.014], 0.006, { flat: true }),
];

const fireplace: Shape[] = [
  box('brick', 'white', [7.12, 2.36, 0], [0.38, 0.72, 0.86], 0.02),
  box('brick', 'white', [7.88, 2.36, 0], [0.38, 0.72, 0.86], 0.02),
  box('brick', 'white', [7.5, 2.36, 0.58], [0.4, 0.72, 0.28], 0.02),
  box('plain', 'soot', [7.5, 2.18, 0], [0.42, 0.36, 0.62], 0.02),
  box('plain', 'stone', [7.5, 2.88, 0], [1.34, 0.32, 0.05], 0.015),
  box('wood', 'woodDark', [7.5, 2.4, 0.86], [1.32, 0.8, 0.0775], 0.02),
  cyl('wood', 'log', [7.5, 2.48, 0.05], [0.42, 0.09, 0.09], { lie: 'x' }),
  cyl('wood', 'log', [7.46, 2.56, 0.12], [0.36, 0.08, 0.08], { lie: 'x', turn: 0.3 }),
  cone('glow', 'flame', [7.42, 2.5, 0.09], [0.16, 0.12, 0.3], 0.05, { flat: true }),
  cone('glow', 'flame', [7.58, 2.48, 0.09], [0.13, 0.1, 0.24], 0.05, { flat: true }),
  cone('glow', 'flameCore', [7.5, 2.55, 0.1], [0.1, 0.08, 0.18], 0.05, { flat: true }),
  // On the mantel: a candle at each end and a little framed photograph.
  cyl('plain', 'cream', [6.95, 2.3, 0.94], [0.06, 0.06, 0.16]),
  cone('glow', 'flameCore', [6.95, 2.3, 1.1], [0.025, 0.025, 0.05], 0.05, { flat: true }),
  cyl('plain', 'cream', [7.02, 2.42, 0.94], [0.05, 0.05, 0.1]),
  cone('glow', 'flameCore', [7.02, 2.42, 1.04], [0.022, 0.022, 0.045], 0.05, { flat: true }),
  box('wood', 'frame', [8.02, 2.24, 0.94], [0.2, 0.03, 0.24], 0.01, {
    turn: -0.25,
    tilt: [-0.15, 0],
  }),
  // Above it, a landscape in a gilt frame.
  box('wood', 'frame', [7.5, 2.02, 1.18], [0.86, 0.05, 0.62], 0.02),
  box('painting', 'white', [7.5, 2.065, 1.24], [0.72, 0.012, 0.5], 0.002, { flat: true }),
];

/** The side table, a round top on a turned stem over the 2D table's footprint (x 5..5.5, y 2..2.5, 0.375 m). */
const sideTable: Shape[] = [
  cyl('wood', 'wood', [5.25, 2.25, 0.335], [0.52, 0.52, 0.04]),
  cone('wood', 'woodDark', [5.25, 2.25, 0.03], [0.07, 0.07, 0.31], 0.7),
  cyl('wood', 'woodDark', [5.25, 2.25, 0], [0.32, 0.32, 0.035]),
];

function books(x0: number, x1: number, y: number, z: number, seed: number): Shape[] {
  const next = rng(seed);
  const out: Shape[] = [];
  let x = x0;
  while (x < x1 - 0.05) {
    const w = 0.03 + next() * 0.035;
    const h = 0.2 + next() * 0.13;
    const colour = `book${String(1 + Math.floor(next() * 5))}`;
    if (next() < 0.12 && x + 0.16 < x1) {
      out.push(box('plain', colour, [x + 0.1, y, z], [w, 0.24, h], 0.006, { tilt: [0, 0.45] }));
      x += 0.2;
      continue;
    }
    out.push(box('plain', colour, [x + w / 2, y + (next() - 0.5) * 0.02, z], [w, 0.22, h], 0.006));
    x += w + 0.004;
  }
  return out;
}

/** A little bonsai, a game about them: a glazed pot, a leaning trunk and three cloud pads. */
function bonsai(x: number, y: number, z: number, s = 1): Shape[] {
  return [
    box('plain', 'glaze', [x, y, z], [0.24 * s, 0.16 * s, 0.07 * s], 0.015),
    cone('wood', 'bark', [x - 0.02 * s, y, z + 0.06 * s], [0.05 * s, 0.05 * s, 0.18 * s], 0.5, {
      tilt: [0, 0.35],
    }),
    ball('plain', 'leaf', [x + 0.04 * s, y, z + 0.16 * s], [0.2 * s, 0.14 * s, 0.09 * s]),
    ball(
      'plain',
      'leafLight',
      [x - 0.08 * s, y + 0.01, z + 0.12 * s],
      [0.12 * s, 0.1 * s, 0.07 * s],
    ),
    ball('plain', 'leaf', [x + 0.08 * s, y - 0.01, z + 0.23 * s], [0.12 * s, 0.1 * s, 0.07 * s]),
  ];
}

const bookcase: Shape[] = [
  box('wood', 'woodDark', [8.17, 2.17, 0], [0.045, 0.34, 1.72], 0.01),
  box('wood', 'woodDark', [8.93, 2.17, 0], [0.045, 0.34, 1.72], 0.01),
  box('wood', 'wood', [8.55, 2.015, 0], [0.8, 0.02, 1.72], 0.004),
  ...[0, 0.42, 0.84, 1.26, 1.68].map((z) =>
    box('wood', 'woodDark', [8.55, 2.17, z], [0.8, 0.34, 0.04], 0.01),
  ),
  ...books(8.2, 8.9, 2.18, 0.04, 3),
  ...books(8.2, 8.6, 2.18, 0.46, 11),
  cone('plain', 'terracotta', [8.76, 2.2, 0.46], [0.14, 0.14, 0.12], 1.25),
  ball('plain', 'leaf', [8.76, 2.2, 0.56], [0.18, 0.16, 0.12]),
  ball('plain', 'leafLight', [8.72, 2.28, 0.47], [0.08, 0.1, 0.18]),
  ...books(8.35, 8.9, 2.18, 0.88, 23),
  box('plain', 'ceramicB', [8.27, 2.18, 0.88], [0.12, 0.12, 0.16], 0.04),
  ...books(8.2, 8.5, 2.18, 1.3, 41),
  ball('plain', 'ceramic', [8.75, 2.2, 1.3], [0.2, 0.2, 0.18]),
  ...bonsai(8.55, 2.18, 1.72, 1.1),
];

const tallPlant: Shape[] = [
  cone('plain', 'terracotta', [10.17, 2.42, 0], [0.32, 0.32, 0.36], 1.25),
  box('plain', 'terracotta', [10.17, 2.42, 0.33], [0.42, 0.42, 0.06], 0.025),
  cyl('plain', 'soil', [10.17, 2.42, 0.37], [0.34, 0.34, 0.02]),
  cone('wood', 'bark', [10.17, 2.42, 0.37], [0.04, 0.04, 0.9], 0.6),
  ...(
    [
      [0, 0, 1.25, 0.42, 'leaf'],
      [0.14, 0.06, 1.0, 0.34, 'leafLight'],
      [-0.15, 0.08, 0.86, 0.32, 'leaf'],
      [0.06, -0.08, 1.45, 0.3, 'leafLight'],
      [-0.08, 0.12, 1.12, 0.3, 'leafDark'],
      [0.12, 0.14, 0.7, 0.26, 'leafDark'],
    ] as const
  ).map(([dx, dy, z, s, c]) =>
    ball('plain', c, [10.17 + dx, 2.42 + dy, z], [s, s * 0.85, s * 0.8]),
  ),
];

function curtains(x0: number, x1: number): Shape[] {
  const side = (xs: readonly number[]): Shape[] =>
    xs.map((x, i) =>
      cyl('fabric', i % 2 === 0 ? 'curtain' : 'curtainDark', [x, 2.07, 0.62], [0.075, 0.075, 1.6]),
    );
  return [
    cyl('plain', 'brass', [(x0 + x1) / 2, 2.06, 2.2], [x1 - x0 + 0.6, 0.025, 0.025], { lie: 'x' }),
    ball('plain', 'brass', [x0 - 0.3, 2.06, 2.19], [0.045, 0.045, 0.045]),
    ball('plain', 'brass', [x1 + 0.3, 2.06, 2.19], [0.045, 0.045, 0.045]),
    ...side([x0 - 0.22, x0 - 0.16, x0 - 0.1, x0 - 0.04]),
    ...side([x1 + 0.04, x1 + 0.1, x1 + 0.16, x1 + 0.22]),
    box('plain', 'sill', [(x0 + x1) / 2, 2.06, 0.86], [x1 - x0 + 0.14, 0.14, 0.045], 0.012),
    // The sky through the glass: lit in the day, deep blue at dusk.
    box('glow', 'sky', [(x0 + x1) / 2, 1.775, 0.98], [x1 - x0 - 0.16, 0.01, 0.94], 0.002, {
      flat: true,
    }),
  ];
}

const windows: Shape[] = [
  ...curtains(5.5, 6.5),
  ...curtains(9, 10),
  ...bonsai(6.12, 2.06, 0.905, 0.8),
  cone('plain', 'terracotta', [5.78, 2.06, 0.905], [0.11, 0.11, 0.1], 1.25),
  ball('plain', 'flower', [5.78, 2.06, 1.0], [0.12, 0.1, 0.1]),
  ball('plain', 'leaf', [5.74, 2.08, 0.97], [0.08, 0.08, 0.07]),
  box('plain', 'ceramic', [9.3, 2.06, 0.905], [0.1, 0.1, 0.14], 0.04),
  cyl('wood', 'bark', [9.3, 2.06, 1.0], [0.012, 0.012, 0.25], { tilt: [0.15, 0.1] }),
];

const armchair: Shape[] = [
  // Local frame, facing west; stood at (9.55, 3.25) turned toward the fire.
  box('fabric', 'chair', [0, 0, 0.08], [0.78, 0.78, 0.32], 0.08),
  box('fabric', 'chair', [0.32, 0, 0.3], [0.22, 0.8, 0.62], 0.11),
  box('fabric', 'chair', [0, -0.34, 0.2], [0.74, 0.2, 0.4], 0.1),
  box('fabric', 'chair', [0, 0.34, 0.2], [0.74, 0.2, 0.4], 0.1),
  box('fabric', 'chairLight', [-0.05, 0, 0.36], [0.6, 0.5, 0.15], 0.07),
  box('fabric', 'cushionA', [0.17, 0, 0.47], [0.12, 0.32, 0.3], 0.1, { tilt: [0, -0.25] }),
  ...[
    [-0.32, -0.32],
    [0.32, -0.32],
    [-0.32, 0.32],
    [0.32, 0.32],
  ].map(([x = 0, y = 0]) => cone('wood', 'woodDark', [x, y, 0], [0.06, 0.06, 0.09], 1.4)),
];

/** Shapes authored about a local origin, turned by `turn` and moved to (`x`, `y`). */
function placed(shapes: readonly Shape[], x: number, y: number, turn: number): Shape[] {
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  return shapes.map((shape) => {
    const [lx, ly, z] = shape.at;
    return {
      ...shape,
      at: [x + lx * c - ly * s, y + lx * s + ly * c, z] as const,
      turn: (shape.turn ?? 0) + turn,
    };
  });
}

const cat: Shape[] = [
  ball('plain', 'cat', [6.95, 4.35, 0.012], [0.38, 0.3, 0.17]),
  ball('plain', 'cream', [6.82, 4.3, 0.03], [0.14, 0.14, 0.11]),
  ball('plain', 'cat', [6.77, 4.24, 0.07], [0.16, 0.15, 0.13]),
  cone('plain', 'catDark', [6.73, 4.21, 0.17], [0.05, 0.03, 0.06], 0.1, { tilt: [0, -0.3] }),
  cone('plain', 'catDark', [6.81, 4.21, 0.17], [0.05, 0.03, 0.06], 0.1, { tilt: [0, 0.3] }),
  ball('plain', 'catDark', [7.1, 4.47, 0.02], [0.22, 0.07, 0.06], { turn: 0.5 }),
  ball('plain', 'catDark', [6.95, 4.52, 0.02], [0.16, 0.06, 0.05], { turn: -0.2 }),
];

const logBasket: Shape[] = [
  cone('fabric', 'wicker', [8.5, 2.98, 0], [0.38, 0.38, 0.28], 1.15),
  cyl('wood', 'log', [8.5, 2.95, 0.22], [0.42, 0.09, 0.09], { lie: 'x', turn: 0.4 }),
  cyl('wood', 'log', [8.48, 3.02, 0.26], [0.4, 0.08, 0.08], { lie: 'x', turn: -0.3 }),
  cyl('wood', 'log', [8.55, 2.98, 0.3], [0.38, 0.08, 0.08], { lie: 'x', turn: 1.2 }),
];

const pictures: Shape[] = [
  box('wood', 'frame', [5.02, 3.95, 1.2], [0.04, 0.58, 0.46], 0.015),
  box('painting2', 'white', [5.06, 3.95, 1.25], [0.012, 0.46, 0.36], 0.002, { flat: true }),
  box('wood', 'frameDark', [5.02, 4.68, 1.15], [0.04, 0.4, 0.52], 0.015),
  box('painting3', 'white', [5.06, 4.68, 1.2], [0.012, 0.3, 0.42], 0.002, { flat: true }),
  // A wall clock between them.
  cyl('plain', 'frameDark', [5.03, 4.33, 1.62], [0.05, 0.22, 0.22], { lie: 'x' }),
  cyl('plain', 'cream', [5.06, 4.33, 1.635], [0.02, 0.18, 0.18], { lie: 'x' }),
];

/** The kitchen: cabinets under a butcher-block worktop over the 2D counter's footprint, and what lives on it. */
const kitchen: Shape[] = [
  box('plain', 'cabinet', [12.0, 6.22, 0.1], [3.0, 0.56, 0.77], 0.02),
  box('wood', 'woodDark', [12.0, 6.25, 0], [3.0, 0.5, 0.1], 0.01),
  box('wood', 'woodLight', [11.99, 6.18, 0.86], [3.04, 0.67, 0.0775], 0.015),
  ...[10.75, 11.25, 11.75, 12.25].map((x) =>
    box('plain', 'cabinetLight', [x, 5.93, 0.15], [0.44, 0.03, 0.66], 0.015),
  ),
  ...[10.75, 11.25, 11.75, 12.25].map((x) =>
    ball('plain', 'brass', [x + 0.15, 5.905, 0.72], [0.035, 0.03, 0.035]),
  ),
  box('plain', 'cabinet', [13.2, 4.94, 0.1], [0.56, 1.875, 0.77], 0.02),
  box('wood', 'woodLight', [13.19, 4.95, 0.86], [0.67, 1.9, 0.0775], 0.015),
  ...[4.3, 4.78, 5.26].map((y) =>
    box('plain', 'cabinetLight', [12.91, y, 0.15], [0.03, 0.44, 0.66], 0.015),
  ),
  ...[4.3, 4.78, 5.26].map((y) =>
    ball('plain', 'brass', [12.89, y - 0.15, 0.72], [0.03, 0.035, 0.035]),
  ),
  // A striped tea towel over a door.
  box('fabric', 'towel', [11.25, 5.9, 0.42], [0.22, 0.025, 0.42], 0.01),
  // Kettle, bread board and loaf, jars, a fruit bowl and pots of herbs.
  ball('plain', 'copper', [10.95, 6.2, 0.94], [0.22, 0.22, 0.2]),
  cone('plain', 'copper', [10.83, 6.15, 0.98], [0.05, 0.05, 0.12], 0.4, { tilt: [0, -0.9] }),
  box('plain', 'ink', [10.95, 6.2, 1.12], [0.14, 0.03, 0.06], 0.012),
  box('wood', 'woodLight', [11.5, 6.25, 0.94], [0.42, 0.26, 0.025], 0.01, { turn: 0.1 }),
  ball('plain', 'bread', [11.5, 6.25, 0.96], [0.28, 0.14, 0.11], { turn: 0.1 }),
  cyl('plain', 'jar', [12.2, 6.32, 0.94], [0.12, 0.12, 0.22]),
  cyl('wood', 'woodDark', [12.2, 6.32, 1.16], [0.125, 0.125, 0.03]),
  cyl('plain', 'jar', [12.37, 6.32, 0.94], [0.11, 0.11, 0.17]),
  cyl('wood', 'woodDark', [12.37, 6.32, 1.11], [0.115, 0.115, 0.03]),
  cyl('plain', 'jarB', [12.52, 6.32, 0.94], [0.1, 0.1, 0.13]),
  cyl('wood', 'woodDark', [12.52, 6.32, 1.07], [0.105, 0.105, 0.025]),
  cone('plain', 'ceramicB', [13.2, 4.55, 0.94], [0.2, 0.2, 0.09], 1.6),
  ball('plain', 'fruit1', [13.16, 4.52, 1.0], [0.09, 0.09, 0.09]),
  ball('plain', 'fruit2', [13.25, 4.58, 1.0], [0.09, 0.09, 0.09]),
  ball('plain', 'fruit1', [13.22, 4.48, 1.03], [0.085, 0.085, 0.085]),
  ball('plain', 'fruit3', [13.13, 4.62, 1.02], [0.1, 0.06, 0.06], { turn: 0.6 }),
  ...[5.05, 5.3, 5.55].flatMap((y, i) => [
    cone('plain', 'terracotta', [13.25, y, 0.94], [0.13, 0.13, 0.12], 1.25),
    ball('plain', i === 1 ? 'leafLight' : 'leaf', [13.25, y, 1.05], [0.15, 0.14, 0.13 + i * 0.03]),
  ]),
  // An open shelf on the hallway block's kitchen face, with plates and mugs.
  box('wood', 'woodLight', [12.0, 4.12, 1.42], [1.5, 0.22, 0.04], 0.01),
  box('wood', 'woodDark', [11.4, 4.04, 1.3], [0.04, 0.06, 0.12], 0.005),
  box('wood', 'woodDark', [12.6, 4.04, 1.3], [0.04, 0.06, 0.12], 0.005),
  ...[11.4, 11.48, 11.56].map((x) =>
    cyl('plain', 'ceramic', [x, 4.1, 1.46], [0.02, 0.22, 0.22], { lie: 'x' }),
  ),
  ...[11.9, 12.08, 12.26].map((x, i) =>
    cyl('plain', i === 1 ? 'ceramicB' : 'jarB', [x, 4.12, 1.46], [0.09, 0.09, 0.1]),
  ),
  cyl('plain', 'jar', [12.5, 4.12, 1.46], [0.1, 0.1, 0.2]),
];

/** The hallway door in the block's west face (y 2.5..3.5), and its frame. */
const hallwayDoor: Shape[] = [
  box('wood', 'door', [10.475, 3.0, 0], [0.05, 0.86, 1.98], 0.012),
  box('wood', 'doorDark', [10.465, 2.8, 0.25], [0.02, 0.3, 0.6], 0.01),
  box('wood', 'doorDark', [10.465, 3.2, 0.25], [0.02, 0.3, 0.6], 0.01),
  box('wood', 'doorDark', [10.465, 2.8, 1.05], [0.02, 0.3, 0.7], 0.01),
  box('wood', 'doorDark', [10.465, 3.2, 1.05], [0.02, 0.3, 0.7], 0.01),
  box('plain', 'sill', [10.48, 2.52, 0], [0.06, 0.06, 2.04], 0.01),
  box('plain', 'sill', [10.48, 3.48, 0], [0.06, 0.06, 2.04], 0.01),
  box('plain', 'sill', [10.48, 3.0, 1.98], [0.06, 1.02, 0.07], 0.01),
  ball('plain', 'brass', [10.43, 3.35, 0.98], [0.05, 0.05, 0.05]),
  // A coat on a hook beside it.
  box('plain', 'woodDark', [10.47, 3.7, 1.62], [0.04, 0.04, 0.05], 0.01),
  box('fabric', 'coat', [10.4, 3.7, 0.95], [0.1, 0.34, 0.7], 0.08),
  ball('fabric', 'cushionB', [10.4, 3.7, 1.5], [0.12, 0.16, 0.16]),
];

/** Every shape the dressed lounge adds, the remodelled solid pieces included. */
export const LOUNGE_DRESSING: readonly Shape[] = [
  ...rug,
  ...sofa,
  ...lamp,
  ...coffeeTable,
  ...fireplace,
  ...sideTable,
  ...bookcase,
  ...tallPlant,
  ...windows,
  ...placed(armchair, 9.55, 3.3, -0.55),
  ...cat,
  ...logBasket,
  ...pictures,
  ...kitchen,
  ...hallwayDoor,
];

/** Where the warm lights are, plan metres: the fire and the floor lamp. */
export const LOUNGE_GLOWS = {
  fire: [7.5, 2.75, 0.35] as const,
  lamp: [5.32, 5.95, 1.32] as const,
  candles: [7.0, 2.45, 1.1] as const,
};

/** The 2D pieces the dressing remodels or hides, by their plan box names' sheet. */
export const REMODELLED_SHEETS: readonly string[] = [
  'spr_floor_kitchen',
  'spr_lounge_cap_v',
  'spr_lounge_cap',
  'spr_fireplace',
  'spr_side_table',
  'spr_counter',
  'spr_counter_v',
];

/** The kitchen's tiled floor, plan metres. */
export const KITCHEN_TILES = { x0: 10.5, x1: 13.5, y0: 4, y1: 6.5 };
