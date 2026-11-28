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
import { readGlb, type Glb } from './glb';
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
    expect((max[0] ?? 0) - (min[0] ?? 0)).toBeCloseTo(model.size.w, 4);
    expect((max[2] ?? 0) - (min[2] ?? 0)).toBeCloseTo(model.size.d, 4);
    expect((max[1] ?? 0) - (min[1] ?? 0)).toBeCloseTo(model.size.h, 4);
    expect(min[1] ?? 1).toBeCloseTo(0, 6);
    expect(Math.abs(((max[0] ?? 0) + (min[0] ?? 0)) / 2)).toBeLessThan(0.001);
    expect(Math.abs(((max[2] ?? 0) + (min[2] ?? 0)) / 2)).toBeLessThan(0.001);
  });

  it("draws the file's vertices, with the box drawn meanwhile at the model's size", () => {
    const geometry = packGeometry(glb);
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
    const { positions, normals, indices } = packGeometry(glb);
    // The file's front is +z; Babylon's south, toward the camera, is -z.
    expect(Math.min(...positions.filter((_, i) => i % 3 === 2))).toBeCloseTo(-(max[2] ?? 0), 6);
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
    const { positions, normals } = packGeometry(glb);
    const top = [...Array.from({ length: positions.length / 3 }, (_, i) => i)].filter(
      (i) => Math.abs((positions[i * 3 + 1] ?? 0) - (max[1] ?? 0)) < 1e-6,
    );
    expect(top.length).toBeGreaterThanOrEqual(4);
    for (const i of top) expect(normals[i * 3 + 1]).toBeGreaterThan(0.5);
    const xs = top.map((i) => positions[i * 3] ?? 0);
    const zs = top.map((i) => positions[i * 3 + 2] ?? 0);
    expect((Math.max(...xs) - Math.min(...xs)) / model.size.w).toBeGreaterThan(0.9);
    expect((Math.max(...zs) - Math.min(...zs)) / model.size.d).toBeGreaterThan(0.9);
  });

  it("is scaled to its piece's footprint and drawn height, which is the plan's box", () => {
    const piece = pieceOf(kind);
    const sx = piece.w / model.size.w;
    const sy = piece.h / model.size.h;
    const sz = piece.d / model.size.d;
    expect(model.size.w * sx).toBeCloseTo(piece.w, 9);
    expect((max[1] ?? 0) * sy).toBeCloseTo(piece.h, 6);
    expect(model.size.d * sz).toBeCloseTo(piece.d, 9);
    // The scale, pinned: footprint over the model's extent, height over its own.
    const pinned = {
      side_table: [0.5, 0.375, 0.5],
      desk: [1 / 3, 0.65, 0.25],
      low_bookcase: [0.75, 0.5625, 0.5 / 1.0016],
    }[kind];
    expect([sx, sy, sz].map((s, i) => s - (pinned[i] ?? 0))).toEqual([
      expect.closeTo(0, 6),
      expect.closeTo(0, 6),
      expect.closeTo(0, 6),
    ]);
  });

  it("stands the tree on the model's top, over its spot", () => {
    const { room, spot, sheet } = HOMES[kind];
    const piece = pieceOf(kind);
    const state = createNewGameState();
    state.trees = [{ ...createTree('juniper', 'cutting', 0), location: `displayed:${spot}` }];
    const [stand] = treeStands(state, room, 'spring');
    expect(stand?.z).toBeCloseTo((max[1] ?? 0) * (piece.h / model.size.h), 9);
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
