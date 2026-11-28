import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import { createTree } from '../sim/tree';
import { LOUNGE_ROOM } from '../world/loungeRoom';
import type { Room } from '../world/shedRoom';
import { STUDY_ROOM } from '../world/studyRoom';
import { furniturePieces } from './furniture';
import { FURNITURE_FILES } from './furnitureFiles';
import { FURNITURE_MODELS, MODELLED_SHEETS } from './furnitureModels';
import { accessorFloats, readGlb, type Glb } from './glb';
import { PACK_MODELS, packGeometry, type PackKind } from './packModels';
import { heightMetres, roomPlan3d } from './plan';
import { treeStands } from './trees';

const KINDS = Object.keys(PACK_MODELS) as PackKind[];

/** Where each kind stands: its room, and the display spot on it. */
const HOMES: Readonly<Record<PackKind, { room: Room; spot: string; sheet: string }>> = {
  side_table: { room: LOUNGE_ROOM, spot: 'lounge_side_table', sheet: 'spr_side_table' },
  desk: { room: STUDY_ROOM, spot: 'study_desk', sheet: 'spr_desk' },
  low_bookcase: { room: STUDY_ROOM, spot: 'study_bookshelf', sheet: 'spr_bookshelf' },
};

const DIR = new URL('./furniture/', import.meta.url);

function load(kind: PackKind): Glb {
  const bytes = readFileSync(new URL(PACK_MODELS[kind].file, DIR));
  return readGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
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

describe.each(KINDS)('the %s pack model', (kind) => {
  const model = PACK_MODELS[kind];
  const glb = load(kind);
  const { min, max } = bounds(glb);

  it('is one mesh of one primitive, so a piece is one draw call', () => {
    expect(glb.json.meshes).toHaveLength(1);
    expect(glb.json.meshes?.[0]?.primitives).toHaveLength(1);
  });

  it("has the file's extent as its size, its feet on the floor and its middle over the origin", () => {
    expect((max[0] ?? 0) - (min[0] ?? 0)).toBeCloseTo(model.extent.w, 4);
    expect((max[2] ?? 0) - (min[2] ?? 0)).toBeCloseTo(model.extent.d, 4);
    expect((max[1] ?? 0) - (min[1] ?? 0)).toBeCloseTo(model.extent.h, 4);
    expect(min[1] ?? 1).toBeCloseTo(0, 6);
    expect(Math.abs(((max[0] ?? 0) + (min[0] ?? 0)) / 2)).toBeLessThan(0.001);
    expect(Math.abs(((max[2] ?? 0) + (min[2] ?? 0)) / 2)).toBeLessThan(0.001);
  });

  it("draws the file's vertices, with the box drawn meanwhile at the model's size", () => {
    const geometry = packGeometry(glb, model);
    expect(geometry.positions.length / 3).toBe(model.vertices);
    expect(geometry.normals).toHaveLength(geometry.positions.length);
    expect(geometry.uvs.length / 2).toBe(model.vertices);
    expect(Math.max(...geometry.indices)).toBeLessThan(model.vertices);
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

  it("is turned into Babylon's frame: front toward the camera, every face wound as CreateBox does", () => {
    const { positions, normals, indices } = packGeometry(glb, model);
    // The file's front is +z; Babylon's south, toward the camera, is -z: every vertex's z is
    // mirrored (and scaled), so the file's frontmost vertex is the model's southmost.
    const raw = accessorFloats(glb, glb.json.meshes?.[0]?.primitives[0]?.attributes.POSITION ?? -1);
    const zScale = model.size.d / model.extent.d;
    let front = 0;
    for (let i = 0; i < raw.length / 3; i++) {
      expect(positions[i * 3 + 2]).toBeCloseTo(-(raw[i * 3 + 2] ?? 0) * zScale, 6);
      if ((raw[i * 3 + 2] ?? 0) > (raw[front * 3 + 2] ?? 0)) front = i;
    }
    expect(positions[front * 3 + 2]).toBeCloseTo(-model.size.d / 2, 3);
    expect(Math.min(...positions.filter((_, i) => i % 3 === 2))).toBeCloseTo(-model.size.d / 2, 3);
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

  it('has a flat top at its full height that spans most of its footprint', () => {
    const { positions, normals } = packGeometry(glb, model);
    const top = [...Array.from({ length: positions.length / 3 }, (_, i) => i)].filter(
      (i) => Math.abs((positions[i * 3 + 1] ?? 0) - model.size.h) < 1e-6,
    );
    expect(top.length).toBeGreaterThanOrEqual(4);
    for (const i of top) expect(normals[i * 3 + 1]).toBeGreaterThan(0.5);
    for (let i = 0; i < normals.length; i += 3) {
      expect(Math.hypot(normals[i] ?? 0, normals[i + 1] ?? 0, normals[i + 2] ?? 0)).toBeCloseTo(
        1,
        5,
      );
    }
    const xs = top.map((i) => positions[i * 3] ?? 0);
    const zs = top.map((i) => positions[i * 3 + 2] ?? 0);
    expect((Math.max(...xs) - Math.min(...xs)) / model.size.w).toBeGreaterThan(0.9);
    expect((Math.max(...zs) - Math.min(...zs)) / model.size.d).toBeGreaterThan(0.9);
  });

  it("is drawn at its piece's own size, so its instance scale is 1 and its ink is as thick as the code-made kinds'", () => {
    const piece = pieceOf(kind);
    const { size } = FURNITURE_MODELS[kind];
    expect([piece.w / size.w, piece.h / size.h, piece.d / size.d]).toEqual([1, 1, 1]);
    expect(model.size).toEqual({ w: piece.w, d: piece.d, h: piece.h });
    const { positions } = packGeometry(glb, model);
    const axis = (k: number): Float32Array => positions.filter((_, i) => i % 3 === k);
    expect(Math.max(...axis(0)) - Math.min(...axis(0))).toBeCloseTo(piece.w, 5);
    expect(Math.max(...axis(1)) - Math.min(...axis(1))).toBeCloseTo(piece.h, 5);
    expect(Math.max(...axis(2)) - Math.min(...axis(2))).toBeCloseTo(piece.d, 5);
    expect(Math.min(...axis(1))).toBeCloseTo(0, 6);
  });

  it("stands the tree on the model's top, over its spot", () => {
    const { room, spot, sheet } = HOMES[kind];
    const piece = pieceOf(kind);
    const state = createNewGameState();
    state.trees = [{ ...createTree('juniper', 'cutting', 0), location: `displayed:${spot}` }];
    const [stand] = treeStands(state, room, 'spring');
    expect(stand?.z).toBeCloseTo(model.size.h, 9);
    expect(Math.abs((stand?.x ?? 0) - piece.x)).toBeLessThan(piece.w / 2);
    expect(Math.abs((stand?.y ?? 0) - piece.y)).toBeLessThan(piece.d / 2);
    expect(MODELLED_SHEETS[sheet]).toBe(kind);
  });

  it('is still a solid box in the plan, so the player collides as before', () => {
    const { room, sheet } = HOMES[kind];
    const piece = pieceOf(kind);
    const [box] = roomPlan3d(room).furniture.filter((b) => b.model === kind);
    expect(box?.solid).toBe(true);
    expect([box?.x0, box?.x1, box?.y0, box?.y1]).toEqual([
      piece.x - piece.w / 2,
      piece.x + piece.w / 2,
      piece.y - piece.d / 2,
      piece.y + piece.d / 2,
    ]);
    expect(room.furniture.find((f) => f.sheet.key === sheet)?.solid).toBe(true);
  });
});

describe('the pack furniture', () => {
  it("keeps each piece's drawn height: the side table and bookcase at their frames', the desk at the study's", () => {
    expect(pieceOf('side_table').h).toBe(heightMetres(8));
    expect(pieceOf('desk').h).toBe(0.65);
    expect(pieceOf('low_bookcase').h).toBe(heightMetres(12));
  });

  it('ships the models a room draws, the atlas and the licence, and nothing else', () => {
    const files = readdirSync(DIR).sort();
    expect(files).toEqual(
      [
        'LICENSE-KayKit-Furniture.txt',
        'furniturebits_texture.png',
        ...KINDS.map((kind) => PACK_MODELS[kind].file),
      ].sort(),
    );
    expect(Object.keys(FURNITURE_FILES.models).sort()).toEqual(
      KINDS.map((kind) => PACK_MODELS[kind].file).sort(),
    );
    expect(existsSync(new URL('LICENSE-KayKit-Furniture.txt', DIR))).toBe(true);
  });
});
