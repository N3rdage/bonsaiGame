import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import { createTree } from '../sim/tree';
import { HALLWAY_ROOM, RUNNER } from '../world/hallwayRoom';
import { LOUNGE_ROOM } from '../world/loungeRoom';
import type { Room } from '../world/shedRoom';
import { STUDY_ROOM } from '../world/studyRoom';
import { furniturePieces } from './furniture';
import { FURNITURE_FILES } from './furnitureFiles';
import { FURNITURE_MODELS, MODELLED_SHEETS } from './furnitureModels';
import { accessorFloats, readGlb, type Glb } from './glb';
import {
  COUNTER_DEPTH,
  COUNTER_TOP,
  RUG_THICKNESS,
  PACK_MODELS,
  packGeometry,
  packVertices,
  partGeometry,
  seatHeight,
  type PackKind,
  type PackModel,
  type PackPart,
} from './packModels';
import { SEAT_HEIGHT } from './seats';
import { FLAT_THICKNESS, heightMetres, roomPlan3d } from './plan';
import { treeStands } from './trees';

const KINDS = Object.keys(PACK_MODELS) as PackKind[];

/** Where each kind stands: its room, its sheet and, for the pieces that carry one, the display spot on it. */
const HOMES: Readonly<
  Record<PackKind, { room: Room; spot?: string; sheet: string; solid?: boolean }>
> = {
  side_table: { room: LOUNGE_ROOM, spot: 'lounge_side_table', sheet: 'spr_side_table' },
  desk: { room: STUDY_ROOM, spot: 'study_desk', sheet: 'spr_desk' },
  low_bookcase: { room: STUDY_ROOM, spot: 'study_bookshelf', sheet: 'spr_bookshelf' },
  sofa: { room: LOUNGE_ROOM, sheet: 'spr_sofa' },
  armchair: { room: LOUNGE_ROOM, sheet: 'spr_armchair' },
  coffee_table: { room: LOUNGE_ROOM, sheet: 'spr_coffee_table' },
  floor_lamp: { room: LOUNGE_ROOM, sheet: 'spr_floor_lamp' },
  counter: { room: LOUNGE_ROOM, sheet: 'spr_counter' },
  counter_v: { room: LOUNGE_ROOM, sheet: 'spr_counter_v' },
  runner_rug: { room: HALLWAY_ROOM, sheet: 'spr_runner', solid: false },
};

/** The kinds that carry a display spot: a tree stands on their top. */
const DISPLAY_KINDS = KINDS.filter((kind) => HOMES[kind].spot !== undefined);

/** The kinds made of several files: the kitchen counter's two runs. */
const RUN_KINDS = KINDS.filter((kind) => PACK_MODELS[kind].parts.length > 1);

const FOLDERS = {
  furniture: new URL('./furniture/', import.meta.url),
  restaurant: new URL('./restaurant/', import.meta.url),
} as const;

function loadPart(model: PackModel, part: PackPart): Glb {
  const bytes = readFileSync(new URL(part.file, FOLDERS[model.atlas]));
  return readGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

/** Each file of the kind's model, by name. */
function glbsOf(kind: PackKind): Record<string, Glb> {
  const model = PACK_MODELS[kind];
  return Object.fromEntries(model.parts.map((part) => [part.file, loadPart(model, part)]));
}

/** The model's bounds as its file's POSITION accessor gives them. */
function bounds(glb: Glb): { min: readonly number[]; max: readonly number[] } {
  const index = glb.json.meshes?.[0]?.primitives[0]?.attributes.POSITION ?? -1;
  const accessor = glb.json.accessors?.[index];
  return { min: accessor?.min ?? [], max: accessor?.max ?? [] };
}

/** The piece of `kind` in its room. */
function pieceOf(kind: PackKind) {
  const piece = furniturePieces(HOMES[kind].room).find((p) => p.kind === kind);
  if (!piece) throw new Error(`no ${kind} piece`);
  return piece;
}

/** The values of one axis (0 x, 1 y, 2 z) of a flat position array. */
const axisOf = (positions: Float32Array, k: number): number[] =>
  Array.from(positions).filter((_, i) => i % 3 === k);

/** Every part of every model, to be checked against its own file. */
const PARTS = KINDS.flatMap((kind) =>
  PACK_MODELS[kind].parts.map((part, n) => ({ kind, n, part, name: `${kind} ${part.file}` })),
);

describe.each(PARTS)('the $name pack part', ({ kind, part }) => {
  const model = PACK_MODELS[kind];
  const glb = loadPart(model, part);
  const { min, max } = bounds(glb);

  it('is one mesh of one primitive, so a piece is one draw call', () => {
    expect(glb.json.meshes).toHaveLength(1);
    expect(glb.json.meshes?.[0]?.primitives).toHaveLength(1);
  });

  it("has the file's extent as its size and its feet on the floor, or on the part it rests on", () => {
    expect((max[0] ?? 0) - (min[0] ?? 0)).toBeCloseTo(part.extent.w, 4);
    expect((max[2] ?? 0) - (min[2] ?? 0)).toBeCloseTo(part.extent.d, 4);
    expect(max[1] ?? 0).toBeCloseTo(part.extent.h, 4);
    expect(min[1] ?? 1).toBeCloseTo(part.base ?? 0, 6);
  });

  it("draws the file's vertices", () => {
    const geometry = partGeometry(glb, part);
    expect(geometry.positions.length / 3).toBe(part.vertices);
    expect(geometry.normals).toHaveLength(geometry.positions.length);
    expect(geometry.uvs.length / 2).toBe(part.vertices);
    expect(Math.max(...geometry.indices)).toBeLessThan(part.vertices);
  });

  it("is turned into Babylon's frame: front the way the part faces, centred on its place, every face wound as CreateBox does", () => {
    const { positions, normals, indices } = partGeometry(glb, part);
    // The file's front is +z. Babylon's south, toward the camera, is -z and its east +x: the
    // file's frontmost vertex is the part's southmost, northmost, eastmost or westmost, by `faces`.
    const raw = accessorFloats(glb, glb.json.meshes?.[0]?.primitives[0]?.attributes.POSITION ?? -1);
    let front = 0;
    for (let i = 0; i < raw.length / 3; i++) {
      if ((raw[i * 3 + 2] ?? 0) > (raw[front * 3 + 2] ?? 0)) front = i;
    }
    const [xs, zs] = [axisOf(positions, 0), axisOf(positions, 2)];
    const frontAt = {
      south: [positions[front * 3 + 2], Math.min(...zs)],
      north: [positions[front * 3 + 2], Math.max(...zs)],
      east: [positions[front * 3], Math.max(...xs)],
      west: [positions[front * 3], Math.min(...xs)],
    }[part.faces];
    expect(frontAt[0]).toBeCloseTo(frontAt[1] ?? 0, 3);
    // The plan's y is south; Babylon's z is north.
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(part.at.x, 5);
    expect((Math.max(...zs) + Math.min(...zs)) / 2).toBeCloseTo(-part.at.y, 5);
    for (let t = 0; t < indices.length; t += 3) {
      const [a = 0, b = 0, c = 0] = [indices[t], indices[t + 1], indices[t + 2]];
      const at = (i: number, k: number): number => positions[i * 3 + k] ?? 0;
      const u = [0, 1, 2].map((k) => at(b, k) - at(a, k));
      const v = [0, 1, 2].map((k) => at(c, k) - at(a, k));
      const cross = [
        (u[1] ?? 0) * (v[2] ?? 0) - (u[2] ?? 0) * (v[1] ?? 0),
        (u[2] ?? 0) * (v[0] ?? 0) - (u[0] ?? 0) * (v[2] ?? 0),
        (u[0] ?? 0) * (v[1] ?? 0) - (u[1] ?? 0) * (v[0] ?? 0),
      ];
      const n = [0, 1, 2].map((k) => normals[a * 3 + k] ?? 0);
      // Babylon's front face is clockwise by the right-hand rule: the cross product runs against the normal.
      const along = cross.reduce((sum, value, k) => sum + value * (n[k] ?? 0), 0);
      expect(along).toBeLessThanOrEqual(1e-9);
    }
  });

  it('has unit normals', () => {
    const { normals } = partGeometry(glb, part);
    for (let i = 0; i < normals.length; i += 3) {
      expect(Math.hypot(normals[i] ?? 0, normals[i + 1] ?? 0, normals[i + 2] ?? 0)).toBeCloseTo(
        1,
        5,
      );
    }
  });

  it("is scaled to the part's own size, its base on the floor when it stands there", () => {
    const { positions } = partGeometry(glb, part);
    const [xs, ys, zs] = [0, 1, 2].map((k) => axisOf(positions, k));
    const spread = (values: number[] | undefined): number =>
      Math.max(...(values ?? [])) - Math.min(...(values ?? []));
    expect(spread(xs)).toBeCloseTo(part.size.w, 5);
    expect(spread(zs)).toBeCloseTo(part.size.d, 5);
    expect(Math.max(...(ys ?? []))).toBeCloseTo(part.size.h, 5);
    expect(Math.min(...(ys ?? []))).toBeCloseTo(
      ((part.base ?? 0) * part.size.h) / part.extent.h,
      6,
    );
  });
});

describe.each(KINDS)('the %s pack model', (kind) => {
  const model = PACK_MODELS[kind];
  const glbs = glbsOf(kind);

  it("draws its files' vertices in one mesh, with the box drawn meanwhile at the model's size", () => {
    const geometry = packGeometry(model, glbs);
    const vertices = packVertices(model);
    expect(geometry.positions.length / 3).toBe(vertices);
    expect(geometry.normals).toHaveLength(geometry.positions.length);
    expect(geometry.uvs.length / 2).toBe(vertices);
    expect(Math.max(...geometry.indices)).toBe(vertices - 1);
    expect(geometry.indices.length % 3).toBe(0);
    const { size, parts } = FURNITURE_MODELS[kind];
    expect(size).toEqual(model.size);
    expect(parts).toEqual([
      {
        object: 'wood',
        x0: -size.w / 2,
        x1: size.w / 2,
        y0: -size.d / 2,
        y1: size.d / 2,
        z0: 0,
        z1: size.h,
      },
    ]);
  });

  it("is drawn at its piece's own size, so its instance scale is 1 and its ink is as thick as the code-made kinds'", () => {
    const piece = pieceOf(kind);
    const { size } = FURNITURE_MODELS[kind];
    expect([piece.w / size.w, piece.h / size.h, piece.d / size.d]).toEqual([1, 1, 1]);
    expect(model.size).toEqual({ w: piece.w, d: piece.d, h: piece.h });
    const { positions } = packGeometry(model, glbs);
    const [xs, ys, zs] = [0, 1, 2].map((k) => axisOf(positions, k));
    const spread = (values: number[] | undefined): number =>
      Math.max(...(values ?? [])) - Math.min(...(values ?? []));
    expect(spread(xs)).toBeCloseTo(piece.w, 5);
    expect(spread(zs)).toBeCloseTo(piece.d, 5);
    expect(Math.min(...(ys ?? []))).toBeCloseTo(0, 6);
    // A tap or a hob rises over the piece's height; nothing else does.
    const top = Math.max(...(ys ?? []));
    if (model.parts.length === 1) expect(top).toBeCloseTo(piece.h, 5);
    else expect(top).toBeGreaterThanOrEqual(piece.h - 1e-6);
  });

  it('is still the box it was in the plan, solid or not, so the player collides as before', () => {
    const { room, sheet } = HOMES[kind];
    expect(MODELLED_SHEETS[sheet]).toBe(kind);
    const piece = pieceOf(kind);
    const [box] = roomPlan3d(room).furniture.filter((b) => b.model === kind);
    expect(box?.solid).toBe(HOMES[kind].solid ?? true);
    expect([box?.x0, box?.x1, box?.y0, box?.y1]).toEqual([
      piece.x - piece.w / 2,
      piece.x + piece.w / 2,
      piece.y - piece.d / 2,
      piece.y + piece.d / 2,
    ]);
    expect(room.furniture.find((f) => f.sheet.key === sheet)?.solid).toBe(
      HOMES[kind].solid ?? true,
    );
  });
});

describe('the kitchen counter runs', () => {
  /** The cabinets of a run, in order: every part that stands on the floor. */
  const cabinets = (kind: PackKind): readonly PackPart[] =>
    PACK_MODELS[kind].parts.filter((part) => part.base === undefined);

  it('are the two runs of the lounge, each a model of several files', () => {
    expect(RUN_KINDS).toEqual(['counter', 'counter_v']);
    expect(HOMES.counter.sheet).toBe('spr_counter');
    expect(HOMES.counter_v.sheet).toBe('spr_counter_v');
  });

  it('stand as high as the 2D sheets: 20 px, 0.9375 m, and 0.625 m deep', () => {
    expect(COUNTER_TOP).toBe(heightMetres(20));
    expect(COUNTER_DEPTH).toBe(0.625);
    for (const kind of RUN_KINDS) {
      expect(pieceOf(kind).h).toBe(COUNTER_TOP);
      expect(PACK_MODELS[kind].size.h).toBe(COUNTER_TOP);
    }
    expect(pieceOf('counter')).toMatchObject({ w: 3, d: COUNTER_DEPTH });
    expect(pieceOf('counter_v')).toMatchObject({ w: COUNTER_DEPTH, d: 1.875 });
  });

  it('lay the south run out from the west: a cabinet, the sink, a cabinet, a cabinet with the hob, the corner', () => {
    const parts = PACK_MODELS.counter.parts;
    expect(parts.map((part) => part.file)).toEqual([
      'kitchencounter_straight_A.glb',
      'kitchencounter_sink.glb',
      'kitchencounter_straight_B.glb',
      'kitchencounter_straight_A.glb',
      'stove_single_countertop.glb',
      'kitchencounter_outercorner.glb',
    ]);
    expect(parts.map((part) => part.faces)).toEqual([
      'north',
      'north',
      'north',
      'north',
      'north',
      'west',
    ]);
    expect(parts.map((part) => part.at.x)).toEqual([
      -1.203125, -0.609375, -0.015625, 0.578125, 0.578125, 1.1875,
    ]);
    expect(parts.every((part) => part.at.y === 0)).toBe(true);
    expect(parts.map((part) => part.size.w)).toEqual([
      0.59375,
      0.59375,
      0.59375,
      0.59375,
      0.59375 * (1.746 / 2),
      COUNTER_DEPTH,
    ]);
    expect(PACK_MODELS.counter.parts.map((part) => part.size.d)).toEqual([
      ...Array<number>(4).fill(COUNTER_DEPTH),
      COUNTER_DEPTH * (1.746 / 2),
      COUNTER_DEPTH,
    ]);
  });

  it('lay the east run out from the north: three cabinets facing west', () => {
    const parts = PACK_MODELS.counter_v.parts;
    expect(parts.map((part) => part.file)).toEqual([
      'kitchencounter_straight_B.glb',
      'kitchencounter_straight_A.glb',
      'kitchencounter_straight_B.glb',
    ]);
    expect(parts.every((part) => part.faces === 'west')).toBe(true);
    expect(parts.map((part) => part.at)).toEqual([
      { x: 0, y: -0.625 },
      { x: 0, y: 0 },
      { x: 0, y: 0.625 },
    ]);
    expect(parts.every((part) => part.size.w === COUNTER_DEPTH && part.size.d === 0.625)).toBe(
      true,
    );
  });

  it.each(RUN_KINDS)('tile the %s end to end with no gap and no overlap', (kind) => {
    const model = PACK_MODELS[kind];
    const lengthwise = model.size.w > model.size.d;
    const edges = cabinets(kind).map((part) => {
      const [centre, length] = lengthwise ? [part.at.x, part.size.w] : [part.at.y, part.size.d];
      return [centre - length / 2, centre + length / 2] as const;
    });
    const run = lengthwise ? model.size.w : model.size.d;
    expect(edges[0]?.[0]).toBeCloseTo(-run / 2, 9);
    expect(edges.at(-1)?.[1]).toBeCloseTo(run / 2, 9);
    edges.slice(1).forEach(([from], n) => {
      expect(from).toBeCloseTo(edges[n]?.[1] ?? NaN, 9);
    });
    for (const part of cabinets(kind)) {
      expect(lengthwise ? part.size.d : part.size.w).toBe(COUNTER_DEPTH);
      expect(part.size.h).toBeCloseTo(COUNTER_TOP * part.extent.h, 9);
    }
  });

  it('put the counter top at 0.9375 m on every cabinet, the corner and the plain ones', () => {
    for (const kind of RUN_KINDS) {
      const model = PACK_MODELS[kind];
      for (const part of cabinets(kind).filter((p) => p.extent.h === 1)) {
        const { positions, normals } = partGeometry(loadPart(model, part), part);
        const top = Math.max(...axisOf(positions, 1));
        expect(top).toBeCloseTo(COUNTER_TOP, 6);
        const level = Array.from({ length: positions.length / 3 }, (_, i) => i).filter(
          (i) =>
            Math.abs((positions[i * 3 + 1] ?? 0) - top) < 1e-6 && (normals[i * 3 + 1] ?? 0) > 0.99,
        );
        expect(level.length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('rise above the counter top only at the tap and the hob, which stand within their own cabinets', () => {
    const { parts } = PACK_MODELS.counter;
    const tall = parts.filter((part) => part.extent.h !== 1);
    expect(tall.map((part) => part.file)).toEqual([
      'kitchencounter_sink.glb',
      'stove_single_countertop.glb',
    ]);
    expect(tall.map((part) => part.size.h)).toEqual([
      COUNTER_TOP * 1.801626,
      COUNTER_TOP * 1.207688,
    ]);
    const [cabinet, hob] = parts.slice(3, 5);
    if (cabinet === undefined || hob === undefined) throw new Error('no hob');
    expect(hob.at).toEqual(cabinet.at);
    expect(hob.base).toBe(0.93);
    expect(hob.size.w).toBeLessThan(cabinet.size.w);
    expect(hob.size.d).toBeLessThan(cabinet.size.d);
    // The hob's burners start just under the cabinet's top: it stands on it, not in the air.
    const { positions } = partGeometry(loadPart(PACK_MODELS.counter, hob), hob);
    expect(Math.min(...axisOf(positions, 1))).toBeLessThan(COUNTER_TOP);
    expect(Math.min(...axisOf(positions, 1))).toBeGreaterThan(COUNTER_TOP * 0.9);
    expect(PACK_MODELS.counter_v.parts.every((part) => part.extent.h === 1)).toBe(true);
  });

  it('draw 2,034 vertices in the south run and 671 in the east run', () => {
    expect(packVertices(PACK_MODELS.counter)).toBe(2034);
    expect(packVertices(PACK_MODELS.counter_v)).toBe(671);
  });
});

describe.each(DISPLAY_KINDS)('the %s, a display spot', (kind) => {
  const model = PACK_MODELS[kind];

  it('has a flat top at its full height that spans most of its footprint', () => {
    const { positions, normals } = packGeometry(model, glbsOf(kind));
    const top = [...Array.from({ length: positions.length / 3 }, (_, i) => i)].filter(
      (i) => Math.abs((positions[i * 3 + 1] ?? 0) - model.size.h) < 1e-6,
    );
    expect(top.length).toBeGreaterThanOrEqual(4);
    for (const i of top) expect(normals[i * 3 + 1]).toBeGreaterThan(0.5);
    const xs = top.map((i) => positions[i * 3] ?? 0);
    const zs = top.map((i) => positions[i * 3 + 2] ?? 0);
    expect((Math.max(...xs) - Math.min(...xs)) / model.size.w).toBeGreaterThan(0.9);
    expect((Math.max(...zs) - Math.min(...zs)) / model.size.d).toBeGreaterThan(0.9);
  });

  it("stands the tree on the model's top, over its spot", () => {
    const { room, spot = 'none' } = HOMES[kind];
    const piece = pieceOf(kind);
    const state = createNewGameState();
    state.trees = [{ ...createTree('juniper', 'cutting', 0), location: `displayed:${spot}` }];
    const [stand] = treeStands(state, room, 'spring');
    expect(stand?.z).toBeCloseTo(model.size.h, 9);
    expect(Math.abs((stand?.x ?? 0) - piece.x)).toBeLessThan(piece.w / 2);
    expect(Math.abs((stand?.y ?? 0) - piece.y)).toBeLessThan(piece.d / 2);
  });
});

describe('the seats', () => {
  const SEATS = ['sofa', 'armchair'] as const;

  it.each(SEATS)(
    "has the %s's cushion at its measured height, as the sitter's hips rest on it",
    (kind) => {
      const model = PACK_MODELS[kind];
      const { positions, normals } = packGeometry(model, glbsOf(kind));
      // The cushion's flat top is up-facing vertices at the seat height that span most of the
      // piece's width (north-south) and, front to back, over half its depth.
      const height = seatHeight(model);
      const flat = Array.from({ length: positions.length / 3 }, (_, i) => i).filter(
        (i) =>
          Math.abs((positions[i * 3 + 1] ?? 0) - height) < 0.002 && (normals[i * 3 + 1] ?? 0) > 0.9,
      );
      expect(flat.length).toBeGreaterThanOrEqual(4);
      const across = flat.map((i) => positions[i * 3 + 2] ?? 0);
      const deep = flat.map((i) => positions[i * 3] ?? 0);
      expect((Math.max(...across) - Math.min(...across)) / model.size.d).toBeGreaterThan(0.5);
      expect((Math.max(...deep) - Math.min(...deep)) / model.size.w).toBeGreaterThan(0.5);
      expect(height).toBeCloseTo(
        ((model.seat ?? 0) / (model.parts[0]?.extent.h ?? 1)) * model.size.h,
        9,
      );
    },
  );

  it('is the same on both seats, which seats.ts uses, and well under the drawn height', () => {
    expect(seatHeight(PACK_MODELS.sofa)).toBeCloseTo(seatHeight(PACK_MODELS.armchair), 9);
    expect(SEAT_HEIGHT).toBe(seatHeight(PACK_MODELS.sofa));
    expect(SEAT_HEIGHT).toBeCloseTo(0.3829, 4);
    expect(SEAT_HEIGHT).toBeLessThan(PACK_MODELS.sofa.size.h / 2);
  });

  it('is not defined for a piece that is not a seat', () => {
    expect(() => seatHeight(PACK_MODELS.desk)).toThrow();
  });
});

describe('the pack furniture', () => {
  it("keeps each piece's drawn height: the side table and bookcase at their frames', the desk at the study's", () => {
    expect(pieceOf('side_table').h).toBe(heightMetres(8));
    expect(pieceOf('desk').h).toBe(0.65);
    expect(pieceOf('low_bookcase').h).toBe(heightMetres(12));
  });

  it.each(['furniture', 'restaurant'] as const)(
    "ships the %s pack's models a room draws, its atlas and its licence, and nothing else",
    (atlas) => {
      const files = new Set(
        KINDS.filter((kind) => PACK_MODELS[kind].atlas === atlas).flatMap((kind) =>
          PACK_MODELS[kind].parts.map((part) => part.file),
        ),
      );
      const licence = `LICENSE-KayKit-${atlas === 'furniture' ? 'Furniture' : 'Restaurant'}.txt`;
      expect(readdirSync(FOLDERS[atlas]).sort()).toEqual(
        [licence, `${atlas}bits_texture.png`, ...files].sort(),
      );
      expect(existsSync(new URL(licence, FOLDERS[atlas]))).toBe(true);
    },
  );

  it('lists every file the models use for the loader, and no other', () => {
    const files = KINDS.flatMap((kind) => PACK_MODELS[kind].parts.map((part) => part.file));
    expect(Object.keys(FURNITURE_FILES.models).sort()).toEqual([...new Set(files)].sort());
    expect(Object.keys(FURNITURE_FILES.textures).sort()).toEqual(['furniture', 'restaurant']);
  });
});

describe("the hallway's runner rug", () => {
  const model = PACK_MODELS.runner_rug;
  const [part] = model.parts;

  it("is the pack's rug_rectangle_A: a 3 x 2 x 0.1 m file of 48 vertices", () => {
    expect(model.atlas).toBe('furniture');
    expect(model.parts).toHaveLength(1);
    expect(part?.file).toBe('rug_rectangle_A.glb');
    expect(part?.extent).toEqual({ w: 3, d: 2, h: 0.1 });
    expect(packVertices(model)).toBe(48);
    expect(FURNITURE_FILES.models['rug_rectangle_A.glb']).toBeDefined();
  });

  it("lies flat over the runner's footprint, as thick as every flat piece, and is not solid", () => {
    const [box] = roomPlan3d(HALLWAY_ROOM).furniture.filter((b) => b.model === 'runner_rug');
    expect(RUG_THICKNESS).toBe(FLAT_THICKNESS);
    expect(model.size).toEqual({ w: 1.875, d: 0.75, h: FLAT_THICKNESS });
    expect(box).toMatchObject({ z0: 0, z1: FLAT_THICKNESS, solid: false });
    expect(box?.x0).toBeCloseTo(RUNNER.x / 32, 9);
    expect((box?.x1 ?? 0) - (box?.x0 ?? 0)).toBeCloseTo(1.875, 9);
    expect((box?.y1 ?? 0) - (box?.y0 ?? 0)).toBeCloseTo(0.75, 9);
    const { positions } = packGeometry(model, glbsOf('runner_rug'));
    const ys = axisOf(positions, 1);
    expect(Math.min(...ys)).toBeCloseTo(0, 9);
    expect(Math.max(...ys)).toBeCloseTo(FLAT_THICKNESS, 6);
  });
});
