import { describe, expect, it } from 'vitest';
import { ROOMS } from '../world/gardenRoom';
import { countDetails, roomDetails, type Detail } from './details';
import {
  DOOR_HEIGHT,
  DOOR_WIDTH,
  FACE_RELIEF,
  WINDOW_HEAD,
  WINDOW_SILL,
  heightMetres,
  roomPlan3d,
} from './plan';

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
      z1: 0.25,
    });
  });

  it('keeps the hedges low enough to step over, as the plan lets the player walk over the beds', () => {
    const plan = roomPlan3d(ROOMS.frontGarden);
    const beds = plan.floor.concat(plan.furniture).filter((b) => b.name.endsWith('.spr_bed'));
    expect(beds.length).toBeGreaterThan(0);
    expect(beds.every((b) => !b.solid)).toBe(true);
    for (const hedge of detailsOf('frontGarden').filter((d) => d.kind === 'hedge')) {
      expect(extent(hedge).z1).toBeLessThanOrEqual(0.3);
    }
  });

  it("sizes a fence's door to its fence, and keeps a building's door full height", () => {
    for (const key of ['garden', 'frontGarden'] as const) {
      const plan = roomPlan3d(ROOMS[key]);
      const gates = detailsOf(key).filter(
        (d) => d.kind === 'door' && plan.openings.some((o) => o.name === d.name),
      );
      expect(gates.length).toBeGreaterThan(0);
      for (const gate of gates) {
        const host = plan.walls.find((w) => w.name === gate.host);
        const opening = plan.openings.find((o) => o.name === gate.name);
        expect(host?.z1).toBeLessThan(opening?.z1 ?? 0);
        expect(extent(gate).z1).toBe(host?.z1);
      }
    }
    const shed = detailsOf('shed').find((d) => d.name === 'door');
    expect(shed && extent(shed).z1).toBe(2);
  });

  it("stands a shrub on each of the garden's source plants", () => {
    const plantings = detailsOf('garden').filter((d) => d.kind === 'planting');
    expect(plantings.map((d) => d.name)).toEqual(['source_juniper', 'source_maple', 'source_pine']);
    expect(plantings[0]?.host).toBeUndefined();
    expect(countDetails(detailsOf('garden'))).toEqual({ door: 4, window: 1, planting: 3 });
  });

  it("gives each garden source plant its species' tiers, its widest the prop's 0.75 m footprint", () => {
    const plants = ROOMS.garden.props.filter((p) => p.speciesKey !== undefined);
    expect(plants.map((p) => p.w)).toEqual([24, 24, 24]);
    const washes = { juniper: 'foliage', maple: 'mapleSummer', pine: 'pineSummer' };
    const tiers = { juniper: 3, maple: 3, pine: 4 };
    for (const prop of plants) {
      const key = prop.speciesKey ?? 'juniper';
      const planting = detailsOf('garden').find((d) => d.name === prop.key);
      const crown = planting?.parts.filter((p) => p.wash === washes[key]) ?? [];
      expect(crown).toHaveLength(tiers[key]);
      expect(Math.max(...crown.map((p) => p.x1 - p.x0))).toBeCloseTo(0.75, 9);
      expect(Math.max(...crown.map((p) => p.y1 - p.y0))).toBeCloseTo(0.75, 9);
      expect(Math.min(...crown.map((p) => p.x0))).toBeCloseTo(prop.x / 32 - 0.375, 9);
    }
  });

  it("hangs each garden door that has no opening on its building's face, recessed in a frame", () => {
    const room = ROOMS.garden;
    const plan = roomPlan3d(room);
    const faceDoors = room.props.filter(
      (p) => p.wall !== undefined && !plan.openings.some((o) => o.name === p.key),
    );
    expect(faceDoors.map((p) => p.key)).toEqual(['door', 'door_study', 'door_greenhouse']);
    const details = detailsOf('garden');
    for (const prop of faceDoors) {
      const matches = details.filter((d) => d.name === prop.key);
      expect(matches).toHaveLength(1);
      const door = matches[0] ?? { name: '', kind: 'door' as const, parts: [] };
      const face = plan.furniture.find((b) => b.name === door.host);
      expect(face?.name).toMatch(/_face$/);
      const { x0, x1, y0, y1, z1 } = extent(door);
      expect(x1 - x0).toBeCloseTo(DOOR_WIDTH, 9);
      expect((x0 + x1) / 2).toBeCloseTo(prop.x / 32, 9);
      expect(z1).toBe(DOOR_HEIGHT);
      expect(z1).toBeLessThan(face?.z1 ?? 0);
      expect(y0).toBeCloseTo((face?.y0 ?? 0) - FACE_RELIEF, 9);
      expect(y1).toBeCloseTo((face?.y1 ?? 0) + FACE_RELIEF, 9);
      const leaf = door.parts[3];
      expect(leaf?.y0).toBeGreaterThan(y0);
      expect(leaf?.y1).toBeLessThan(y1);
    }
  });

  it('gives the gate, which has a plan opening, one door detail only', () => {
    expect(detailsOf('garden').filter((d) => d.name === 'gate')).toHaveLength(1);
  });

  it("sets the front garden's four windows and the kitchen's in their face, from sill to head", () => {
    for (const [key, count] of [
      ['frontGarden', 4],
      ['garden', 1],
    ] as const) {
      const room = ROOMS[key];
      const plan = roomPlan3d(room);
      const windows = detailsOf(key).filter((d) => d.kind === 'window');
      expect(windows).toHaveLength(count);
      const faces = plan.furniture.filter((b) => b.name.endsWith('_face'));
      for (const window of windows) {
        const { x0, x1, y0, y1, z1 } = extent(window);
        const zs = window.parts.map((p) => p.z0);
        expect(Math.min(...zs)).toBe(WINDOW_SILL);
        expect(z1).toBe(WINDOW_HEAD);
        // On a face, standing proud of it on both sides, and no taller than it.
        const face = faces.find((f) => f.x0 <= x0 && f.x1 >= x1);
        expect(face).toBeDefined();
        expect(y0).toBeCloseTo((face?.y0 ?? 0) - FACE_RELIEF, 9);
        expect(y1).toBeCloseTo((face?.y1 ?? 0) + FACE_RELIEF, 9);
        expect(z1).toBeLessThan(face?.z1 ?? 0);
        // It hangs from that face, so the camera's cut takes it away with the face.
        expect(window.host).toBe(face?.name);
      }
    }
  });

  it("stands the garage's roller door its 40 px tall over its 2.4 m span, hung from the garage face", () => {
    const plan = roomPlan3d(ROOMS.frontGarden);
    const door = detailsOf('frontGarden').find((d) => d.name.endsWith('_roller_door'));
    if (door === undefined) throw new Error('no roller door');
    const garage = plan.furniture.find((b) => b.name.endsWith('_face'));
    expect(door).toMatchObject({ kind: 'door', host: garage?.name });
    const { x0, x1, y0, y1, z1 } = extent(door);
    expect(z1).toBe(heightMetres(40));
    expect(x1 - x0).toBeCloseTo(77 / 32, 9);
    expect(y0).toBeCloseTo((garage?.y0 ?? 0) - FACE_RELIEF, 9);
    expect(y1).toBeCloseTo((garage?.y1 ?? 0) + FACE_RELIEF, 9);
  });

  it('is empty for a room with nothing to model', () => {
    expect(countDetails([])).toEqual({});
  });
});
