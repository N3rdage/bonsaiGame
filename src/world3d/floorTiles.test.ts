import { describe, expect, it } from 'vitest';
import { ROOMS } from '../world/gardenRoom';
import { floorTiles } from '../world/roomArt';
import { FLOOR_LIFT, floorLayout, floorMeshData } from './floorTiles';
import { metres } from './plan';

const SHEET_W = 192;
const SHEET_H = 64;

describe('floorLayout', () => {
  for (const key of ['shed', 'garden'] as const) {
    it(`gives the ${key} one quad per tile of floorTiles, with its frame`, () => {
      const tiles = floorTiles(ROOMS[key]);
      const { sheet, quads } = floorLayout(ROOMS[key], SHEET_W, SHEET_H);
      expect(sheet).toBe(tiles.sheet.key);
      expect(quads.map((q) => q.frame)).toEqual(tiles.frames.flat());
    });
  }

  it('covers the shed inside its walls, not the surround', () => {
    const { quads } = floorLayout(ROOMS.shed, SHEET_W, SHEET_H);
    const area = floorTiles(ROOMS.shed).area;
    expect(Math.min(...quads.map((q) => q.x0))).toBe(metres(area.x));
    expect(Math.min(...quads.map((q) => q.y0))).toBe(metres(area.y));
    expect(Math.max(...quads.map((q) => q.x1))).toBe(metres(area.x + area.w));
    expect(Math.max(...quads.map((q) => q.y1))).toBe(metres(area.y + area.h));
    expect(area.x).toBeGreaterThan(0);
  });

  it('covers the whole garden from its corner to its far corner', () => {
    const { quads } = floorLayout(ROOMS.garden, SHEET_W, SHEET_H);
    expect(quads[0]).toMatchObject({ x0: 0, y0: 0, x1: 0.5, y1: 0.5 });
    const last = quads[quads.length - 1];
    expect(last?.x1).toBe(metres(ROOMS.garden.width));
    expect(last?.y1).toBe(metres(ROOMS.garden.height));
  });

  it('puts a frame at its column of the sheet, inset half a texel, and wraps to the next row', () => {
    const q = floorLayout(ROOMS.garden, SHEET_W, SHEET_H).quads.find((t) => t.frame === 2);
    expect(q?.u0).toBeCloseTo(128 / SHEET_W + 0.5 / SHEET_W);
    expect(q?.u1).toBeCloseTo(1 - 0.5 / SHEET_W);
    expect(q?.v0).toBeCloseTo(0.5 / SHEET_H);
    expect(q?.v1).toBeCloseTo(1 - 0.5 / SHEET_H);
    const wrapped = floorLayout(ROOMS.garden, 128, 128).quads.find((t) => t.frame === 2);
    expect(wrapped?.u0).toBeCloseTo(0.5 / 128);
    expect(wrapped?.v1).toBeCloseTo(0.5 - 0.5 / 128);
  });
});

describe('floorMeshData', () => {
  it('makes four vertices and two triangles per quad, facing up, above the floor', () => {
    const { quads } = floorLayout(ROOMS.shed, SHEET_W, SHEET_H);
    const data = floorMeshData(quads);
    expect(data.positions).toHaveLength(quads.length * 12);
    expect(data.uvs).toHaveLength(quads.length * 8);
    expect(data.indices).toHaveLength(quads.length * 6);
    expect(data.normals.filter((_, i) => i % 3 === 1).every((n) => n === 1)).toBe(true);
    expect(data.positions.filter((_, i) => i % 3 === 1).every((y) => y === FLOOR_LIFT)).toBe(true);
  });
});
