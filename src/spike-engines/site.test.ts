import { describe, expect, it } from 'vitest';
import { FRONT_GARDEN_BOUNDS, PATH, ROAD } from '../world/frontGardenRoom';
import { CUT_HEIGHT, SITE, cutaway, ridgeHeight, roomToSite, siteBlocks, type Block } from './site';

const named = (blocks: readonly Block[], name: string): Block[] =>
  blocks.filter((b) => b.name === name);
const only = (blocks: readonly Block[], name: string): Block => {
  const [b, ...rest] = named(blocks, name);
  if (!b || rest.length > 0) throw new Error(`expected one ${name}`);
  return b;
};

describe('the spike site', () => {
  it("maps the front garden's room px to plan B3's metres", () => {
    expect(roomToSite({ x: FRONT_GARDEN_BOUNDS.x, y: FRONT_GARDEN_BOUNDS.y })).toEqual({
      x: -3.5,
      y: -4,
    });
    expect(
      roomToSite({
        x: FRONT_GARDEN_BOUNDS.x + FRONT_GARDEN_BOUNDS.w,
        y: FRONT_GARDEN_BOUNDS.y + FRONT_GARDEN_BOUNDS.h,
      }),
    ).toEqual({ x: 14.5, y: 0 });
    expect(roomToSite({ x: 0, y: 0 }).y).toBe(SITE.road.y0);
    expect(roomToSite({ x: 0, y: ROAD.h }).y).toBe(SITE.road.y1);
    // The front door's prop and the path's centre, room x 336, are the plan's x 7 m.
    expect(roomToSite({ x: PATH.x + PATH.w / 2, y: 0 }).x).toBe(SITE.frontDoor.x);
  });

  it("draws the plan's buildings at their real sizes", () => {
    const blocks = siteBlocks();
    const house = only(blocks, 'house');
    expect([house.x1 - house.x0, house.y1 - house.y0, house.z1]).toEqual([13, 4.5, 2.4]);
    const garage = only(blocks, 'garage');
    expect([garage.x0, garage.x1, garage.y0, garage.y1]).toEqual([-3.5, 0, 0, 8]);
    // A 35 degree pitch over the 4.5 m depth: the ridge 1.58 m over the eaves.
    expect(ridgeHeight()).toBeCloseTo(2.4 + 2.25 * Math.tan((35 * Math.PI) / 180), 9);
    expect(ridgeHeight()).toBeCloseTo(3.98, 2);
    const slabs = [only(blocks, 'roof north'), only(blocks, 'roof south')];
    expect(slabs.map((s) => Math.sign(s.tilt ?? 0))).toEqual([1, -1]);
  });

  it('puts the front door on the house front at the top of the path, and every window in the face', () => {
    const blocks = siteBlocks();
    const house = only(blocks, 'house');
    const door = only(blocks, 'front door');
    const path = only(blocks, 'path');
    expect((door.x0 + door.x1) / 2).toBe(7);
    expect(door.x0).toBeGreaterThanOrEqual(path.x0 - 0.1);
    expect(door.x1).toBeLessThanOrEqual(path.x1 + 0.1);
    // Standing proud of the face on the garden side, its foot on the lawn, under the eaves.
    expect([door.y1, door.z0]).toEqual([house.y0, 0]);
    expect(door.z1).toBeLessThan(house.z1);
    expect(path.y1).toBe(house.y0);
    for (const w of named(blocks, 'window')) {
      expect(w.y1).toBe(house.y0);
      expect(w.x0).toBeGreaterThan(house.x0);
      expect(w.x1).toBeLessThan(house.x1);
      expect(w.z1).toBeLessThan(house.z1);
      // No window overlaps the door.
      expect(w.x1 < door.x0 || w.x0 > door.x1).toBe(true);
    }
  });

  it('leaves the low fence open at the drive and the path', () => {
    const fence = siteBlocks().filter((b) => b.name.startsWith('fence'));
    const across = (x: number): boolean => fence.some((b) => b.x0 < x && b.x1 > x);
    expect(across(-1.75)).toBe(false);
    expect(across(7)).toBe(false);
    expect(across(3)).toBe(true);
    expect(across(10)).toBe(true);
  });

  it('cuts the buildings down to the cut height and leaves the garden whole', () => {
    const blocks = siteBlocks();
    const cut = cutaway(blocks);
    expect(named(cut, 'roof north')).toEqual([]);
    expect(named(cut, 'garage roof')).toEqual([]);
    expect(only(cut, 'house').z1).toBe(CUT_HEIGHT);
    expect(only(cut, 'front door').z1).toBe(CUT_HEIGHT);
    for (const name of ['lawn', 'path', 'passage fence', 'shrub']) {
      expect(named(cut, name)).toEqual(named(blocks, name));
    }
  });
});
