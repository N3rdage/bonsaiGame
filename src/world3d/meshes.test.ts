import { describe, expect, it } from 'vitest';
import { ROOMS } from '../world/gardenRoom';
import type { RoomKey } from '../world/shedRoom';
import {
  fromBabylon,
  hotspotSpecs,
  meshSpecs,
  playerFeet,
  roomPx,
  toBabylon,
  type MeshSpec,
} from './meshes';
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

  it.each(KEYS)('%s: gives every mesh its own name', (key) => {
    const names = meshSpecs(roomPlan3d(ROOMS[key])).map((spec) => spec.name);
    expect(new Set(names).size).toBe(names.length);
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

describe('roomPx', () => {
  it('inverts toBabylon after playerFeet, to the pixel', () => {
    for (const px of [
      { x: 0, y: 0 },
      { x: 64, y: 96 },
      { x: 213.5, y: 37.25 },
      { x: 480, y: 270 },
    ]) {
      const back = roomPx(toBabylon(playerFeet(px)));
      expect(back.x).toBeCloseTo(px.x, 9);
      expect(back.y).toBeCloseTo(px.y, 9);
    }
  });

  it('inverts toBabylon in the plan frame', () => {
    const p = { x: 1.5, y: -2, z: 3 };
    expect(fromBabylon(toBabylon(p))).toEqual(p);
  });
});

describe('hotspotSpecs', () => {
  it.each(KEYS)('%s: one box per prop, under the prop key, at least a door wide', (key) => {
    const specs = hotspotSpecs(roomPlan3d(ROOMS[key]));
    expect(specs.map((s) => s.key)).toEqual(ROOMS[key].props.map((p) => p.key));
    for (const s of specs) {
      expect(s.width).toBeGreaterThanOrEqual(1);
      expect(s.depth).toBeGreaterThanOrEqual(1);
    }
  });

  it('centres the shed workbench over its prop', () => {
    const bench = ROOMS.shed.props.find((p) => p.key === 'workbench');
    const spec = hotspotSpecs(roomPlan3d(ROOMS.shed)).find((s) => s.key === 'workbench');
    expect(spec && roomPx(spec.center)).toEqual({ x: bench?.x, y: bench?.y });
  });
});

type Triple = readonly [number, number, number];

interface Extent {
  readonly name: string;
  readonly lo: Triple;
  readonly hi: Triple;
}

const AXES = ['x', 'y', 'z'] as const;
const TOLERANCE = 1e-6;
const MIN_OVERLAP_AREA = 1e-4;

function extentOf(s: MeshSpec): Extent {
  const { x, y, z } = s.center;
  return {
    name: s.name,
    lo: [x - s.width / 2, y - s.height / 2, z - s.depth / 2],
    hi: [x + s.width / 2, y + s.height / 2, z + s.depth / 2],
  };
}

const lies = (p: Extent, q: Extent): boolean =>
  AXES.every(
    (_, i) =>
      (p.lo[i] ?? 0) >= (q.lo[i] ?? 0) - TOLERANCE && (p.hi[i] ?? 0) <= (q.hi[i] ?? 0) + TOLERANCE,
  );

/** How far two boxes overlap along an axis; negative when they are apart. */
const overlap = (a: Extent, b: Extent, i: number): number =>
  Math.min(a.hi[i] ?? 0, b.hi[i] ?? 0) - Math.max(a.lo[i] ?? 0, b.lo[i] ?? 0);

/**
 * The faults of a room's drawn boxes, in the renderer's frame (y up): a box
 * nested in another, or two boxes whose faces a camera above can see (every
 * side and every top, never an underside) lie in one plane facing one way and
 * overlap in area, which the depth test fights over.
 */
function surfaceFaults(specs: readonly MeshSpec[]): string[] {
  const extents = specs.map(extentOf);
  const faults: string[] = [];
  extents.forEach((a, n) => {
    for (const b of extents.slice(n + 1)) {
      if (lies(a, b) || lies(b, a)) faults.push(`${a.name} is nested with ${b.name}`);
      AXES.forEach((axis, i) => {
        const area = [0, 1, 2]
          .filter((other) => other !== i)
          .reduce((product, other) => product * Math.max(0, overlap(a, b, other)), 1);
        if (area < MIN_OVERLAP_AREA) return;
        if (Math.abs((a.hi[i] ?? 0) - (b.hi[i] ?? 0)) < TOLERANCE) {
          faults.push(`${a.name} and ${b.name} share a face looking +${axis}`);
        }
        if (axis !== 'y' && Math.abs((a.lo[i] ?? 0) - (b.lo[i] ?? 0)) < TOLERANCE) {
          faults.push(`${a.name} and ${b.name} share a face looking -${axis}`);
        }
      });
    }
  });
  return faults;
}

describe('meshSpecs surfaces', () => {
  it.each(KEYS)('%s: draws no box nested in, or coplanar with, another', (key) => {
    expect(surfaceFaults(meshSpecs(roomPlan3d(ROOMS[key])))).toEqual([]);
  });
});
