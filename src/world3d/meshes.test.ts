import { describe, expect, it } from 'vitest';
import { ROOMS } from '../world/gardenRoom';
import type { RoomKey } from '../world/shedRoom';
import { meshSpecs, playerFeet, toBabylon } from './meshes';
import { WALL_HEIGHT, roomPlan3d } from './plan';

const KEYS = Object.keys(ROOMS) as RoomKey[];

describe('toBabylon', () => {
  it('keeps east on +x, lifts up to y and sends south to -z', () => {
    expect(toBabylon({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 3, z: -2 });
  });

  it('puts north away from a camera in the south, with east on its right', () => {
    const north = toBabylon({ x: 0, y: -1, z: 0 });
    const east = toBabylon({ x: 1, y: 0, z: 0 });
    expect(north.z).toBeGreaterThan(0);
    expect(east.x).toBeGreaterThan(0);
  });
});

describe('meshSpecs', () => {
  it('turns a box into its centre and extents in the renderer frame', () => {
    const [floor] = meshSpecs(roomPlan3d(ROOMS.shed));
    const slab = roomPlan3d(ROOMS.shed).floor[0];
    expect(floor).toMatchObject({
      name: 'floor',
      wash: 'floor',
      width: (slab?.x1 ?? 0) - (slab?.x0 ?? 0),
      height: 0.1,
      depth: (slab?.y1 ?? 0) - (slab?.y0 ?? 0),
    });
    expect(floor?.center.y).toBeCloseTo(-0.05);
  });

  it.each(KEYS)('%s: lists the floor, walls and furniture, none empty', (key) => {
    const plan = roomPlan3d(ROOMS[key]);
    const specs = meshSpecs(plan);
    expect(specs.length).toBeGreaterThanOrEqual(plan.floor.length + plan.furniture.length);
    for (const spec of specs) {
      expect(spec.width).toBeGreaterThan(0);
      expect(spec.height).toBeGreaterThan(0);
      expect(spec.depth).toBeGreaterThan(0);
    }
  });

  it('draws the front garden faces at the wall height and hides the band wall beneath them', () => {
    const plan = roomPlan3d(ROOMS.frontGarden);
    const specs = meshSpecs(plan);
    const faces = specs.filter((s) => s.name.endsWith('_face'));
    expect(faces).toHaveLength(2);
    for (const face of faces) expect(face.height).toBe(WALL_HEIGHT);
    expect(specs.filter((s) => s.name.startsWith('wall.')).length).toBeLessThan(plan.walls.length);
  });
});

describe('playerFeet', () => {
  it('converts room px to plan metres on the floor', () => {
    expect(playerFeet({ x: 64, y: 96 })).toEqual({ x: 2, y: 3, z: 0 });
  });
});
