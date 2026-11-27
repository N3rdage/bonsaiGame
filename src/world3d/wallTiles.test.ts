import { describe, expect, it } from 'vitest';
import { SHEETS, type Sheet } from '../world/assets';
import { ROOMS } from '../world/gardenRoom';
import type { Room } from '../world/shedRoom';
import { WALL_CAP, wallRuns } from '../world/roomArt';
import { drawnBoxes, type Vec3 } from './meshes';
import { SURFACE_SPECS } from './paintedSurfaces';
import { roomPlan3d, type Box } from './plan';
import {
  WALL_LIFT,
  clipQuad,
  onDrawnPieces,
  paintedFaces,
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
    const sill = pieces.find((p) => p.piece.includes('.sill.window'));
    const lintel = pieces.find((p) => p.piece.includes('.lintel.window'));
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

const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box => ({
  name: 'box',
  wash: 'wood',
  x0,
  x1,
  y0,
  y1,
  z0,
  z1,
  solid: true,
});

/** A vertical quad on the plane y = 1 over x 0..4, z 0..2, its UVs 0..1 across and 0..1 up. */
const standing: WallQuad = {
  frame: 3,
  normal: { x: 0, y: 1, z: 0 },
  corners: [
    { x: 0, y: 1, z: 0 },
    { x: 4, y: 1, z: 0 },
    { x: 4, y: 1, z: 2 },
    { x: 0, y: 1, z: 2 },
  ],
  u0: 0,
  v0: 0,
  u1: 1,
  v1: 1,
};

/** A top quad at z = 2 over x 0..4, y 0..2, its first row on the high y as the layout lays it. */
const top: WallQuad = {
  frame: 1,
  normal: { x: 0, y: 0, z: 1 },
  corners: [
    { x: 0, y: 2, z: 2 },
    { x: 4, y: 2, z: 2 },
    { x: 4, y: 0, z: 2 },
    { x: 0, y: 0, z: 2 },
  ],
  u0: 0.2,
  v0: 0.4,
  u1: 0.6,
  v1: 0.8,
};

describe('clipQuad', () => {
  it('cuts a vertical quad to the box along both its axes and interpolates its UVs', () => {
    const part = clipQuad(standing, box(1, 3, 0, 1, 0.5, 1.5), WALL_LIFT);
    expect(part?.corners).toEqual([
      { x: 1, y: 1, z: 0.5 },
      { x: 3, y: 1, z: 0.5 },
      { x: 3, y: 1, z: 1.5 },
      { x: 1, y: 1, z: 1.5 },
    ]);
    expect([part?.u0, part?.u1, part?.v0, part?.v1]).toEqual([0.25, 0.75, 0.25, 0.75]);
    expect(part).toMatchObject({ frame: 3, normal: standing.normal });
  });

  it('cuts a top quad to the box, its V running against y', () => {
    const part = clipQuad(top, box(2, 6, 0.5, 1, 0, 2), WALL_LIFT);
    expect(part?.corners).toEqual([
      { x: 2, y: 1, z: 2 },
      { x: 4, y: 1, z: 2 },
      { x: 4, y: 0.5, z: 2 },
      { x: 2, y: 0.5, z: 2 },
    ]);
    expect(part?.u0).toBeCloseTo(0.4);
    expect(part?.u1).toBeCloseTo(0.6);
    expect(part?.v0).toBeCloseTo(0.6);
    expect(part?.v1).toBeCloseTo(0.7);
  });

  it('keeps a quad whole when the box holds it, its plane up to the tolerance off the box', () => {
    const part = clipQuad(standing, box(-1, 5, 0, 1 - WALL_LIFT, -1, 3), WALL_LIFT + 1e-6);
    expect(part?.corners).toEqual(standing.corners);
    expect(part).toMatchObject({ u0: 0, u1: 1, v0: 0, v1: 1 });
  });

  it("leaves out a box the quad's plane is outside", () => {
    expect(clipQuad(standing, box(0, 4, 2, 3, 0, 2), WALL_LIFT)).toBeUndefined();
    expect(clipQuad(top, box(0, 4, 0, 2, 0, 1), WALL_LIFT)).toBeUndefined();
  });

  it('leaves out a box that only touches the quad along an edge', () => {
    expect(clipQuad(standing, box(4, 6, 0, 1, 0, 2), WALL_LIFT)).toBeUndefined();
    expect(clipQuad(top, box(0, 4, 2, 3, 0, 3), WALL_LIFT)).toBeUndefined();
  });
});

/** The room's drawn wall boxes, as the renderer hands art to them with every piece present. */
function drawnWalls(room: Room): Box[] {
  const plan = roomPlan3d(room);
  const names = new Set(plan.walls.map((wall) => wall.name));
  return [...drawnBoxes(plan).values()].filter((b) => names.has(b.name));
}

/** The room's layouts on the plan's whole pieces that are drawn, as the renderer lays them: each sheet's art, then the wallpaper. */
function layoutsOf(room: Room): PieceQuads[][] {
  const present = new Set(drawnWalls(room).map((b) => b.name));
  const pieces = wallPieces(roomPlan3d(room).walls).filter((p) => present.has(p.name));
  return [
    ...wallSheets(room).map((sheet) => {
      const { w, h } = sizeOf(sheet);
      return wallLayout(room, pieces, sheet, w, h);
    }),
    paintedFaces(pieces, SURFACE_SPECS.wallpaper.metres),
  ];
}

const length = (a: Vec3, b: Vec3): number => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);

describe('onDrawnPieces, a hand-built corner', () => {
  // A north wall over x 0..4, cut back to x 0.5..4 by a west wall over x 0..0.5, y 0..3.
  const north: Box = { ...box(0.5, 4, 0, 0.5, 0, 2.4), name: 'north' };
  const west: Box = { ...box(0, 0.5, 0, 3, 0, 2.4), name: 'west' };
  const lift = WALL_LIFT;
  /** A quad over x 0..4 from `c0`, its second axis `v`, facing `normal`. */
  const quad = (c0: Vec3, v: Vec3, normal: Vec3): WallQuad => ({
    frame: 0,
    normal,
    corners: [
      c0,
      { ...c0, x: 4 },
      { x: 4, y: c0.y + v.y, z: c0.z + v.z },
      { x: 0, y: c0.y + v.y, z: c0.z + v.z },
    ],
    u0: 0,
    v0: 0,
    u1: 1,
    v1: 1,
  });
  const inner = quad({ x: 0, y: 0.5 + lift, z: 0 }, { x: 0, y: 0, z: 2.4 }, { x: 0, y: 1, z: 0 });
  const outer = quad({ x: 0, y: -lift, z: 0 }, { x: 0, y: 0, z: 2.4 }, { x: 0, y: -1, z: 0 });
  const capped = quad(
    { x: 0, y: 0.5, z: 2.4 + lift },
    { x: 0, y: -0.5, z: 0 },
    { x: 0, y: 0, z: 1 },
  );
  const filed = onDrawnPieces([{ piece: 'north', quads: [inner, outer, capped] }], [north, west]);
  const on = (name: string): readonly WallQuad[] =>
    filed.find((p) => p.piece === name)?.quads ?? [];
  const xs = (q: WallQuad): number[] => q.corners.map((c) => c.x);

  it('keeps on the cut wall the part of each quad over its own box', () => {
    expect(on('north').map((q) => q.normal)).toEqual([inner.normal, outer.normal, capped.normal]);
    expect(on('north').every((q) => Math.min(...xs(q)) === 0.5 && Math.max(...xs(q)) === 4)).toBe(
      true,
    );
  });

  it("hands the corner's outer face and top to the wall that keeps the corner, and drops the inner face buried in it", () => {
    expect(on('west').map((q) => q.normal)).toEqual([outer.normal, capped.normal]);
    expect(on('west').every((q) => Math.min(...xs(q)) === 0 && Math.max(...xs(q)) === 0.5)).toBe(
      true,
    );
  });
});

describe('onDrawnPieces, the shed', () => {
  const shed = ROOMS.shed;
  const drawn = drawnWalls(shed);
  const lift = WALL_LIFT + 1e-6;
  const within = (quads: readonly WallQuad[], b: Box): boolean =>
    quads.every((q) =>
      q.corners.every(
        (c) =>
          c.x >= b.x0 - lift &&
          c.x <= b.x1 + lift &&
          c.y >= b.y0 - lift &&
          c.y <= b.y1 + lift &&
          c.z >= b.z0 - lift &&
          c.z <= b.z1 + lift,
      ),
    );

  it('trims the north wall back where the west wall shares its end', () => {
    const north = roomPlan3d(shed).walls.find((w) => w.name === 'wall.0.0');
    const cut = drawn.find((b) => b.name === 'wall.0.0');
    expect([north?.x0, north?.x1]).toEqual([2.5, 7]);
    expect([cut?.x0, cut?.x1]).toEqual([3, 7]);
  });

  it("files every quad within the drawn box it is filed under, for each sheet's art and the wallpaper", () => {
    for (const lay of layoutsOf(shed)) {
      const filed = onDrawnPieces(lay, drawn);
      expect(filed.length).toBeGreaterThan(0);
      for (const { piece, quads } of filed) {
        const b = drawn.find((d) => d.name === piece);
        expect(b !== undefined && within(quads, b)).toBe(true);
      }
    }
  });
});

describe('onDrawnPieces, coverage', () => {
  const tolerance = WALL_LIFT + 1e-6;
  const areaOfQuad = (q: WallQuad): number =>
    length(q.corners[0], q.corners[1]) * length(q.corners[0], q.corners[3]);
  const total = (lay: readonly PieceQuads[]): number =>
    quadsOf([...lay]).reduce((sum, q) => sum + areaOfQuad(q), 0);
  const filed = (room: Room, lay: PieceQuads[]): PieceQuads[] =>
    onDrawnPieces(lay, drawnWalls(room));
  const inked = (room: Room): PieceQuads[][] => layoutsOf(room).slice(0, -1);
  const rooms = Object.values(ROOMS).map((room) => [room.key, room] as const);

  /** The layout's quads that no drawn wall box takes any part of. */
  const unfiled = (room: Room, lay: PieceQuads[]): WallQuad[] =>
    quadsOf(lay).filter((q) => filed(room, [{ piece: 'q', quads: [q] }]).length === 0);

  const allBoxes = (room: Room): Box[] => [...drawnBoxes(roomPlan3d(room)).values()];

  it.each(rooms)(
    'takes every quad of %s onto a drawn wall box, or it lies inside a drawn box, out of sight',
    (_key, room) => {
      for (const lay of layoutsOf(room)) {
        for (const q of unfiled(room, lay)) {
          expect(allBoxes(room).some((b) => clipQuad(q, b, tolerance) !== undefined)).toBe(true);
        }
      }
    },
  );

  it.each(rooms)(
    'files each inked quad of %s that touches a drawn wall whole and once',
    (_key, room) => {
      for (const lay of inked(room)) {
        for (const q of quadsOf(lay)) {
          const parts = onDrawnPieces([{ piece: 'q', quads: [q] }], drawnWalls(room));
          if (parts.length > 0) expect(total(parts)).toBeCloseTo(areaOfQuad(q), 6);
        }
      }
    },
  );

  it("files all of the greenhouse's art, and the front garden's but four quads inside its walls and house", () => {
    const lost = (room: Room): number =>
      inked(room).reduce((sum, lay) => sum + unfiled(room, lay).length, 0);
    expect(lost(ROOMS.greenhouse)).toBe(0);
    expect(lost(ROOMS.frontGarden)).toBe(4);
  });
});
