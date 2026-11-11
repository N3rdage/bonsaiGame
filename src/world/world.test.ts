import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import { hudText } from './hud';
import {
  JOYSTICK_DEAD_ZONE,
  JOYSTICK_RADIUS,
  MAX_STEPS_PER_FRAME,
  STEP_MS,
  fixedSteps,
  joystickInput,
  keyboardInput,
} from './input';
import {
  MOVE_SPEED,
  WALK_ANIM_STEP,
  createPlayer,
  stepPlayer,
  type MoveInput,
  type PlayerState,
} from './player';
import { DOORWAY, GARDEN_ROOM, ROOMS } from './gardenRoom';
import { INTERACT_RANGE, nearestInteractable } from './interactables';
import { HALLWAY_ROOM } from './hallwayRoom';
import { LOUNGE_ROOM } from './loungeRoom';
import { STUDY_ROOM } from './studyRoom';
import {
  SHED_RING,
  SHED_ROOM,
  WALL_BAND,
  fromPrototype,
  hitsWall,
  insideWalls,
  ringWalls,
  type Prop,
  type Rect,
  type Room,
} from './shedRoom';

const door = (room: Room, key = 'door') => {
  const d = room.props.find((p) => p.key === key);
  if (!d) throw new Error(`no ${key}`);
  return d;
};

describe('shed room', () => {
  it('halves every prototype coordinate onto the 480x270 canvas', () => {
    expect(fromPrototype(960)).toBe(480);
    expect(SHED_ROOM.width).toBe(480);
    expect(SHED_ROOM.height).toBe(270);
    expect(SHED_ROOM.playerStart).toEqual({ x: 240, y: 135 });
    expect(SHED_ROOM.edgeMargin).toBe(4);
    expect(SHED_ROOM.props.map((p) => [p.key, p.x, p.y])).toEqual([
      ['workbench', 125, 90],
      ['planting_table', 165, 90],
      ['shop_kiosk', 125, 145],
      ['door', 240, 216],
      ['door_lounge', 240, 56],
    ]);
  });

  it("is the prototype's inset room: SHED_X0..SHED_Y1 (160, 96)..(768, 416) and one tile, halved", () => {
    expect(SHED_RING).toEqual({ x0: 80, y0: 48, x1: 384, y1: 208 });
    expect(WALL_BAND).toBe(16);
    expect(SHED_ROOM.bounds).toEqual({ x: 80, y: 48, w: 320, h: 176 });
    // Draw_0's floor: (SHED_X0 + 32, SHED_Y0 + 32)..(SHED_X1, SHED_Y1).
    expect(insideWalls(SHED_ROOM)).toEqual({ x: 96, y: 64, w: 288, h: 144 });
  });

  it('rings the shed with 16 px wall bands on all four sides, the bottom one solid', () => {
    expect(SHED_ROOM.walls).toEqual([
      { x: 80, y: 48, w: 320, h: 16 },
      { x: 80, y: 208, w: 320, h: 16 },
      { x: 80, y: 48, w: 16, h: 176 },
      { x: 384, y: 48, w: 16, h: 176 },
    ]);
    expect(hitsWall(SHED_ROOM, 95.9, 135)).toBe(true);
    expect(hitsWall(SHED_ROOM, 96, 135)).toBe(false);
    expect(hitsWall(SHED_ROOM, 383.9, 135)).toBe(false);
    expect(hitsWall(SHED_ROOM, 384, 135)).toBe(true);
    expect(hitsWall(SHED_ROOM, 240, 63.9)).toBe(true);
    expect(hitsWall(SHED_ROOM, 240, 64)).toBe(false);
    expect(hitsWall(SHED_ROOM, 240, 207.9)).toBe(false);
    expect(hitsWall(SHED_ROOM, 240, 208)).toBe(true);
    expect(hitsWall(SHED_ROOM, 240, 223.9)).toBe(true);
  });

  it("centres the door on inst_52E224DC's 32 px square, top-left (464, 416), in the bottom wall", () => {
    const d = door(SHED_ROOM);
    expect([d.x, d.y, d.w, d.h]).toEqual([240, 216, 16, 16]);
    expect(d.y - d.h / 2).toBe(SHED_RING.y1);
    // Walking down from the start stops on the floor just above it, in reach.
    let p = createPlayer(SHED_ROOM);
    for (let i = 0; i < 200; i += 1) p = stepPlayer(p, { x: 0, y: 1 }, SHED_ROOM);
    expect(p.y).toBeLessThan(208);
    expect(p.y).toBeGreaterThan(206);
    expect(nearestInteractable(p, SHED_ROOM.props)?.key).toBe('door');
  });

  it('takes the shed door to (100, 450) in the garden and the garden door to (480, 380) above the shed door', () => {
    expect(door(SHED_ROOM).target).toEqual({ room: 'garden', x: 50, y: 225 });
    const back = door(GARDEN_ROOM).target;
    expect(back).toEqual({ room: 'shed', x: 240, y: 190 });
    const inside = insideWalls(SHED_ROOM);
    const x = back?.x ?? 0;
    const y = back?.y ?? 0;
    expect(x > inside.x && x < inside.x + inside.w && y > inside.y && y < inside.y + inside.h).toBe(
      true,
    );
    expect(hitsWall(SHED_ROOM, x, y)).toBe(false);
    // 26 px above the door's centre: just out of its 20 px reach.
    expect(door(SHED_ROOM).y - y).toBeGreaterThan(INTERACT_RANGE);
  });
});

describe('garden room', () => {
  it('halves rm_garden_back onto the 480x270 canvas with its green floor', () => {
    expect([GARDEN_ROOM.key, GARDEN_ROOM.width, GARDEN_ROOM.height]).toEqual(['garden', 480, 270]);
    expect(GARDEN_ROOM.floor).toBe(0x30502c);
    expect(
      GARDEN_ROOM.props.map((p) => [p.key, p.label, p.prompt, p.x, p.y, p.w, p.h, p.speciesKey]),
    ).toEqual([
      ['source_juniper', 'Juniper', 'Take Cutting', 140, 90, 24, 24, 'juniper'],
      ['source_maple', 'Japanese Maple', 'Take Cutting', 260, 80, 24, 24, 'maple'],
      ['source_pine', 'Pine', 'Take Cutting', 380, 100, 24, 24, 'pine'],
      ['door', 'Door', 'Back to Shed', 16, 228, 16, 16, undefined],
    ]);
  });

  it('links the shed door and the garden door both ways', () => {
    const shedDoor = SHED_ROOM.props.find((p) => p.key === 'door');
    const gardenDoor = GARDEN_ROOM.props.find((p) => p.key === 'door');
    expect(shedDoor?.prompt).toBe('To Garden');
    expect(shedDoor?.target).toEqual({ room: 'garden', x: 50, y: 225 });
    expect(gardenDoor?.target).toEqual({ room: 'shed', x: 240, y: 190 });
    expect(ROOMS[shedDoor?.target?.room ?? 'shed']).toBe(GARDEN_ROOM);
    expect(ROOMS.shed).toBe(SHED_ROOM);
  });

  it('fences the whole room in 16 px bands but the doorway at logical y 208..240 on the left', () => {
    expect(DOORWAY).toEqual({ top: 208, bottom: 240 });
    expect(GARDEN_ROOM.bounds).toEqual({ x: 0, y: 0, w: 480, h: 270 });
    expect(GARDEN_ROOM.walls).toEqual([
      { x: 0, y: 0, w: 480, h: 16 },
      { x: 0, y: 254, w: 480, h: 16 },
      { x: 0, y: 0, w: 16, h: 208 },
      { x: 0, y: 240, w: 16, h: 30 },
      { x: 464, y: 0, w: 16, h: 270 },
    ]);
    expect(hitsWall(GARDEN_ROOM, 15.9, 100)).toBe(true);
    expect(hitsWall(GARDEN_ROOM, 16, 100)).toBe(false);
    expect(hitsWall(GARDEN_ROOM, 1, 207)).toBe(true);
    expect(hitsWall(GARDEN_ROOM, 1, 208)).toBe(false);
    expect(hitsWall(GARDEN_ROOM, 1, 239)).toBe(false);
    expect(hitsWall(GARDEN_ROOM, 1, 240)).toBe(true);
    expect(hitsWall(GARDEN_ROOM, 464, 220)).toBe(true);
    expect(hitsWall(GARDEN_ROOM, 463.9, 220)).toBe(false);
    expect(hitsWall(GARDEN_ROOM, 240, 15.9)).toBe(true);
    expect(hitsWall(GARDEN_ROOM, 240, 16)).toBe(false);
    expect(hitsWall(GARDEN_ROOM, 240, 253.9)).toBe(false);
    expect(hitsWall(GARDEN_ROOM, 240, 254)).toBe(true);
  });

  it('lets the player walk out through the doorway to the clamp', () => {
    let p: PlayerState = { ...createPlayer(GARDEN_ROOM), y: 225 };
    for (let i = 0; i < 100; i += 1) p = stepPlayer(p, { x: -1, y: 0 }, GARDEN_ROOM);
    expect(p.x).toBe(4);
    expect(nearestInteractable(p, GARDEN_ROOM.props)?.key).toBe('door');
  });
});

describe('lounge room', () => {
  it("is drawn on the shed's canvas in a ring of its own, wider and lower than the shed's, walled solid all round", () => {
    expect([LOUNGE_ROOM.key, LOUNGE_ROOM.width, LOUNGE_ROOM.height]).toEqual(['lounge', 480, 270]);
    expect(LOUNGE_ROOM.bounds).toEqual({ x: 48, y: 96, w: 384, h: 128 });
    expect(LOUNGE_ROOM.edgeMargin).toBe(SHED_ROOM.edgeMargin);
    expect(LOUNGE_ROOM.walls).toEqual([
      { x: 48, y: 96, w: 384, h: 16 },
      { x: 48, y: 208, w: 384, h: 16 },
      { x: 48, y: 96, w: 16, h: 128 },
      { x: 416, y: 96, w: 16, h: 128 },
    ]);
    expect(insideWalls(LOUNGE_ROOM)).toEqual({ x: 64, y: 112, w: 352, h: 96 });
    expect(LOUNGE_ROOM.playerStart).toEqual({ x: 240, y: 190 });
    expect(hitsWall(LOUNGE_ROOM, 240, 190)).toBe(false);
  });

  it('has two pedestals, lounge_mantel and lounge_side_table, and a door in the bottom wall', () => {
    expect(
      LOUNGE_ROOM.props.map((p) => [p.key, p.label, p.prompt, p.x, p.y, p.w, p.h, p.pedestalKey]),
    ).toEqual([
      ['pedestal_1', 'Pedestal', 'Use Pedestal', 68, 128, 16, 16, 'lounge_mantel'],
      ['pedestal_2', 'Pedestal', 'Use Pedestal', 412, 128, 16, 16, 'lounge_side_table'],
      ['door', 'Door', 'Back to Shed', 240, 216, 16, 16, undefined],
      ['door_hallway', 'Door', 'To Hallway', 424, 190, 16, 16, undefined],
    ]);
    // The bottom wall is the shed's row, so the shed door's square stays at x 240.
    expect(door(LOUNGE_ROOM).y - door(LOUNGE_ROOM).h / 2).toBe(SHED_RING.y1);
    // The right wall's band: prototype top-left (832, 364), halved.
    expect(door(LOUNGE_ROOM, 'door_hallway').x - 8).toBe(LOUNGE_ROOM.walls[3]?.x);
    expect(door(LOUNGE_ROOM, 'door_hallway').target).toEqual({ room: 'hallway', x: 114, y: 190 });
  });

  it("links the shed's top door and the lounge door both ways", () => {
    const toLounge = door(SHED_ROOM, 'door_lounge');
    expect([toLounge.label, toLounge.prompt, toLounge.x, toLounge.y, toLounge.w]).toEqual([
      'Door',
      'To Lounge',
      240,
      56,
      16,
    ]);
    // The top wall's band: prototype top-left (464, 96), halved.
    expect(toLounge.y - toLounge.h / 2).toBe(SHED_RING.y0);
    expect(toLounge.target).toEqual({ room: 'lounge', x: 240, y: 190 });
    expect(door(LOUNGE_ROOM).target).toEqual({ room: 'shed', x: 240, y: 82 });
    expect(ROOMS[toLounge.target?.room ?? 'shed']).toBe(LOUNGE_ROOM);
  });

  it('lets the player walk up from the start to the lounge door, past the planting table', () => {
    let p = createPlayer(SHED_ROOM);
    for (let i = 0; i < 52; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, SHED_ROOM);
    expect(p.y).toBe(70);
    expect(nearestInteractable(p, SHED_ROOM.props)?.key).toBe('door_lounge');
  });

  it('keeps each pedestal in reach of a player walked into its corner from either landing, however long the keys are held', () => {
    for (const [start, dx, key, x] of [
      [LOUNGE_ROOM.playerStart, -1, 'pedestal_1', 65],
      [LOUNGE_ROOM.playerStart, 1, 'pedestal_2', 415],
      [{ x: 398, y: 190 }, -1, 'pedestal_1', 64.25],
      [{ x: 398, y: 190 }, 1, 'pedestal_2', 415.5],
    ] as const) {
      let p: PlayerState = { ...createPlayer(LOUNGE_ROOM), ...start };
      for (let i = 0; i < 400; i += 1) p = stepPlayer(p, { x: dx, y: 0 }, LOUNGE_ROOM);
      for (let i = 0; i < 200; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, LOUNGE_ROOM);
      expect([p.x, p.y]).toEqual([x, 112.5]);
      expect(nearestInteractable(p, LOUNGE_ROOM.props)?.key).toBe(key);
    }
  });
});

describe('hallway room', () => {
  it("is a corridor on the shed's canvas: the shed's width, 64 tall round the row y 190, walled solid all round", () => {
    expect([HALLWAY_ROOM.key, HALLWAY_ROOM.width, HALLWAY_ROOM.height]).toEqual([
      'hallway',
      480,
      270,
    ]);
    expect(HALLWAY_ROOM.bounds).toEqual({ x: 80, y: 160, w: 320, h: 64 });
    expect(HALLWAY_ROOM.edgeMargin).toBe(SHED_ROOM.edgeMargin);
    expect(HALLWAY_ROOM.walls).toEqual([
      { x: 80, y: 160, w: 320, h: 16 },
      { x: 80, y: 208, w: 320, h: 16 },
      { x: 80, y: 160, w: 16, h: 64 },
      { x: 384, y: 160, w: 16, h: 64 },
    ]);
    expect(insideWalls(HALLWAY_ROOM)).toEqual({ x: 96, y: 176, w: 288, h: 32 });
    expect(HALLWAY_ROOM.playerStart).toEqual({ x: 114, y: 190 });
    expect(hitsWall(HALLWAY_ROOM, 114, 190)).toBe(false);
    expect(HALLWAY_ROOM.floor).toBe(0x261c16);
  });

  it('is a corridor: no pedestals, a door in each side wall on the row y 190', () => {
    expect(
      HALLWAY_ROOM.props.map((p) => [p.key, p.label, p.prompt, p.x, p.y, p.w, p.h, p.target]),
    ).toEqual([
      ['door_lounge', 'Door', 'To Lounge', 88, 190, 16, 16, { room: 'lounge', x: 398, y: 190 }],
      ['door_study', 'Door', 'To Study', 392, 190, 16, 16, { room: 'study', x: 162, y: 190 }],
    ]);
    expect(door(HALLWAY_ROOM, 'door_lounge').x - 8).toBe(SHED_RING.x0);
    expect(door(HALLWAY_ROOM, 'door_study').x - 8).toBe(SHED_RING.x1);
  });

  it('stops a walk up or down the corridor at its walls', () => {
    let p = createPlayer(HALLWAY_ROOM);
    for (let i = 0; i < 100; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, HALLWAY_ROOM);
    expect([p.x, p.y]).toEqual([114, 176.25]);
    for (let i = 0; i < 100; i += 1) p = stepPlayer(p, { x: 0, y: 1 }, HALLWAY_ROOM);
    expect([p.x, p.y]).toEqual([114, 207.5]);
  });
});

describe('study room', () => {
  it("is drawn on the shed's canvas in a ring of its own, smaller than the shed's, walled solid all round", () => {
    expect([STUDY_ROOM.key, STUDY_ROOM.width, STUDY_ROOM.height]).toEqual(['study', 480, 270]);
    expect(STUDY_ROOM.bounds).toEqual({ x: 128, y: 96, w: 224, h: 128 });
    expect(STUDY_ROOM.edgeMargin).toBe(SHED_ROOM.edgeMargin);
    expect(STUDY_ROOM.walls).toEqual([
      { x: 128, y: 96, w: 224, h: 16 },
      { x: 128, y: 208, w: 224, h: 16 },
      { x: 128, y: 96, w: 16, h: 128 },
      { x: 336, y: 96, w: 16, h: 128 },
    ]);
    expect(insideWalls(STUDY_ROOM)).toEqual({ x: 144, y: 112, w: 192, h: 96 });
    expect(STUDY_ROOM.playerStart).toEqual({ x: 162, y: 190 });
    expect(hitsWall(STUDY_ROOM, 162, 190)).toBe(false);
    expect(STUDY_ROOM.floor).toBe(0x2a1618);
  });

  it('has two pedestals, study_desk and study_bookshelf, and a door in the left wall', () => {
    expect(
      STUDY_ROOM.props.map((p) => [p.key, p.label, p.prompt, p.x, p.y, p.w, p.h, p.pedestalKey]),
    ).toEqual([
      ['pedestal_1', 'Pedestal', 'Use Pedestal', 148, 128, 16, 16, 'study_desk'],
      ['pedestal_2', 'Pedestal', 'Use Pedestal', 332, 128, 16, 16, 'study_bookshelf'],
      ['door_hallway', 'Door', 'To Hallway', 136, 190, 16, 16, undefined],
    ]);
    expect(door(STUDY_ROOM, 'door_hallway').x - 8).toBe(STUDY_ROOM.walls[2]?.x);
    expect(door(STUDY_ROOM, 'door_hallway').target).toEqual({ room: 'hallway', x: 366, y: 190 });
  });

  it('keeps each pedestal in reach of a player walked into its corner, however long the keys are held', () => {
    // From (162, 190) on the 1.25 px step grid the walls stop the player at x 144.5 and 335.75.
    for (const [dx, key, x] of [
      [-1, 'pedestal_1', 144.5],
      [1, 'pedestal_2', 335.75],
    ] as const) {
      let p = createPlayer(STUDY_ROOM);
      for (let i = 0; i < 300; i += 1) p = stepPlayer(p, { x: dx, y: 0 }, STUDY_ROOM);
      for (let i = 0; i < 200; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, STUDY_ROOM);
      expect([p.x, p.y]).toEqual([x, 112.5]);
      expect(nearestInteractable(p, STUDY_ROOM.props)?.key).toBe(key);
    }
  });
});

describe('interior rooms', () => {
  const touches = (a: Rect, b: Rect): boolean =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const onFloor = (room: Room, at: { x: number; y: number }, margin: number): boolean => {
    const f = insideWalls(room);
    return (
      at.x >= f.x + margin &&
      at.x <= f.x + f.w - margin &&
      at.y >= f.y + margin &&
      at.y <= f.y + f.h - margin
    );
  };
  const rectOf = (p: Prop): Rect => ({ x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h });

  for (const room of [LOUNGE_ROOM, HALLWAY_ROOM, STUDY_ROOM]) {
    it(`${room.key}: doors in its wall bands, each landing and the start on a floor, pedestals on its floor`, () => {
      expect(room.walls).toEqual(ringWalls(room.bounds));
      expect(onFloor(room, room.playerStart, room.edgeMargin)).toBe(true);
      for (const p of room.props) {
        if (p.target) {
          expect(
            room.walls.some((w) => touches(rectOf(p), w)),
            p.key,
          ).toBe(true);
          const to = ROOMS[p.target.room];
          expect(onFloor(to, p.target, to.edgeMargin), `${room.key}.${p.key}`).toBe(true);
        }
        if (p.pedestalKey !== undefined) expect(onFloor(room, p, 0), p.key).toBe(true);
      }
    });
  }
});

describe('rooms', () => {
  it('has every room under its key, and every door leads to one of them', () => {
    expect(ROOMS).toEqual({
      shed: SHED_ROOM,
      garden: GARDEN_ROOM,
      lounge: LOUNGE_ROOM,
      hallway: HALLWAY_ROOM,
      study: STUDY_ROOM,
    });
    for (const [key, room] of Object.entries(ROOMS)) {
      expect(room.key).toBe(key);
      for (const p of room.props) {
        if (p.target) expect(Object.keys(ROOMS)).toContain(p.target.room);
      }
    }
  });

  it('lands every door 26 px from the door leading back, clear of the walls and out of reach of every prop', () => {
    const doors = Object.values(ROOMS).flatMap((from) =>
      from.props.flatMap((d) => (d.target ? [{ from, d, target: d.target }] : [])),
    );
    expect(doors).toHaveLength(8);
    for (const { from, d, target } of doors) {
      const to = ROOMS[target.room];
      const back = to.props.filter((p) => p.target?.room === from.key);
      expect(back, `${from.key}.${d.key}`).toHaveLength(1);
      expect(hitsWall(to, target.x, target.y)).toBe(false);
      const gap = back[0] && Math.hypot(back[0].x - target.x, back[0].y - target.y);
      // The garden keeps the prototype's landing, (100, 450) halved, further out by its doorway.
      if (to === GARDEN_ROOM) expect(gap).toBeGreaterThan(INTERACT_RANGE);
      else expect(gap, `${from.key}.${d.key}`).toBe(26);
      expect(nearestInteractable(target, to.props), `${from.key}.${d.key}`).toBeUndefined();
    }
  });

  it('walks from each landing on the row y 190 into the wall with the door leading back in reach', () => {
    // Each landing is 26 px from the door; on the 1.25 px step grid the wall stops the player 8.5 px short of its centre.
    for (const [room, key, dx, x] of [
      [LOUNGE_ROOM, 'door_hallway', 1, 415.5],
      [HALLWAY_ROOM, 'door_lounge', -1, 96.5],
      [HALLWAY_ROOM, 'door_study', 1, 383.5],
      [STUDY_ROOM, 'door_hallway', -1, 144.5],
    ] as const) {
      const d = door(room, key);
      const start = { x: d.x - 26 * dx, y: 190 };
      let p: PlayerState = { ...createPlayer(room), ...start };
      for (let i = 0; i < 200; i += 1) p = stepPlayer(p, { x: dx, y: 0 }, room);
      expect([p.x, p.y], `${room.key}.${key}`).toEqual([x, 190]);
      expect(Math.abs(d.x - p.x)).toBe(8.5);
      expect(nearestInteractable(p, room.props)?.key).toBe(key);
    }
  });
});

describe('player movement', () => {
  const still: MoveInput = { x: 0, y: 0 };
  const start = (): PlayerState => createPlayer(SHED_ROOM);

  it('starts at the room start, facing down, standing still', () => {
    expect(start()).toEqual({ x: 240, y: 135, facing: 'down', walkAnim: 0 });
  });

  it('moves 2.5 prototype px (1.25 logical px) per step', () => {
    expect(MOVE_SPEED).toBe(1.25);
    expect(stepPlayer(start(), { x: 1, y: 0 }, SHED_ROOM)).toMatchObject({ x: 241.25, y: 135 });
    expect(stepPlayer(start(), { x: 0, y: -1 }, SHED_ROOM)).toMatchObject({ x: 240, y: 133.75 });
  });

  it('normalises diagonals to the same speed', () => {
    const p = stepPlayer(start(), { x: 1, y: 1 }, SHED_ROOM);
    expect(Math.hypot(p.x - 240, p.y - 135)).toBeCloseTo(1.25);
    expect(p.x - 240).toBeCloseTo(1.25 / Math.SQRT2);
  });

  it('clamps out-of-range input', () => {
    expect(stepPlayer(start(), { x: 3, y: 0 }, SHED_ROOM).x).toBe(241.25);
  });

  it('clamps the player 4 px inside the wall ring, where no wall stops it first', () => {
    const open: Room = { ...SHED_ROOM, walls: [] };
    let q = start();
    for (let i = 0; i < 400; i += 1) q = stepPlayer(q, { x: -1, y: -1 }, open);
    expect(q).toMatchObject({ x: 84, y: 52 });
    for (let i = 0; i < 600; i += 1) q = stepPlayer(q, { x: 1, y: 1 }, open);
    expect(q).toMatchObject({ x: 396, y: 220 });
  });

  it('keeps the player on the shed floor, stopped by the wall bands before the clamp', () => {
    expect(SHED_ROOM.edgeMargin).toBeLessThan(WALL_BAND);
    // Straight left from the start: the last 1.25 px step before the band (e2e/world.spec.ts).
    let w = start();
    for (let i = 0; i < 200; i += 1) w = stepPlayer(w, { x: -1, y: 0 }, SHED_ROOM);
    expect(w).toMatchObject({ x: 96.25, y: 135 });
    const inside = insideWalls(SHED_ROOM);
    let p = start();
    for (let i = 0; i < 400; i += 1) p = stepPlayer(p, { x: -1, y: -1 }, SHED_ROOM);
    expect(p.x).toBeGreaterThanOrEqual(inside.x);
    expect(p.x).toBeLessThan(inside.x + MOVE_SPEED);
    expect(p.y).toBeGreaterThanOrEqual(inside.y);
    expect(p.y).toBeLessThan(inside.y + MOVE_SPEED);
    for (let i = 0; i < 600; i += 1) p = stepPlayer(p, { x: 1, y: 1 }, SHED_ROOM);
    expect(p.x).toBeLessThan(inside.x + inside.w);
    expect(p.x).toBeGreaterThan(inside.x + inside.w - MOVE_SPEED);
    expect(p.y).toBeLessThan(inside.y + inside.h);
    expect(p.y).toBeGreaterThan(inside.y + inside.h - MOVE_SPEED);
  });

  it('stops at a wall per axis and slides along it', () => {
    const room: Room = { ...SHED_ROOM, walls: [{ x: 242, y: 0, w: 10, h: 270 }] };
    const p = stepPlayer({ ...start(), x: 241.5 }, { x: 1, y: 1 }, room);
    expect(p.x).toBe(241.5);
    expect(p.y).toBeCloseTo(135 + 1.25 / Math.SQRT2);
  });

  it('faces the input direction with 0.5 thresholds, horizontal first', () => {
    const face = (input: MoveInput): string => stepPlayer(start(), input, SHED_ROOM).facing;
    expect(face({ x: 1, y: 0 })).toBe('right');
    expect(face({ x: -1, y: 0 })).toBe('left');
    expect(face({ x: 0, y: 1 })).toBe('down');
    expect(face({ x: 0, y: -1 })).toBe('up');
    // Diagonals normalise to 0.707 on each axis, so horizontal wins.
    expect(face({ x: -1, y: -1 })).toBe('left');
    // Below the threshold the facing is kept.
    expect(stepPlayer({ ...start(), facing: 'up' }, { x: 0.4, y: 0 }, SHED_ROOM).facing).toBe('up');
    expect(stepPlayer({ ...start(), facing: 'left' }, still, SHED_ROOM).facing).toBe('left');
  });

  it('advances the walk cycle 0.14 per moving step, wraps at 4, resets when still', () => {
    expect(WALK_ANIM_STEP).toBe(0.14);
    let p = start();
    p = stepPlayer(p, { x: 1, y: 0 }, SHED_ROOM);
    expect(p.walkAnim).toBeCloseTo(0.14);
    p = stepPlayer({ ...p, walkAnim: 3.9 }, { x: 1, y: 0 }, SHED_ROOM);
    expect(p.walkAnim).toBeCloseTo(0.04);
    expect(stepPlayer(p, still, SHED_ROOM).walkAnim).toBe(0);
  });
});

describe('input', () => {
  it('reads keys as right minus left and down minus up', () => {
    const none = { left: false, right: false, up: false, down: false };
    expect(keyboardInput({ ...none, right: true })).toEqual({ x: 1, y: 0 });
    expect(keyboardInput({ ...none, left: true, up: true })).toEqual({ x: -1, y: -1 });
    expect(keyboardInput({ ...none, left: true, right: true })).toEqual({ x: 0, y: 0 });
  });

  it('reads the joystick with a dead zone, saturating at its radius', () => {
    expect(JOYSTICK_DEAD_ZONE).toBe(4);
    expect(JOYSTICK_RADIUS).toBe(24);
    expect(joystickInput(3, 0)).toEqual({ x: 0, y: 0 });
    expect(joystickInput(12, 0)).toEqual({ x: 0.5, y: 0 });
    expect(joystickInput(0, -48)).toEqual({ x: 0, y: -1 });
  });

  it('runs fixed 60 Hz steps whatever the frame time', () => {
    expect(STEP_MS).toBeCloseTo(16.667, 3);
    // 120 Hz display: a step every other frame.
    const a = fixedSteps(0, 1000 / 120);
    expect(a.steps).toBe(0);
    expect(fixedSteps(a.accumulatorMs, 1000 / 120).steps).toBe(1);
    // 30 Hz display: two steps a frame.
    expect(fixedSteps(0, 1000 / 30 + 0.001).steps).toBe(2);
    // One second at any frame rate is 60 steps.
    let acc = 0;
    let steps = 0;
    for (let i = 0; i < 144; i += 1) {
      const r = fixedSteps(acc, 1000 / 144);
      acc = r.accumulatorMs;
      steps += r.steps;
    }
    expect(steps).toBeGreaterThanOrEqual(59);
    expect(steps).toBeLessThanOrEqual(60);
  });

  it('caps the steps after a stall and drops the backlog', () => {
    expect(fixedSteps(0, 2000)).toEqual({ steps: MAX_STEPS_PER_FRAME, accumulatorMs: 0 });
  });
});

describe('HUD badge', () => {
  it('reads Spring 1/28, Day 0, $100 for a new game', () => {
    expect(hudText(createNewGameState())).toBe('Spring 1/28  |  Day 0  |  $100');
  });

  it('shows the raw day with the day of season', () => {
    expect(hudText({ day: 29, money: 250 })).toBe('Summer 1/28  |  Day 29  |  $250');
    expect(hudText({ day: 112, money: 0 })).toBe('Winter 28/28  |  Day 112  |  $0');
  });
});
