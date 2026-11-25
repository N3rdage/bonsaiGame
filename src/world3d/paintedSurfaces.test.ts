import { describe, expect, it } from 'vitest';
import { ROOMS } from '../world/gardenRoom';
import { floorTiles } from '../world/roomArt';
import type { RoomKey } from '../world/shedRoom';
import { SURFACES } from './look';
import { PAINT, paintWallpaper } from './paint/painters';
import {
  RASTER_V_UP,
  SURFACE_SPECS,
  inkedWallSheets,
  paintedFloor,
  paintedFloorQuad,
  paintedWalls,
} from './paintedSurfaces';
import { roomPlan3d } from './plan';
import { paintedFaces, paintedMassFaces, paperedMasses, wallPieces } from './wallTiles';

describe('which room wears which surface', () => {
  const floors: Record<RoomKey, string | undefined> = {
    shed: 'wood',
    lounge: 'wood',
    hallway: 'wood',
    study: 'wood',
    greenhouse: 'tiles',
    garden: undefined,
    frontGarden: undefined,
  };
  const papered: Record<RoomKey, boolean> = {
    shed: true,
    lounge: true,
    hallway: true,
    study: true,
    greenhouse: false,
    garden: false,
    frontGarden: false,
  };

  for (const key of Object.keys(floors) as RoomKey[]) {
    it(`gives the ${key} ${String(floors[key])} floor and ${papered[key] ? 'papered' : 'unpapered'} walls`, () => {
      expect(paintedFloor(ROOMS[key])).toBe(floors[key]);
      expect(paintedWalls(ROOMS[key])).toBe(papered[key]);
    });
  }

  it("drops a papered room's face sheet from its Inked walls and keeps the caps", () => {
    expect(inkedWallSheets(ROOMS.shed).map((s) => s.key)).toEqual([
      'spr_shed_cap_v',
      'spr_shed_cap',
    ]);
    expect(inkedWallSheets(ROOMS.garden).length).toBe(3);
    expect(inkedWallSheets(ROOMS.greenhouse).map((s) => s.key)).toContain('spr_greenhouse_wall');
  });

  it('keys each surface apart', () => {
    const keys = Object.values(SURFACE_SPECS).map((s) => s.key);
    expect(new Set(keys).size).toBe(3);
  });
});

describe('paintedFloorQuad', () => {
  it('covers the floor area with UVs in metres, v up toward the north', () => {
    const shed = ROOMS.shed;
    const { area } = floorTiles(shed);
    const q = paintedFloorQuad('wood', shed);
    expect(q.x1 - q.x0).toBeCloseTo(area.w / 32, 9);
    expect(q.y1 - q.y0).toBeCloseTo(area.h / 32, 9);
    const { u, v } = PAINT.metres.floor;
    expect(q.u1 - q.u0).toBeCloseTo((q.x1 - q.x0) / u, 9);
    expect(q.v1 - q.v0).toBeCloseTo((q.y1 - q.y0) / v, 9);
    // North is up the raster: the far (north) edge has the higher v.
    expect(q.v1).toBeCloseTo(-q.y0 / v, 9);
  });

  it('gives a metre of floor the same texel in every room', () => {
    const a = paintedFloorQuad('wood', ROOMS.shed);
    const b = paintedFloorQuad('wood', ROOMS.study);
    const { u } = PAINT.metres.floor;
    expect(a.u0 * u).toBeCloseTo(a.x0, 9);
    expect(b.u0 * u).toBeCloseTo(b.x0, 9);
  });
});

describe('painted wall faces', () => {
  const shed = ROOMS.shed;
  const pieces = wallPieces(roomPlan3d(shed).walls);
  const layout = paintedFaces(pieces, PAINT.metres.wall);

  it('lays one face on every ring piece, looking into the room', () => {
    expect(layout.length).toBe(pieces.length);
    for (const { piece, quads } of layout) {
      const wall = pieces.find((p) => p.name === piece);
      expect(quads.length).toBeGreaterThan(0);
      for (const q of quads) {
        const n = q.normal;
        if (wall?.side === 'N') expect(n).toEqual({ x: 0, y: 1, z: 0 });
        if (wall?.side === 'S') expect(n).toEqual({ x: 0, y: -1, z: 0 });
        if (wall?.side === 'W') expect(n).toEqual({ x: 1, y: 0, z: 0 });
        if (wall?.side === 'E') expect(n).toEqual({ x: -1, y: 0, z: 0 });
      }
    }
  });

  it('puts v 0 on the floor line and v in metres up the wall, so the painter rows land at real heights', () => {
    const wall = pieces.find((p) => p.side === 'N' && p.z0 === 0);
    const quad = layout.find((l) => l.piece === wall?.name)?.quads[0];
    expect(wall).toBeDefined();
    expect(quad?.v0).toBe(0);
    expect(quad?.v1).toBeCloseTo((wall?.z1 ?? 0) / PAINT.metres.wall.v, 9);

    // Uploaded v up (invertY), v 0 is the raster's last row and v rises up the image, so the
    // row a height z lands in is the one the painter drew its band at: the skirting under 0.13 m,
    // the wainscot to 0.92 m.
    expect(RASTER_V_UP).toBe(true);
    const raster = paintWallpaper({ size: 256 });
    const rowAt = (z: number): number =>
      Math.min(255, Math.floor(256 - (z / PAINT.metres.wall.v) * 256));
    const rowMean = (y: number): number[] => {
      const sum = [0, 0, 0];
      for (let x = 0; x < 256; x++) {
        for (let c = 0; c < 3; c++)
          sum[c] = (sum[c] ?? 0) + (raster.data[(y * 256 + x) * 4 + c] ?? 0);
      }
      return sum.map((s) => s / 256);
    };
    const nearTo = (got: number[], hex: number): void => {
      const want = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
      for (let c = 0; c < 3; c++) expect(Math.abs((got[c] ?? 0) - (want[c] ?? 0))).toBeLessThan(40);
    };
    nearTo(rowMean(rowAt(PAINT.wall.skirting / 2)), SURFACES.walls.skirting);
    nearTo(rowMean(rowAt(0.5)), SURFACES.walls.wainscot);
    nearTo(rowMean(rowAt(1.5)), SURFACES.walls.paper);
  });

  it('keeps u in metres along the wall, running left to right as the viewer reads it', () => {
    for (const { quads } of layout) {
      for (const q of quads) {
        expect(q.u1).toBeGreaterThan(q.u0);
        const [left, right] = q.corners;
        const run = Math.hypot(right.x - left.x, right.y - left.y);
        expect((q.u1 - q.u0) * PAINT.metres.wall.u).toBeCloseTo(run, 9);
      }
    }
  });

  it('dresses the lounge hallway block on its south and west faces', () => {
    const [mass] = paperedMasses(ROOMS.lounge);
    expect(mass).toBeDefined();
    if (!mass) return;
    const [south, west] = paintedMassFaces(mass, PAINT.metres.wall);
    expect(south?.normal).toEqual({ x: 0, y: 1, z: 0 });
    expect(west?.normal).toEqual({ x: -1, y: 0, z: 0 });
    expect(south?.v0).toBe(mass.z0 / PAINT.metres.wall.v);
  });
});
