import { describe, expect, it } from 'vitest';
import { SHEETS, type Sheet } from '../world/assets';
import { ROOMS } from '../world/gardenRoom';
import { WALL_CAP, wallRuns } from '../world/roomArt';
import { roomPlan3d } from './plan';
import {
  WALL_LIFT,
  massLayout,
  paperedMasses,
  wallLayout,
  wallMeshData,
  wallPieces,
  wallSheets,
  type PieceQuads,
  type WallQuad,
} from './wallTiles';

const sizeOf = (sheet: Sheet): { w: number; h: number } => ({
  w: sheet.frameWidth * sheet.frames,
  h: sheet.frameHeight,
});

function layout(key: 'shed' | 'garden', sheet: Sheet): PieceQuads[] {
  const { w, h } = sizeOf(sheet);
  return wallLayout(ROOMS[key], wallPieces(roomPlan3d(ROOMS[key]).walls), sheet, w, h);
}

const quadsOf = (pieces: PieceQuads[]): WallQuad[] => pieces.flatMap((p) => p.quads);

describe('wallSheets', () => {
  it("lists the shed's face and caps, not its window", () => {
    expect(wallSheets(ROOMS.shed).map((s) => s.key)).toEqual([
      'spr_shed_wall',
      'spr_shed_cap_v',
      'spr_shed_cap',
    ]);
  });

  it("lists the garden's fences and corner posts", () => {
    expect(
      wallSheets(ROOMS.garden)
        .map((s) => s.key)
        .sort(),
    ).toEqual(['spr_fence', 'spr_fence_corner', 'spr_fence_v']);
  });
});

describe('wallLayout, the shed', () => {
  const shed = ROOMS.shed;
  const runs = wallRuns(shed).filter((r) => r.sheet.key === SHEETS.shedWall.key);

  it("lays the back wall's face on the north wall's inner face, one quad per frame, the whole 2.4 m", () => {
    const pieces = layout('shed', SHEETS.shedWall);
    const quads = quadsOf(pieces);
    const wall = roomPlan3d(shed).walls.filter((w) => w.side === 'N');
    const north = Math.max(...wall.map((w) => w.y1));
    expect(runs.length).toBeGreaterThan(0);
    expect(pieces.every((p) => wall.some((w) => w.name === p.piece))).toBe(true);
    expect(quads.every((q) => q.normal.y === 1)).toBe(true);
    expect(quads.every((q) => q.corners.every((c) => c.y === north + WALL_LIFT))).toBe(true);
    expect(Math.max(...quads.flatMap((q) => q.corners.map((c) => c.z)))).toBe(2.4);
    expect(Math.min(...quads.flatMap((q) => q.corners.map((c) => c.z)))).toBe(0);
  });

  it('takes each frame from the 2D run and insets its UVs half a texel', () => {
    const quads = quadsOf(layout('shed', SHEETS.shedWall));
    expect(new Set(quads.map((q) => q.frame))).toEqual(new Set(runs.map((r) => r.frame ?? 0)));
    const whole = quads.filter((q) => q.corners[2].z - q.corners[0].z === 2.4);
    const { w, h } = sizeOf(SHEETS.shedWall);
    const first = whole.find((q) => q.frame === 1);
    expect(first?.u0).toBeCloseTo(SHEETS.shedWall.frameWidth / w + 0.5 / w);
    expect(first?.u1).toBeCloseTo((2 * SHEETS.shedWall.frameWidth) / w - 0.5 / w);
    expect(first?.v0).toBeCloseTo(0.5 / h);
    expect(first?.v1).toBeCloseTo(1 - 0.5 / h);
  });

  it('cuts the face where the window opens the wall: a sill under it and a lintel over it', () => {
    const pieces = layout('shed', SHEETS.shedWall);
    const sill = pieces.find((p) => p.piece.includes('.sill.'));
    const lintel = pieces.find((p) => p.piece.includes('.lintel.'));
    const top = (q: WallQuad): number => q.corners[2].z;
    expect(sill && Math.max(...sill.quads.map(top))).toBeCloseTo(0.9);
    expect(lintel && Math.min(...lintel.quads.map((q) => q.corners[0].z))).toBeCloseTo(2);
    const { h } = sizeOf(SHEETS.shedWall);
    expect(sill?.quads[0]?.v1).toBeCloseTo(0.9 / 2.4 - 0.5 / h);
  });

  it("lays the side caps on the side walls' tops, a cap deep, and the south cap on the south wall's", () => {
    const side = quadsOf(layout('shed', SHEETS.shedCapV));
    const south = quadsOf(layout('shed', SHEETS.shedCap));
    expect(side.length).toBeGreaterThan(0);
    for (const q of [...side, ...south]) {
      expect(q.normal).toEqual({ x: 0, y: 0, z: 1 });
      expect(q.corners.every((c) => c.z === 2.4 + WALL_LIFT)).toBe(true);
    }
    const [bl, br] = side[0]?.corners ?? [];
    expect((br?.x ?? 0) - (bl?.x ?? 0)).toBeCloseTo(WALL_CAP / 32);
  });
});

describe('wallLayout, the garden', () => {
  it('lays each fence band on both long faces of its box, the whole 0.75 m', () => {
    const quads = quadsOf(layout('garden', SHEETS.fence));
    const rows = wallRuns(ROOMS.garden).filter((r) => r.sheet.key === SHEETS.fence.key);
    const plan = roomPlan3d(ROOMS.garden).walls.filter((w) => w.side === 'N' || w.side === 'S');
    expect(rows.length).toBeGreaterThan(0);
    expect(quads.filter((q) => q.normal.y === 1)).toHaveLength(quads.length / 2);
    expect(quads.every((q) => q.normal.x === 0 && q.normal.z === 0)).toBe(true);
    expect(Math.max(...quads.flatMap((q) => q.corners.map((c) => c.z)))).toBeCloseTo(0.75);
    const ys = new Set(quads.map((q) => q.corners[0].y));
    for (const wall of plan) {
      expect(ys.has(wall.y0 - WALL_LIFT) || ys.has(wall.y1 + WALL_LIFT)).toBe(true);
    }
  });

  it("lays no fence art on a building's wall box, whose surface is its own", () => {
    const buildings = roomPlan3d(ROOMS.garden)
      .walls.filter((w) => w.wash === 'render')
      .map((w) => w.name);
    expect(buildings.length).toBeGreaterThan(0);
    for (const sheet of [SHEETS.fence, SHEETS.fenceCorner, SHEETS.fenceV]) {
      const laidOn = layout('garden', sheet).map((p) => p.piece);
      expect(laidOn.filter((name) => buildings.includes(name))).toEqual([]);
    }
  });

  it("draws a corner tile once, on the first wall that has it, not on the west wall's overlapping end", () => {
    const quads = quadsOf(layout('garden', SHEETS.fenceCorner));
    expect(quads).toHaveLength(8);
    expect(new Set(quads.map((q) => q.frame))).toEqual(new Set([0, 1, 2, 3]));
  });

  it('turns the east fence face the same way up, so its frame reads left to right from outside', () => {
    const quads = quadsOf(layout('garden', SHEETS.fenceV));
    const east = quads.filter((q) => q.normal.x === 1);
    const west = quads.filter((q) => q.normal.x === -1);
    expect(east.length).toBeGreaterThan(0);
    expect(west).toHaveLength(east.length);
    // Seen from the east the viewer's right is north (y falls); from the west, south.
    expect((east[0]?.corners[1].y ?? 0) < (east[0]?.corners[0].y ?? 0)).toBe(true);
    expect((west[0]?.corners[1].y ?? 0) > (west[0]?.corners[0].y ?? 0)).toBe(true);
  });
});

describe('wallMeshData', () => {
  it('makes four vertices and two triangles per quad, positions relative to the origin in Babylon frame', () => {
    const quads = quadsOf(layout('shed', SHEETS.shedWall));
    const data = wallMeshData(quads, { x: 1, y: 2, z: 3 });
    expect(data.positions).toHaveLength(quads.length * 12);
    expect(data.normals).toHaveLength(quads.length * 12);
    expect(data.uvs).toHaveLength(quads.length * 8);
    expect(data.indices).toHaveLength(quads.length * 6);
    const q = quads[0];
    expect(data.positions[0]).toBeCloseTo((q?.corners[0].x ?? 0) - 1);
    expect(data.positions[1]).toBeCloseTo((q?.corners[0].z ?? 0) - 3);
    expect(data.positions[2]).toBeCloseTo(-((q?.corners[0].y ?? 0) - 2));
  });
});

describe('massLayout, the lounge hallway mass', () => {
  const lounge = ROOMS.lounge;
  const [mass] = paperedMasses(lounge);
  const lay = (sheet: Sheet): WallQuad[] => {
    const { w, h } = sizeOf(sheet);
    return mass ? massLayout(lounge, mass, sheet, w, h) : [];
  };

  it('finds the one papered mass, the hallway block', () => {
    expect(paperedMasses(lounge)).toHaveLength(1);
    expect(mass).toMatchObject({ wash: 'wallpaper', x0: 10.5, x1: 13.5, y0: 2, y1: 4, z1: 2.25 });
    expect(paperedMasses(ROOMS.shed)).toEqual([]);
  });

  it("dresses its south and west faces in the back wall's face tiles, the whole height", () => {
    const quads = lay(SHEETS.wallLounge);
    const south = quads.filter((q) => q.normal.y === 1);
    const west = quads.filter((q) => q.normal.x === -1);
    expect(south).toHaveLength(6);
    expect(west).toHaveLength(4);
    expect(quads).toHaveLength(10);
    expect(south.every((q) => q.corners.every((c) => c.y === 4 + WALL_LIFT))).toBe(true);
    expect(west.every((q) => q.corners.every((c) => c.x === 10.5 - WALL_LIFT))).toBe(true);
    for (const q of quads) {
      expect(Math.min(...q.corners.map((c) => c.z))).toBe(0);
      expect(Math.max(...q.corners.map((c) => c.z))).toBe(2.25);
    }
  });

  it("lays the lounge's caps on its top along its two open edges", () => {
    const side = lay(SHEETS.loungeCapV);
    const row = lay(SHEETS.loungeCap);
    expect(side).toHaveLength(4);
    expect(row).toHaveLength(6);
    for (const q of [...side, ...row]) {
      expect(q.normal).toEqual({ x: 0, y: 0, z: 1 });
      expect(q.corners.every((c) => c.z === 2.25 + WALL_LIFT)).toBe(true);
    }
  });

  it('lays nothing of a sheet the room does not wear', () => {
    expect(lay(SHEETS.shedWall)).toEqual([]);
  });
});
