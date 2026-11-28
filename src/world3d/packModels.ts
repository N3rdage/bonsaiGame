/**
 * The furniture the 3D world draws from ready-made packs, as pure data: eight KayKit Furniture
 * Bits models (src/world3d/furniture/) and the lounge's two kitchen counter runs, built from
 * KayKit Restaurant Bits (src/world3d/restaurant/); both CC0, Kay Lousberg. A model is one or
 * more .glb files of one mesh each, whose feet stand on y 0 unless a part says it rests on
 * another. `packGeometry` centres each mesh over its footprint, turns it to face the way the
 * piece does, scales it to the part's own `size` in metres (footprint and drawn height), sets it
 * at its place in the piece and merges the parts into one mesh. A kind's nominal size is the
 * piece's and its instance scale is 1, as for the code-made kinds, so the ink outline, which
 * Babylon offsets in model space, is as thick as theirs. The model's top lands on the piece's
 * height, which is where a displayed tree stands (trees.ts). Nothing here imports Babylon;
 * `packGeometry` turns the files' accessors into the arrays the renderer draws.
 */

import { accessorFloats, accessorIndices, type Glb } from './glb';

/** The kinds of furniture drawn from a pack model. */
export type PackKind =
  | 'side_table'
  | 'desk'
  | 'low_bookcase'
  | 'sofa'
  | 'armchair'
  | 'coffee_table'
  | 'floor_lamp'
  | 'counter'
  | 'counter_v'
  | 'runner_rug';

/** The way a part's front faces in the plan: south, toward the camera, as the file has it, or turned to the north, the east or the west. */
export type Facing = 'south' | 'north' | 'east' | 'west';

/** The texture atlas a model is drawn on: each pack has its own. */
export type PackAtlas = 'furniture' | 'restaurant';

/** A box's east-west, north-south and vertical size in metres. */
export interface Extent {
  readonly w: number;
  readonly d: number;
  readonly h: number;
}

/** One file of a model: where it stands in the piece and the size it is drawn at. */
export interface PackPart {
  /** The file's name in its pack's folder (src/world3d/furniture/ or src/world3d/restaurant/). */
  readonly file: string;
  /** Extent of the mesh's bounds, as in the file's POSITION accessor: `w` along the file's x, `d` along its z, `h` up to its highest y, before it is turned. */
  readonly extent: Extent;
  /** The file's lowest y when the part rests on another part instead of the floor (a hob on a counter); 0 when absent. */
  readonly base?: number;
  /** The way the part faces; the file's own front is south. */
  readonly faces: Facing;
  /** The part's footprint (`w` east-west, `d` north-south, once turned) and drawn height in metres, which `packGeometry` scales the mesh to. */
  readonly size: Extent;
  readonly vertices: number;
  /** Where the middle of the part's footprint lies from the middle of the piece's, metres east and south. */
  readonly at: { readonly x: number; readonly y: number };
}

/** A pack model: its atlas, the size of the piece it draws and the files it is made of. */
export interface PackModel {
  readonly atlas: PackAtlas;
  /** The piece's footprint and height in metres: its plan box, and where a tree on it stands. A part may rise above it (a tap, a hob). */
  readonly size: Extent;
  readonly parts: readonly PackPart[];
  /** For a seat: the top of its cushion over the feet in the file's own units, where a sitter's hips rest. */
  readonly seat?: number;
  /**
   * The model lies flat on the floor (a rug). It lies over the floor's Inked tiles, whose
   * polygon offset pulls them toward the camera, so the renderer gives it a stronger one or
   * the tiles would hide its top face.
   */
  readonly flat?: true;
}

/** A Furniture Bits model of one file, centred, drawn at the piece's size. */
function whole(
  file: string,
  extent: Extent,
  faces: Facing,
  size: Extent,
  vertices: number,
  seat?: number,
): PackModel {
  return {
    atlas: 'furniture',
    size,
    parts: [{ file, extent, faces, size, vertices, at: { x: 0, y: 0 } }],
    ...(seat === undefined ? {} : { seat }),
  };
}

/** How thick the runner rug is drawn, metres: plan.ts's `FLAT_THICKNESS`, which a unit test pins it to, so the rug lies where the slab it replaces did. */
export const RUG_THICKNESS = 0.01;

/** How high a kitchen counter's top stands, metres: the 20 px height of the lounge's counter sheets, which the pack's 1 m high cabinets are scaled to. */
export const COUNTER_TOP = 0.9375;
/** How deep a counter run is, metres: 20 px. The corner cell and each cell of the east run are as wide. */
export const COUNTER_DEPTH = 0.625;
/** The width of the cabinets in the files, metres, which a cell's footprint is scaled from. */
const CELL_SPAN = 2;

/** A Restaurant Bits file a counter run is made of: its extent in the file's metres and its vertices. */
interface CounterFile {
  readonly file: string;
  readonly extent: Extent;
  readonly vertices: number;
}

const COUNTER_FILES = {
  /** A base cabinet with a drawer front; `A` and `B` differ in their fronts. */
  A: {
    file: 'kitchencounter_straight_A.glb',
    extent: { w: 2, d: 2.041903, h: 1 },
    vertices: 231,
  },
  B: {
    file: 'kitchencounter_straight_B.glb',
    extent: { w: 2, d: 2.041903, h: 1 },
    vertices: 220,
  },
  /** The cell where two runs meet: a block with its fronts on the file's west and south sides. */
  corner: {
    file: 'kitchencounter_outercorner.glb',
    extent: { w: 2, d: 2, h: 1 },
    vertices: 68,
  },
  /** A cabinet with the sink let into its top and a tap rising 0.8 of a cabinet above it. */
  sink: {
    file: 'kitchencounter_sink.glb',
    extent: { w: 2, d: 2.041903, h: 1.801626 },
    vertices: 787,
  },
} as const satisfies Record<string, CounterFile>;

/** The stove's hob, made to stand on a counter cabinet: its burners from y 0.93 to 1.208, so it starts 0.07 of a cabinet below the cabinet's top. */
const HOB = {
  file: 'stove_single_countertop.glb',
  extent: { w: 1.746, d: 1.746, h: 1.207688 },
  base: 0.93,
  vertices: 497,
} as const satisfies CounterFile & { readonly base: number };

/** A cell of a counter run: a file by name, or `stove`, an `A` cabinet with the hob on it. */
type Cell = keyof typeof COUNTER_FILES | 'stove';

/**
 * A kitchen counter run, `length` metres long and `COUNTER_DEPTH` deep, built of `cells` laid
 * end to end from its west end (its north end, for a run facing west). A `corner` cell is a
 * square, turned to face the west as well as the north, into the room from the room's corner;
 * the others share what is left of the run equally and are turned to `faces`, the way the run's
 * fronts face. Every file is scaled so its cabinet's top stands at `COUNTER_TOP`, a tap or a
 * hob rising above it as the file draws them, and centred on its cell.
 */
function counterRun(faces: Facing, length: number, cells: readonly Cell[]): PackModel {
  const lengthwise = faces === 'north' || faces === 'south';
  const squares = cells.filter((cell) => cell === 'corner').length;
  const span = (length - squares * COUNTER_DEPTH) / (cells.length - squares);
  let start = -length / 2;
  const parts = cells.flatMap((cell): PackPart[] => {
    const run = cell === 'corner' ? COUNTER_DEPTH : span;
    const at = lengthwise ? { x: start + run / 2, y: 0 } : { x: 0, y: start + run / 2 };
    start += run;
    const [w, d] = lengthwise ? [run, COUNTER_DEPTH] : [COUNTER_DEPTH, run];
    const { file, extent, vertices } = COUNTER_FILES[cell === 'stove' ? 'A' : cell];
    const cabinet: PackPart = {
      file,
      extent,
      faces: cell === 'corner' ? 'west' : faces,
      size: { w, d, h: COUNTER_TOP * extent.h },
      vertices,
      at,
    };
    if (cell !== 'stove') return [cabinet];
    const hob: PackPart = {
      ...HOB,
      faces,
      size: {
        w: (w * HOB.extent.w) / CELL_SPAN,
        d: (d * HOB.extent.d) / CELL_SPAN,
        h: COUNTER_TOP * HOB.extent.h,
      },
      at,
    };
    return [cabinet, hob];
  });
  const [w, d] = lengthwise ? [length, COUNTER_DEPTH] : [COUNTER_DEPTH, length];
  return { atlas: 'restaurant', size: { w, d, h: COUNTER_TOP }, parts };
}

/**
 * The model of each kind, the closest of the pack to the piece's footprint and height, with the
 * file's size in metres (width x height x depth) beside the piece's:
 * the lounge's side table (0.5 m square, 0.375 m) is the 1 m cube of `table_small`; the
 * study's desk (1.0 x 0.5 m, 0.65 m) is `table_medium_long`, a 3 x 2 m table; the low
 * bookcase (1.5 x 0.5 m, 0.5625 m) is `cabinet_medium`, a 2 x 1 x 1 m cabinet, the one
 * floor piece of the pack with a flat top wide enough for it and doors for a front; the
 * sofa (0.875 x 1.875 m, 0.9375 m) is `couch`, 3 x 1.224 x 1.6 m, turned to face east; the
 * armchair (0.75 m square, 0.9375 m) is `armchair`, 1.8 x 1.224 x 1.6 m, turned to face west;
 * the coffee table (0.625 x 1 m, 0.375 m) is `table_low`, 2.4 x 0.5 x 1.5 m, turned a quarter
 * so its long side runs north-south and drawn at three quarters of its height; the floor
 * lamp (0.4375 m square, 1.5 m) is `lamp_standing`, 1 x 2.52 x 1 m. The tall bookcase stays
 * code-made: the pack's `shelf_*` models are 2 x 0.4 x 0.5 m wall planks that start below the
 * floor and have no body to stand on.
 *
 * The hallway's runner (1.875 x 0.75 m, flat) is `rug_rectangle_A`, a 3 x 2 m rug 0.1 m thick,
 * stretched to the runner's footprint and pressed to `RUG_THICKNESS`, so it lies on the floor
 * and is walked over.
 *
 * The kitchen counter is two runs of Restaurant Bits cells, each 0.625 m deep and 0.9375 m high, every
 * cell a 2 x 1 x 2 m file scaled to its place. The south run (3 x 0.625 m, fronts to the
 * north) is, from the west, a cabinet, the sink, a cabinet, a cabinet with the hob on it and
 * the corner cell: the four cabinets 0.59375 m wide each, the corner 0.625 m square, set at
 * the run's east end where the east run begins. The east run (0.625 x 1.875 m, fronts to the
 * west) is three cabinets of 0.625 m from the north end down to the corner cell, which is the
 * south run's. The corner's fronts face the north and the west, into the room.
 */
export const PACK_MODELS: Readonly<Record<PackKind, PackModel>> = {
  side_table: whole(
    'table_small.glb',
    { w: 1, d: 1, h: 1 },
    'south',
    { w: 0.5, d: 0.5, h: 0.375 },
    260,
  ),
  desk: whole(
    'table_medium_long.glb',
    { w: 3, d: 2, h: 1 },
    'south',
    { w: 1, d: 0.5, h: 0.65 },
    260,
  ),
  low_bookcase: whole(
    'cabinet_medium.glb',
    { w: 2, d: 1.00156, h: 1 },
    'south',
    { w: 1.5, d: 0.5, h: 0.5625 },
    648,
  ),
  sofa: whole(
    'couch.glb',
    { w: 3, d: 1.6, h: 1.22406 },
    'east',
    { w: 0.875, d: 1.875, h: 0.9375 },
    550,
    0.5,
  ),
  armchair: whole(
    'armchair.glb',
    { w: 1.8, d: 1.6, h: 1.22406 },
    'west',
    { w: 0.75, d: 0.75, h: 0.9375 },
    442,
    0.5,
  ),
  coffee_table: whole(
    'table_low.glb',
    { w: 2.4, d: 1.5, h: 0.5 },
    'east',
    { w: 0.625, d: 1, h: 0.375 },
    336,
  ),
  floor_lamp: whole(
    'lamp_standing.glb',
    { w: 1, d: 1, h: 2.52 },
    'south',
    { w: 0.4375, d: 0.4375, h: 1.5 },
    304,
  ),
  counter: counterRun('north', 3, ['A', 'sink', 'B', 'stove', 'corner']),
  counter_v: counterRun('west', 1.875, ['B', 'A', 'B']),
  runner_rug: {
    ...whole(
      'rug_rectangle_A.glb',
      { w: 3, d: 2, h: 0.1 },
      'south',
      { w: 1.875, d: 0.75, h: RUG_THICKNESS },
      48,
    ),
    flat: true,
  },
};

/** The vertices a model draws: its parts' files', each counted once. */
export function packVertices(model: PackModel): number {
  return model.parts.reduce((sum, part) => sum + part.vertices, 0);
}

/** The height of a seat's cushion over the floor as the piece is drawn, metres: the model's `seat`, scaled to the piece's height. */
export function seatHeight(model: PackModel): number {
  const [part] = model.parts;
  if (model.seat === undefined || part === undefined) throw new Error('not a seat');
  return (model.seat * model.size.h) / part.extent.h;
}

/** Whether `kind` is drawn from a pack model. */
export function isPackKind(kind: string): kind is PackKind {
  return kind in PACK_MODELS;
}

/** A model's mesh in Babylon's frame (left-handed, y up), ready for a vertex buffer. */
export interface PackGeometry {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
}

/**
 * The first primitive of `glb`'s first mesh as Babylon draws it, for `part`. glTF's frame is
 * right-handed with the model's front on +z, which is the plan's south, toward a camera in the
 * south. The mesh is centred over its footprint, turned about the vertical to the part's `faces`
 * (a half turn to the north; a quarter turn to the east takes the file's front, +z, to +x; to
 * the west, to -x) and scaled per axis from its extent to the part's `size`, then set `at` its
 * place in the piece; normals take the turn and the inverse transpose of the scale,
 * renormalised. Negating z turns the plan's frame into Babylon's, with the front on -z; the
 * mirror turns glTF's counter-clockwise front faces into Babylon's clockwise ones, so the
 * indices are kept. Texture coordinates start at the image's top in both, so they are kept.
 */
export function partGeometry(glb: Glb, part: PackPart): PackGeometry {
  const primitive = glb.json.meshes?.[0]?.primitives[0];
  if (primitive?.indices === undefined) throw new Error('the model has no mesh');
  const { POSITION, NORMAL, TEXCOORD_0 } = primitive.attributes;
  if (POSITION === undefined || NORMAL === undefined || TEXCOORD_0 === undefined) {
    throw new Error('the model lacks positions, normals or texture coordinates');
  }
  const positions = accessorFloats(glb, POSITION);
  const normals = accessorFloats(glb, NORMAL);
  const { extent, size, faces, at } = part;
  const quarter = faces === 'east' || faces === 'west';
  const [sx, sy, sd] = [
    size.w / (quarter ? extent.d : extent.w),
    size.h / extent.h,
    size.d / (quarter ? extent.w : extent.d),
  ];
  const middle = (k: number): number => {
    const values = positions.filter((_, i) => i % 3 === k);
    return (Math.min(...values) + Math.max(...values)) / 2;
  };
  const [mx, mz] = [middle(0), middle(2)];
  // The file's (x, z) as the plan's (x, y): turned about the vertical to face `faces`.
  const turn = (x: number, z: number): [number, number] => {
    switch (faces) {
      case 'east':
        return [z, -x];
      case 'west':
        return [-z, x];
      case 'north':
        return [-x, -z];
      case 'south':
        return [x, z];
    }
  };
  for (let i = 0; i < positions.length; i += 3) {
    const [px, py] = turn((positions[i] ?? 0) - mx, (positions[i + 2] ?? 0) - mz);
    const [nx, nz] = turn(normals[i] ?? 0, normals[i + 2] ?? 0);
    const n = [nx / sx, (normals[i + 1] ?? 0) / sy, -nz / sd];
    const length = Math.hypot(...n) || 1;
    positions[i] = px * sx + at.x;
    positions[i + 1] = (positions[i + 1] ?? 0) * sy;
    positions[i + 2] = -(py * sd + at.y);
    for (let k = 0; k < 3; k++) normals[i + k] = (n[k] ?? 0) / length;
  }
  return {
    positions,
    normals,
    uvs: accessorFloats(glb, TEXCOORD_0),
    indices: accessorIndices(glb, primitive.indices),
  };
}

/** A model's mesh: each of its parts from `glbs` (each file's `Glb` by its name), merged into one. */
export function packGeometry(model: PackModel, glbs: Readonly<Record<string, Glb>>): PackGeometry {
  const parts = model.parts.map((part) => {
    const glb = glbs[part.file];
    if (glb === undefined) throw new Error(`no ${part.file}`);
    return partGeometry(glb, part);
  });
  const sum = (of: (part: PackGeometry) => number): number =>
    parts.reduce((total, part) => total + of(part), 0);
  const merged = {
    positions: new Float32Array(sum((p) => p.positions.length)),
    normals: new Float32Array(sum((p) => p.normals.length)),
    uvs: new Float32Array(sum((p) => p.uvs.length)),
    indices: new Uint32Array(sum((p) => p.indices.length)),
  };
  let vertex = 0;
  let index = 0;
  for (const part of parts) {
    merged.positions.set(part.positions, vertex * 3);
    merged.normals.set(part.normals, vertex * 3);
    merged.uvs.set(part.uvs, vertex * 2);
    part.indices.forEach((i, n) => {
      merged.indices[index + n] = i + vertex;
    });
    vertex += part.positions.length / 3;
    index += part.indices.length;
  }
  return merged;
}
