import { describe, expect, it } from 'vitest';
import { ROOMS } from '../world/gardenRoom';
import { countDetails, roomDetails, type Detail } from './details';
import { roomPlan3d } from './plan';

const detailsOf = (key: keyof typeof ROOMS): Detail[] =>
  roomDetails(ROOMS[key], roomPlan3d(ROOMS[key]));

const extent = (d: Detail): { x0: number; x1: number; y0: number; y1: number; z1: number } => ({
  x0: Math.min(...d.parts.map((p) => p.x0)),
  x1: Math.max(...d.parts.map((p) => p.x1)),
  y0: Math.min(...d.parts.map((p) => p.y0)),
  y1: Math.max(...d.parts.map((p) => p.y1)),
  z1: Math.max(...d.parts.map((p) => p.z1)),
});

describe('roomDetails', () => {
  it('gives the shed its two doors and its window, each hung from a wall piece', () => {
    const details = detailsOf('shed');
    expect(countDetails(details)).toEqual({ door: 2, window: 1 });
    const plan = roomPlan3d(ROOMS.shed);
    for (const detail of details) {
      expect(plan.walls.map((w) => w.name)).toContain(detail.host);
    }
  });

  it("fills the shed door's opening with a frame and a leaf 2 m high", () => {
    const door = detailsOf('shed').find((d) => d.name === 'door');
    const opening = roomPlan3d(ROOMS.shed).openings.find((o) => o.name === 'door');
    expect(door?.host).toMatch(/\.lintel\.door$/);
    expect(door?.parts.map((p) => p.wash)).toEqual(['wood', 'wood', 'wood', 'floor']);
    expect(door && extent(door)).toEqual({
      x0: opening?.x0,
      x1: opening?.x1,
      y0: opening?.y0,
      y1: opening?.y1,
      z1: 2,
    });
  });

  it("sets the shed window's glass between its sill and head in a frame", () => {
    const window = detailsOf('shed').find((d) => d.kind === 'window');
    const opening = roomPlan3d(ROOMS.shed).openings.find((o) => o.kind === 'window');
    expect(window?.host).toMatch(/\.lintel\.window\.0$/);
    const glass = window?.parts.filter((p) => p.wash === 'studyPaper') ?? [];
    expect(glass).toHaveLength(1);
    expect(glass[0]?.z0).toBeGreaterThan(opening?.z0 ?? 1);
    expect(glass[0]?.z1).toBeLessThan(opening?.z1 ?? 0);
    expect(window?.parts.filter((p) => p.wash === 'paint').length).toBeGreaterThanOrEqual(4);
  });

  it("puts a box hedge on each of the front garden's beds, on the bed's footprint", () => {
    const hedges = detailsOf('frontGarden').filter((d) => d.kind === 'hedge');
    expect(hedges).toHaveLength(2);
    const first = hedges[0];
    expect(first && extent(first)).toMatchObject({
      x0: 4 + 0.04,
      x1: 9.5 - 0.04,
      y0: 3.5 + 0.04,
      y1: 4 - 0.04,
      z1: 0.6,
    });
  });

  it("stands a shrub on each of the garden's source plants", () => {
    const plantings = detailsOf('garden').filter((d) => d.kind === 'planting');
    expect(plantings.map((d) => d.name)).toEqual(['source_juniper', 'source_maple', 'source_pine']);
    expect(plantings[0]?.host).toBeUndefined();
    expect(countDetails(detailsOf('garden'))).toEqual({ door: 1, planting: 3 });
  });

  it('is empty for a room with nothing to model', () => {
    expect(countDetails([])).toEqual({});
  });
});
