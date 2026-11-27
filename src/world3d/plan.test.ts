import { describe, expect, it } from 'vitest';
import { ROOMS } from '../world/gardenRoom';
import { BACK_WALL_FACE, FENCE_HEIGHT, LOW_FENCE_HEIGHT } from '../world/roomArt';
import { furnitureWalls, type RoomKey } from '../world/shedRoom';
import { AVATAR_SCALE } from './character';
import { BICYCLE_SCALE, TABLE_HEIGHT } from './furnitureModels';
import { PLAYER_HEIGHT } from './meshes';
import {
  DOOR_HEIGHT,
  FENCE_HEIGHT_M,
  LOW_FENCE_HEIGHT_M,
  ROOF_OVERHANG,
  ROOF_PITCH,
  ROOF_RISE_MAX,
  ROOF_STRIP_LOW,
  WALL_HEIGHT,
  WINDOW_HEAD,
  WINDOW_SILL,
  heightMetres,
  metres,
  roofOf,
  roomPlan3d,
  type Box,
} from './plan';

const KEYS = Object.keys(ROOMS) as RoomKey[];

/** A footprint, metres. */
interface Foot {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const covers = (feet: readonly Foot[], x: number, y: number): boolean =>
  feet.some((f) => x > f.x0 && x < f.x1 && y > f.y0 && y < f.y1);

/** The first cell of the grid the two sets' edges make that one covers and the other does not, or undefined. */
function firstDifference(a: readonly Foot[], b: readonly Foot[]): string | undefined {
  const all = [...a, ...b];
  const xs = [...new Set(all.flatMap((f) => [f.x0, f.x1]))].sort((p, q) => p - q);
  const ys = [...new Set(all.flatMap((f) => [f.y0, f.y1]))].sort((p, q) => p - q);
  for (let i = 0; i + 1 < xs.length; i += 1) {
    for (let j = 0; j + 1 < ys.length; j += 1) {
      const x = ((xs[i] ?? 0) + (xs[i + 1] ?? 0)) / 2;
      const y = ((ys[j] ?? 0) + (ys[j + 1] ?? 0)) / 2;
      if (covers(a, x, y) !== covers(b, x, y)) return `(${String(x)}, ${String(y)}) m`;
    }
  }
  return undefined;
}

const wallBox = (key: RoomKey, name: string): Box => {
  const found = roomPlan3d(ROOMS[key]).walls.find((w) => w.name === name);
  if (found === undefined) throw new Error(`${key} has no ${name}`);
  return found;
};

describe('roomPlan3d scale', () => {
  it('draws 32 room px to the metre, and heights at the scale rule 21.33 px to the metre', () => {
    expect(metres(32)).toBe(1);
    expect(metres(16)).toBe(0.5);
    expect(heightMetres(64)).toBe(3);
    expect(heightMetres(FENCE_HEIGHT)).toBe(FENCE_HEIGHT_M);
    expect(heightMetres(LOW_FENCE_HEIGHT)).toBeCloseTo(LOW_FENCE_HEIGHT_M, 1);
  });

  it('puts the player start in metres', () => {
    expect(roomPlan3d(ROOMS.shed).playerStart).toEqual({ x: 7.5, y: 135 / 32 });
  });
});

describe('roomPlan3d walls', () => {
  // One uncut ring wall per room, by its numbers: the 2D rect in px is in the comment.
  const cases: [RoomKey, string, Partial<Box> & { side: string }][] = [
    // (384, 48, 16, 176)
    ['shed', 'wall.3', { x0: 12, x1: 12.5, y0: 1.5, y1: 7, z1: WALL_HEIGHT, side: 'E' }],
    // (448, 0, 16, 512)
    ['garden', 'wall.3', { x0: 14, x1: 14.5, y0: 0, y1: 16, z1: FENCE_HEIGHT_M, side: 'E' }],
    // (560, 96, 16, 128)
    ['frontGarden', 'wall.3', { x0: 17.5, x1: 18, y0: 3, y1: 7, z1: FENCE_HEIGHT_M, side: 'E' }],
    // (432, 48, 16, 176)
    ['lounge', 'wall.3', { x0: 13.5, x1: 14, y0: 1.5, y1: 7, z1: WALL_HEIGHT, side: 'E' }],
    // (176, 208, 128, 16)
    ['hallway', 'wall.1', { x0: 5.5, x1: 9.5, y0: 6.5, y1: 7, z1: WALL_HEIGHT, side: 'S' }],
    // (304, 48, 16, 176)
    ['study', 'wall.3', { x0: 9.5, x1: 10, y0: 1.5, y1: 7, z1: WALL_HEIGHT, side: 'E' }],
    // (320, 64, 16, 144)
    ['greenhouse', 'wall.3', { x0: 10, x1: 10.5, y0: 2, y1: 6.5, z1: WALL_HEIGHT, side: 'E' }],
  ];

  it.each(cases)('%s: %s is the 2D rect extruded', (key, name, expected) => {
    expect(wallBox(key, name)).toMatchObject({ z0: 0, solid: true, ...expected });
  });

  it("stands the front garden's low fence along its rows", () => {
    expect(wallBox('frontGarden', 'wall.0')).toMatchObject({ z1: LOW_FENCE_HEIGHT_M, side: 'N' });
  });

  it('gives every room a floor and walls, and marks its ring by side', () => {
    for (const key of KEYS) {
      const plan = roomPlan3d(ROOMS[key]);
      expect(plan.floor.length, key).toBeGreaterThan(0);
      expect(plan.walls.length, key).toBeGreaterThan(0);
      expect(plan.floor[0], key).toMatchObject({ name: 'floor', z1: 0 });
      for (const side of ['N', 'S', 'E', 'W']) {
        expect(
          plan.walls.some((w) => w.side === side),
          `${key} ${side}`,
        ).toBe(true);
      }
    }
  });

  it('stands the garden buildings at 2.4 m against the edge they touch', () => {
    expect(wallBox('garden', 'wall.4')).toMatchObject({ z1: WALL_HEIGHT, side: 'N' });
    expect(wallBox('garden', 'wall.5')).toMatchObject({ z1: WALL_HEIGHT, side: 'W' });
  });
});

describe('roomPlan3d openings', () => {
  it("opens the shed's south wall for the door: 1 m wide, 2 m high, a lintel over it", () => {
    const plan = roomPlan3d(ROOMS.shed);
    expect(plan.openings.find((o) => o.name === 'door')).toEqual({
      name: 'door',
      kind: 'door',
      x0: 7,
      x1: 8,
      y0: 6.5,
      y1: 7,
      z0: 0,
      z1: DOOR_HEIGHT,
    });
    expect(wallBox('shed', 'wall.1.lintel.door')).toMatchObject({
      x0: 7,
      x1: 8,
      z0: DOOR_HEIGHT,
      z1: WALL_HEIGHT,
      side: 'S',
    });
    const south = plan.walls.filter((w) => w.name.startsWith('wall.1'));
    expect(south.filter((w) => w.z0 === 0).map((w) => [w.x0, w.x1])).toEqual([
      [2.5, 7],
      [8, 12.5],
    ]);
    // Nothing stands in the doorway between the floor and the lintel.
    expect(south.some((w) => w.x0 <= 7.5 && w.x1 >= 7.5 && w.z0 < DOOR_HEIGHT)).toBe(false);
  });

  it("opens the front garden's low south wall for the front door and the gate", () => {
    const plan = roomPlan3d(ROOMS.frontGarden);
    expect(plan.openings.find((o) => o.name === 'door_house')).toMatchObject({
      x0: 10,
      x1: 11,
      y0: 6.5,
      y1: 7,
      z0: 0,
      z1: DOOR_HEIGHT,
    });
    expect(plan.openings.find((o) => o.name === 'gate')).toMatchObject({ x0: 16.5, x1: 17.5 });
    // The wall there is the 0.5 m fence, under the door's head: the pieces leave it clear, no lintel.
    expect(plan.walls.some((w) => w.name.includes('lintel'))).toBe(false);
    const south = plan.walls.filter((w) => w.name.startsWith('wall.1'));
    expect(south.some((w) => w.x0 < 10.5 && w.x1 > 10.5)).toBe(false);
  });

  it('cuts a window in the top wall from its sill to its head', () => {
    const plan = roomPlan3d(ROOMS.shed);
    expect(plan.openings.find((o) => o.kind === 'window')).toMatchObject({
      x0: 8.25,
      x1: 9.25,
      y0: 1.5,
      y1: 2,
      z0: WINDOW_SILL,
      z1: WINDOW_HEAD,
    });
    expect(wallBox('shed', 'wall.0.sill.window.0')).toMatchObject({ z0: 0, z1: WINDOW_SILL });
    expect(wallBox('shed', 'wall.0.lintel.window.0')).toMatchObject({
      z0: WINDOW_HEAD,
      z1: WALL_HEIGHT,
    });
  });

  it('cuts a door in a side wall along y, and none in a building the door stands against', () => {
    const hallway = roomPlan3d(ROOMS.hallway);
    expect(hallway.openings.find((o) => o.name === 'door_lounge')).toMatchObject({
      x0: 5.5,
      x1: 6,
      y0: 5,
      y1: 6,
    });
    const garden = roomPlan3d(ROOMS.garden);
    expect(garden.openings.map((o) => o.name)).toEqual(['gate']);
    expect(garden.anchors.map((a) => a.key)).toContain('door_study');
  });

  it('anchors every prop with its wall, in metres', () => {
    const plan = roomPlan3d(ROOMS.shed);
    expect(plan.anchors.find((a) => a.key === 'door')).toMatchObject({
      x: 7.5,
      y: 6.75,
      wall: 'S',
    });
    expect(plan.anchors.find((a) => a.key === 'workbench')).not.toHaveProperty('wall');
    expect(plan.anchors).toHaveLength(ROOMS.shed.props.length);
  });
});

describe('roomPlan3d furniture', () => {
  it('stands solid furniture at its height and keeps it solid', () => {
    const solid = roomPlan3d(ROOMS.lounge).furniture.filter((f) => f.solid);
    expect(solid.length).toBeGreaterThan(0);
    expect(solid.map((f) => f.z1)).toContain(heightMetres(20));
    expect(solid.every((f) => f.z0 === 0)).toBe(true);
  });

  it("washes the lounge's hallway mass as the room's wallpaper, 3 x 2 x 2.25 m and solid", () => {
    const mass = roomPlan3d(ROOMS.lounge).furniture.find((f) => f.name.endsWith('spr_paper'));
    expect(mass).toMatchObject({
      wash: 'wallpaper',
      x0: 10.5,
      x1: 13.5,
      y0: 2,
      y1: 4,
      z0: 0,
      z1: 2.25,
      solid: true,
    });
  });

  it('washes furniture wood unless it is a papered wall', () => {
    const wood = roomPlan3d(ROOMS.lounge).furniture.filter((f) => !f.name.endsWith('spr_paper'));
    expect(wood.some((f) => f.wash === 'wood')).toBe(true);
    expect(wood.every((f) => f.wash !== 'wallpaper')).toBe(true);
  });

  it('lays flat furniture as a slab, and the road beyond the bounds as floor', () => {
    const plan = roomPlan3d(ROOMS.frontGarden);
    expect(plan.floor.find((f) => f.wash === 'asphalt')).toMatchObject({
      x0: 0,
      x1: 18,
      y0: 0,
      y1: 3,
      z1: 0,
    });
    expect(plan.furniture.find((f) => f.wash === 'soil')).toMatchObject({ z0: 0, z1: 0.01 });
  });

  it('puts the shed clutter on its foot, not the whole frame', () => {
    // spr_shelf: (208, 67, 24, 20), 12 px tall on the bottom 8 px.
    const shelf = roomPlan3d(ROOMS.shed).furniture[0];
    expect(shelf).toMatchObject({ x0: 6.5, x1: 7.25, y0: 79 / 32, y1: 87 / 32, solid: false });
    expect(shelf?.z1).toBe(heightMetres(12));
  });
});

describe('roomPlan3d pieces on a building face', () => {
  it('draws no box for a wall cap or a window, which the walls and the face details stand for', () => {
    for (const key of KEYS) {
      const names = roomPlan3d(ROOMS[key]).furniture.map((b) => b.name);
      expect(names.filter((n) => /_cap(_v)?$|spr_house_window$/.test(n))).toEqual([]);
    }
  });
});

describe('roomPlan3d shed furniture props', () => {
  const standing = (key: string): Box | undefined =>
    roomPlan3d(ROOMS.shed).furniture.find((b) => b.name === `prop.${key}`);

  it.each([
    ['workbench', 40, 20],
    ['planting_table', 32, 20],
  ])('%s: stands on its %i x %i px footprint at the waist of the player', (key, w, d) => {
    const prop = ROOMS.shed.props.find((p) => p.key === key);
    const box = standing(key);
    expect(prop).toBeDefined();
    expect(TABLE_HEIGHT).toBe(0.65);
    expect(box).toMatchObject({ z0: 0, z1: TABLE_HEIGHT, solid: false });
    expect(TABLE_HEIGHT).toBeLessThan(PLAYER_HEIGHT * AVATAR_SCALE);
    expect((box?.x1 ?? 0) - (box?.x0 ?? 0)).toBeCloseTo(metres(w), 9);
    expect((box?.y1 ?? 0) - (box?.y0 ?? 0)).toBeCloseTo(metres(d), 9);
    expect(((box?.x0 ?? 0) + (box?.x1 ?? 0)) / 2).toBeCloseTo(metres(prop?.x ?? 0), 9);
    expect(((box?.y0 ?? 0) + (box?.y1 ?? 0)) / 2).toBeCloseTo(metres(prop?.y ?? 0), 9);
  });

  it('stands the bicycle at 70% of its 54 x 8 px footprint and 22 px frame, about the footprint middle', () => {
    const box = roomPlan3d(ROOMS.frontGarden).furniture.find((b) => b.name === 'prop.shop_bicycle');
    expect(BICYCLE_SCALE).toBe(0.7);
    expect(box).toMatchObject({ z0: 0, solid: false, model: 'bicycle' });
    expect(box?.z1 ?? 0).toBeCloseTo(heightMetres(22) * 0.7, 9);
    expect((box?.x1 ?? 0) - (box?.x0 ?? 0)).toBeCloseTo(metres(54) * 0.7, 9);
    expect((box?.y1 ?? 0) - (box?.y0 ?? 0)).toBeCloseTo(metres(8) * 0.7, 9);
    expect(((box?.x0 ?? 0) + (box?.x1 ?? 0)) / 2).toBeCloseTo(metres(284), 9);
    expect(((box?.y0 ?? 0) + (box?.y1 ?? 0)) / 2).toBeCloseTo(metres(196), 9);
    // Its top, the handlebars, is about the player's waist, 0.72 m of their 1.21 m.
    expect(box?.z1 ?? 0).toBeLessThan(0.75);
    expect(roomPlan3d(ROOMS.shed).furniture.some((b) => b.name === 'prop.shop_kiosk')).toBe(false);
  });

  it("lays the rug flat on the floor over the rug's 120 x 70 px rect", () => {
    const rug = roomPlan3d(ROOMS.shed).furniture.find((b) => b.name.endsWith('spr_shed_rug'));
    expect(rug).toMatchObject({ z0: 0, z1: 0.01, solid: false });
    expect((rug?.x1 ?? 0) - (rug?.x0 ?? 0)).toBeCloseTo(3.75, 9);
    expect((rug?.y1 ?? 0) - (rug?.y0 ?? 0)).toBeCloseTo(70 / 32, 9);
  });
});

describe('roomPlan3d building faces', () => {
  it('draws the front garden faces WALL_HEIGHT tall over the south band', () => {
    const faces = roomPlan3d(ROOMS.frontGarden).furniture.filter((b) => b.name.endsWith('_face'));
    expect(faces).toHaveLength(2);
    for (const face of faces) {
      expect(face).toMatchObject({ wash: 'render', z0: 0, z1: WALL_HEIGHT, solid: false });
      expect(face.y1 - face.y0).toBe(0.5);
    }
  });
});

describe('roomPlan3d collision', () => {
  it.each(KEYS)('%s: the solid footprints and the door openings are the 2D collision', (key) => {
    const room = ROOMS[key];
    const plan = roomPlan3d(room);
    const collision: Foot[] = [...room.walls, ...furnitureWalls(room.furniture)].map((r) => ({
      x0: metres(r.x),
      x1: metres(r.x + r.w),
      y0: metres(r.y),
      y1: metres(r.y + r.h),
    }));
    const solid = [...plan.walls, ...plan.furniture].filter((b) => b.solid);
    const doors = plan.openings.filter((o) => o.kind === 'door');
    // A door is a prop to interact with, not a gap to walk through: the 2D wall is solid across it,
    // so the wall's pieces and the door's own opening together are the collision, no more and no less.
    expect(firstDifference([...solid, ...doors], collision)).toBeUndefined();
    // And every opening lies inside that collision: no door or window is walkable.
    expect(firstDifference([...plan.openings, ...collision], collision)).toBeUndefined();
  });
});

describe('roomPlan3d roofs', () => {
  const garden = roomPlan3d(ROOMS.garden);
  const eaves = heightMetres(BACK_WALL_FACE);
  /** The room's roof run by sheet key, in metres. */
  const run = (key: RoomKey, sheet: string): Foot => {
    const r = ROOMS[key].furniture.find((f) => f.sheet.key === sheet);
    if (r === undefined) throw new Error(sheet);
    return { x0: metres(r.x), x1: metres(r.x + r.w), y0: metres(r.y), y1: metres(r.y + r.h) };
  };
  const roofOver = (sheet: string, plan = garden) => {
    const roof = plan.roofs.find((r) => r.name.endsWith(sheet));
    if (roof === undefined) throw new Error(sheet);
    return roof;
  };

  it.each([
    ['spr_house_roof', 'tile'],
    ['spr_shed_roof', 'tile'],
    ['spr_greenhouse_roof', 'paint'],
  ] as const)('%s: a gable on its walls, ridge along its longer axis', (sheet, wash) => {
    const foot = run('garden', sheet);
    const roof = roofOver(sheet);
    expect(roof.wash).toBe(wash);
    expect(roof.form).toEqual({ kind: 'gable', axis: 'x' });
    expect(roof.low).toBeCloseTo(eaves);
    expect(roof.x0).toBeCloseTo(foot.x0 - ROOF_OVERHANG);
    expect(roof.x1).toBeCloseTo(foot.x1 + ROOF_OVERHANG);
    expect(roof.y0).toBeCloseTo(foot.y0 - ROOF_OVERHANG);
    expect(roof.y1).toBeCloseTo(foot.y1 + ROOF_OVERHANG);
    const half = (roof.y1 - roof.y0) / 2;
    expect(roof.high - roof.low).toBeCloseTo(Math.min(ROOF_RISE_MAX, half * Math.tan(ROOF_PITCH)));
    // The box under the roof still stands at the eaves.
    expect(garden.furniture.find((b) => b.name.endsWith(sheet))?.z1).toBeCloseTo(eaves);
  });

  it('pitches a shallow footprint at 30 degrees and caps a deep one', () => {
    const house = roofOver('spr_house_roof');
    const shed = roofOver('spr_shed_roof');
    expect(house.high - house.low).toBeCloseTo(ROOF_RISE_MAX);
    const half = (shed.y1 - shed.y0) / 2;
    expect((shed.high - shed.low) / half).toBeCloseTo(Math.tan(ROOF_PITCH));
    expect(shed.high - shed.low).toBeLessThan(ROOF_RISE_MAX);
  });

  it('runs the ridge of a footprint longer north-south along y', () => {
    const box: Box = {
      name: 'b',
      wash: 'tile',
      x0: 0,
      x1: 2,
      y0: 0,
      y1: 6,
      z0: 0,
      z1: eaves,
      solid: false,
    };
    const roof = roofOf('r', box, false);
    expect(roof.form).toEqual({ kind: 'gable', axis: 'y' });
    expect(roof.high - roof.low).toBeCloseTo((1 + ROOF_OVERHANG) * Math.tan(ROOF_PITCH));
  });

  it("falls the front garden's roof strip from the face's top to a low south edge", () => {
    const front = roomPlan3d(ROOMS.frontGarden);
    const foot = run('frontGarden', 'spr_house_roof');
    const roof = roofOver('spr_house_roof', front);
    expect(front.roofs).toHaveLength(1);
    expect(roof.form).toEqual({ kind: 'slope', high: 'N' });
    expect(roof.high).toBeCloseTo(eaves);
    expect(roof.low).toBe(ROOF_STRIP_LOW);
    expect(roof).toMatchObject(foot);
    // No slab is left where the strip lies.
    expect(front.furniture.some((b) => b.name.endsWith('spr_house_roof'))).toBe(false);
  });
});
