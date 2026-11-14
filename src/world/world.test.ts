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
import { SHEETS } from './assets';
import { landing, wallDoor, type Landing } from './doors';
import { EXTERIORS, GARDEN_ROOM, GREENHOUSE, HOUSE, ROOMS, SHED } from './gardenRoom';
import { GREENHOUSE_ROOM } from './greenhouseRoom';
import { INTERACT_RANGE, nearestInteractable } from './interactables';
import { HALLWAY_ROOM } from './hallwayRoom';
import { LOUNGE_ROOM } from './loungeRoom';
import { STUDY_ROOM } from './studyRoom';
import { propSprite } from './roomArt';
import { FLOOR_GRID, floorRows, floorSpot } from './treeSprites';
import {
  SHED_RING,
  SHED_ROOM,
  WALL_BAND,
  fromPrototype,
  furnitureWalls,
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

/** Where `d` sets the player down: beside the far door, derived (doors.ts). */
const arrival = (d: Prop): Landing => {
  if (!d.target) throw new Error(`${d.key} is not a door`);
  const to = ROOMS[d.target.room];
  return landing(to, wallDoor(to, d.target.door));
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

  it('takes the shed door to beside the garden door in the garden and the garden door to above the shed door', () => {
    expect(door(SHED_ROOM).target).toEqual({ room: 'garden', door: 'door' });
    expect(arrival(door(SHED_ROOM))).toEqual({ x: 80, y: 274, facing: 'down' });
    expect(door(GARDEN_ROOM).target).toEqual({ room: 'shed', door: 'door' });
    const { x, y } = arrival(door(GARDEN_ROOM));
    expect([x, y]).toEqual([240, 190]);
    const inside = insideWalls(SHED_ROOM);
    expect(x > inside.x && x < inside.x + inside.w && y > inside.y && y < inside.y + inside.h).toBe(
      true,
    );
    expect(hitsWall(SHED_ROOM, x, y)).toBe(false);
    // 26 px above the door's centre: just out of its 20 px reach.
    expect(door(SHED_ROOM).y - y).toBeGreaterThan(INTERACT_RANGE);
  });

  it("stands Draw_0's five decor sprites on their bottom-centre origins, halved, none of them solid", () => {
    expect(SHED_ROOM.furniture.map(({ sheet, x, y, w, h }) => [sheet.key, x, y, w, h])).toEqual([
      // spr_shelf 56x44 at (440, 174), spr_tools 36x52 at (212, 352), spr_watering_can
      // 32x30 at (706, 256), spr_pot_stack 40x40 at (706, 388), spr_sack 32x34 at (300, 384).
      ['spr_shelf', 206, 65, 28, 22],
      ['spr_tools', 97, 150, 18, 26],
      ['spr_watering_can', 345, 113, 16, 15],
      ['spr_pot_stack', 343, 174, 20, 20],
      ['spr_sack', 142, 175, 16, 17],
    ]);
    expect(SHED_ROOM.furniture.every((f) => !f.solid && f.shadow === true)).toBe(true);
    // The floor clutter sorts against the player; the wall-mounted shelf and every other room's furniture are baked.
    expect(SHED_ROOM.furniture.map((f) => f.sorted)).toEqual([false, true, true, true, true]);
    for (const room of Object.values(ROOMS).filter((r) => r !== SHED_ROOM)) {
      expect(room.furniture.some((f) => f.sorted)).toBe(false);
    }
    // Draw-only, so the walls are still just the ring.
    expect(furnitureWalls(SHED_ROOM.furniture)).toEqual([]);
    expect(SHED_ROOM.walls).toEqual(ringWalls(SHED_ROOM.bounds));
  });

  it("sets Draw_73's window, 56 px centred on prototype x 560, as two house panes centred on 280", () => {
    expect(SHED_ROOM.windows).toEqual([{ x: 264, w: 32 }]);
    const [w] = SHED_ROOM.windows;
    expect(w && w.x + w.w / 2).toBe(fromPrototype(560));
  });

  it('keeps the decor clear of the props, the floor-tree spots and the player start', () => {
    const overlaps = (a: Rect, b: Rect): boolean =>
      a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const around = (x: number, y: number, r: number): Rect => ({
      x: x - r,
      y: y - r,
      w: 2 * r,
      h: 2 * r,
    });
    const spots = floorRows(SHED_ROOM).length * FLOOR_GRID.perRow;
    expect(spots).toBe(10);
    for (const f of SHED_ROOM.furniture) {
      for (const p of SHED_ROOM.props) {
        const art = propSprite(p);
        const drawn = art && {
          x: art.x - (art.sheet.frameWidth * art.scale) / 2,
          y: art.y - (art.sheet.frameHeight * art.scale) / 2,
          w: art.sheet.frameWidth * art.scale,
          h: art.sheet.frameHeight * art.scale,
        };
        expect(drawn && overlaps(f, drawn), `${f.sheet.key} ${p.key}`).toBe(false);
      }
      for (let i = 0; i < spots; i += 1) {
        const { x, y } = floorSpot(i, SHED_ROOM);
        expect(overlaps(f, around(x, y, 8)), `${f.sheet.key} spot ${String(i)}`).toBe(false);
      }
      const { x, y } = SHED_ROOM.playerStart;
      expect(overlaps(f, around(x, y, 12)), f.sheet.key).toBe(false);
    }
  });
});

describe('garden room', () => {
  /** True if (x, y) is on the garden's walkable ground: inside the fence ring and in no solid. */
  const walkable = (x: number, y: number): boolean => {
    const f = insideWalls(GARDEN_ROOM);
    return x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h && !hitsWall(GARDEN_ROOM, x, y);
  };
  const walk = (from: { x: number; y: number }, input: MoveInput, steps: number): PlayerState => {
    let p: PlayerState = { ...createPlayer(GARDEN_ROOM), ...from };
    for (let i = 0; i < steps; i += 1) p = stepPlayer(p, input, GARDEN_ROOM);
    return p;
  };

  it("is plan B2's back garden, 14.5 x 16 m at 32 px a metre, with its green floor", () => {
    expect([GARDEN_ROOM.key, GARDEN_ROOM.width, GARDEN_ROOM.height]).toEqual(['garden', 464, 512]);
    expect(GARDEN_ROOM.bounds).toEqual({ x: 0, y: 0, w: 464, h: 512 });
    expect(GARDEN_ROOM.floor).toBe(0x30502c);
    expect(GARDEN_ROOM.windows).toEqual([]);
    expect(GARDEN_ROOM.playerStart).toEqual({ x: 80, y: 274 });
    expect(GARDEN_ROOM.playerStart).toEqual({
      x: arrival(door(SHED_ROOM)).x,
      y: arrival(door(SHED_ROOM)).y,
    });
    expect(
      GARDEN_ROOM.props.map((p) => [p.key, p.label, p.prompt, p.x, p.y, p.w, p.h, p.speciesKey]),
    ).toEqual([
      ['source_juniper', 'Juniper', 'Take Cutting', 80, 472, 24, 24, 'juniper'],
      ['source_maple', 'Japanese Maple', 'Take Cutting', 112, 472, 24, 24, 'maple'],
      ['source_pine', 'Pine', 'Take Cutting', 144, 472, 24, 24, 'pine'],
      ['door', 'Door', 'Back to Shed', 80, 248, 16, 16, undefined],
      ['door_study', 'Door', 'To Study', 344, 136, 16, 16, undefined],
      ['door_greenhouse', 'Door', 'To Greenhouse', 336, 408, 16, 16, undefined],
      ['gate', 'Gate', 'Gate', 440, 8, 16, 16, undefined],
    ]);
  });

  it('walls the fence ring and the house, shed and greenhouse footprints, leaving passage, notch and lawn', () => {
    expect([HOUSE, SHED, GREENHOUSE]).toEqual([
      { x: 0, y: 0, w: 416, h: 144 },
      { x: 0, y: 144, w: 160, h: 112 },
      { x: 256, y: 304, w: 160, h: 112 },
    ]);
    expect(GARDEN_ROOM.walls).toEqual([
      { x: 0, y: 0, w: 464, h: 16 },
      { x: 0, y: 496, w: 464, h: 16 },
      { x: 0, y: 0, w: 16, h: 512 },
      { x: 448, y: 0, w: 16, h: 512 },
      HOUSE,
      SHED,
      GREENHOUSE,
    ]);
    expect(GARDEN_ROOM.walls).toEqual([
      ...ringWalls(GARDEN_ROOM.bounds),
      HOUSE,
      SHED,
      ...furnitureWalls(GARDEN_ROOM.furniture),
    ]);
    // The passage, x 416..464 (448 inside the east fence), from the north fence down to the notch.
    expect([
      walkable(416, 16),
      walkable(447.9, 143.9),
      walkable(415.9, 100),
      walkable(448, 100),
    ]).toEqual([true, true, false, false]);
    expect([walkable(430, 15.9), walkable(400, 143.9)]).toEqual([false, false]);
    // The notch, x 160..448, y 144..256, beside the shed and under the house's back face.
    expect([walkable(160, 144), walkable(159.9, 200), walkable(300, 143.9)]).toEqual([
      true,
      false,
      false,
    ]);
    // The lawn, y 256..496 inside the west and east fences, round the greenhouse.
    expect([
      walkable(16, 256),
      walkable(15.9, 300),
      walkable(100, 255.9),
      walkable(240, 495.9),
      walkable(240, 496),
    ]).toEqual([true, false, false, true, false]);
    expect([
      walkable(255.9, 350),
      walkable(256, 304),
      walkable(415.9, 415.9),
      walkable(300, 416),
      walkable(416, 350),
    ]).toEqual([true, false, false, true, true]);
  });

  it('sets every door in the face of the solid holding it and lands each 26 px out of it, on the ground', () => {
    for (const [key, face, target] of [
      ['door', SHED, { room: 'shed', door: 'door' }],
      ['door_study', HOUSE, { room: 'study', door: 'door_garden' }],
      ['door_greenhouse', GREENHOUSE, { room: 'greenhouse', door: 'door_garden' }],
    ] as const) {
      const d = door(GARDEN_ROOM, key);
      expect(d.wall, key).toBe('N');
      expect(d.target, key).toEqual(target);
      // The door's 16 px square fills the face's bottom band.
      expect([d.y - d.h / 2, d.y + d.h / 2], key).toEqual([face.y + face.h - 16, face.y + face.h]);
      expect(d.x - d.w / 2 >= face.x && d.x + d.w / 2 <= face.x + face.w, key).toBe(true);
      // Its landing, from the room it leads to: straight below it, on the ground, out of every prop's reach.
      const at = landing(GARDEN_ROOM, wallDoor(GARDEN_ROOM, key));
      expect(at, key).toEqual({ x: d.x, y: d.y + 26, facing: 'down' });
      expect(walkable(at.x, at.y), key).toBe(true);
      expect(nearestInteractable(at, GARDEN_ROOM.props), key).toBeUndefined();
    }
    // The far doors lead back to these.
    expect(door(SHED_ROOM).target).toEqual({ room: 'garden', door: 'door' });
    expect(door(STUDY_ROOM, 'door_garden').target).toEqual({ room: 'garden', door: 'door_study' });
    expect(door(GREENHOUSE_ROOM, 'door_garden').target).toEqual({
      room: 'garden',
      door: 'door_greenhouse',
    });
  });

  it('keeps each door in reach of a walk straight up from its landing, stopped by its face however long the key is held', () => {
    for (const [key, from] of [
      ['door', { x: 80, y: 274 }],
      ['door_study', { x: 344, y: 162 }],
      ['door_greenhouse', { x: 336, y: 434 }],
    ] as const) {
      const p = walk(from, { x: 0, y: -1 }, 300);
      const d = door(GARDEN_ROOM, key);
      expect([p.x, p.y], key).toEqual([from.x, d.y + 8.5]);
      expect(nearestInteractable(p, GARDEN_ROOM.props)?.key, key).toBe(key);
    }
  });

  it('closes the passage with the side gate in its north fence: a door with no target, reached up the passage', () => {
    const gate = door(GARDEN_ROOM, 'gate');
    expect([gate.wall, gate.target, gate.sheet]).toEqual(['N', undefined, undefined]);
    // In the north fence's band across the passage's top, x 432..448.
    expect([
      gate.x - gate.w / 2,
      gate.x + gate.w / 2,
      gate.y - gate.h / 2,
      gate.y + gate.h / 2,
    ]).toEqual([432, 448, 0, 16]);
    // From the lawn, up the east side of the notch and the passage into the fence: 8.5 px below the gate.
    const p = walk({ x: 440, y: 274 }, { x: 0, y: -1 }, 300);
    expect([p.x, p.y]).toEqual([440, 16.5]);
    expect(nearestInteractable(p, GARDEN_ROOM.props)?.key).toBe('gate');
    // Left of the passage the house's east face stops the same walk at the notch's top.
    expect(walk({ x: 400, y: 274 }, { x: 0, y: -1 }, 300).y).toBe(144);
  });

  it('stands the source plants in the bed along the south fence, each in reach from just above it', () => {
    const plants = GARDEN_ROOM.props.filter((p) => p.speciesKey !== undefined);
    expect(plants.map((p) => p.key)).toEqual(['source_juniper', 'source_maple', 'source_pine']);
    for (const s of plants) {
      // Below the shed, clear of the south fence's band, 32 px (1 m) apart.
      expect(s.y + s.h / 2).toBeLessThanOrEqual(496);
      expect(s.x + s.w / 2).toBeLessThanOrEqual(SHED.w);
      expect(nearestInteractable({ x: s.x, y: s.y - 9 }, GARDEN_ROOM.props)?.key).toBe(s.key);
      expect(nearestInteractable({ x: s.x, y: s.y + 9 }, GARDEN_ROOM.props)?.key).toBe(s.key);
    }
    // Straight down from the shed door's landing, the juniper comes in reach before the fence stops the walk.
    const p = walk({ x: 80, y: 274 }, { x: 0, y: 1 }, 152);
    expect(walkable(p.x, p.y)).toBe(true);
    expect(nearestInteractable(p, GARDEN_ROOM.props)?.key).toBe('source_juniper');
  });

  it('links the shed door and the garden door both ways', () => {
    const shedDoor = SHED_ROOM.props.find((p) => p.key === 'door');
    const gardenDoor = GARDEN_ROOM.props.find((p) => p.key === 'door');
    expect(shedDoor?.prompt).toBe('To Garden');
    expect(shedDoor?.target).toEqual({ room: 'garden', door: 'door' });
    expect(gardenDoor?.target).toEqual({ room: 'shed', door: 'door' });
    expect(ROOMS[shedDoor?.target?.room ?? 'shed']).toBe(GARDEN_ROOM);
    expect(ROOMS.shed).toBe(SHED_ROOM);
  });

  it('draws the buildings over their footprints: roofs, one band of face where the garden sees them, a glass box', () => {
    expect(GARDEN_ROOM.furniture).toBe(EXTERIORS);
    expect(EXTERIORS.map(({ sheet, x, y, w, h, solid }) => [sheet, x, y, w, h, solid])).toEqual([
      [SHEETS.roof, 0, 0, 400, 144, false],
      [SHEETS.wallHallway, 160, 128, 240, 16, false],
      [SHEETS.wallHallway, 400, 0, 16, 144, false],
      [SHEETS.roof, 0, 144, 160, 96, false],
      [SHEETS.wall, 0, 240, 160, 16, false],
      [SHEETS.wallGlass, 256, 304, 160, 112, true],
    ]);
    // Only the glass box is solid furniture; the house and the shed are wall rects.
    expect(furnitureWalls(EXTERIORS)).toEqual([GREENHOUSE]);
    // Every piece lies on the 16 px tile grid inside its building's footprint.
    for (const f of EXTERIORS) {
      expect([f.x, f.y, f.w, f.h].every((v) => v % 16 === 0)).toBe(true);
      const within = (r: Rect): boolean =>
        f.x >= r.x && f.y >= r.y && f.x + f.w <= r.x + r.w && f.y + f.h <= r.y + r.h;
      expect([HOUSE, SHED, GREENHOUSE].some(within), f.sheet.key).toBe(true);
    }
    // Each door is drawn on its face's band, the glazed ones in their own sheet.
    expect(propSprite(door(GARDEN_ROOM))?.sheet).toBe(SHEETS.door);
    expect(propSprite(door(GARDEN_ROOM, 'door_study'))?.sheet).toBe(SHEETS.doorGlassSingle);
    expect(propSprite(door(GARDEN_ROOM, 'door_greenhouse'))?.sheet).toBe(SHEETS.doorGlassSingle);
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
      // The fireplace and the side table.
      { x: 224, y: 112, w: 32, h: 24 },
      { x: 400, y: 112, w: 16, h: 16 },
    ]);
    expect(insideWalls(LOUNGE_ROOM)).toEqual({ x: 64, y: 112, w: 352, h: 96 });
    expect(LOUNGE_ROOM.playerStart).toEqual({ x: 240, y: 190 });
    expect(hitsWall(LOUNGE_ROOM, 240, 190)).toBe(false);
  });

  it('has two display spots, lounge_mantel and lounge_side_table, on its furniture, and a door in the bottom wall', () => {
    expect(
      LOUNGE_ROOM.props.map((p) => [p.key, p.label, p.prompt, p.x, p.y, p.w, p.h, p.pedestalKey]),
    ).toEqual([
      ['pedestal_1', 'Pedestal', 'Use Pedestal', 240, 125, 32, 22, 'lounge_mantel'],
      ['pedestal_2', 'Pedestal', 'Use Pedestal', 408, 122, 16, 12, 'lounge_side_table'],
      ['door', 'Door', 'Back to Shed', 240, 216, 16, 16, undefined],
      ['door_hallway', 'Door', 'To Hallway', 424, 190, 16, 16, undefined],
    ]);
    // The bottom wall is the shed's row, so the shed door's square stays at x 240.
    expect(door(LOUNGE_ROOM).y - door(LOUNGE_ROOM).h / 2).toBe(SHED_RING.y1);
    // The right wall's band: prototype top-left (832, 364), halved.
    expect(door(LOUNGE_ROOM, 'door_hallway').x - 8).toBe(LOUNGE_ROOM.walls[3]?.x);
    expect(door(LOUNGE_ROOM, 'door_hallway').target).toEqual({
      room: 'hallway',
      door: 'door_lounge',
    });
    expect(arrival(door(LOUNGE_ROOM, 'door_hallway'))).toEqual({ x: 114, y: 190, facing: 'right' });
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
    expect(toLounge.target).toEqual({ room: 'lounge', door: 'door' });
    expect(arrival(toLounge)).toEqual({ x: 240, y: 190, facing: 'up' });
    expect(door(LOUNGE_ROOM).target).toEqual({ room: 'shed', door: 'door_lounge' });
    expect(arrival(door(LOUNGE_ROOM))).toEqual({ x: 240, y: 82, facing: 'down' });
    expect(ROOMS[toLounge.target?.room ?? 'shed']).toBe(LOUNGE_ROOM);
  });

  it('lets the player walk up from the start to the lounge door, past the planting table', () => {
    let p = createPlayer(SHED_ROOM);
    for (let i = 0; i < 52; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, SHED_ROOM);
    expect(p.y).toBe(70);
    expect(nearestInteractable(p, SHED_ROOM.props)?.key).toBe('door_lounge');
  });

  it('keeps the mantel in reach of a walk straight up from the landing, stopped by the fireplace however long the key is held', () => {
    let p = createPlayer(LOUNGE_ROOM);
    for (let i = 0; i < 200; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, LOUNGE_ROOM);
    expect([p.x, p.y]).toEqual([240, 136.25]);
    expect(nearestInteractable(p, LOUNGE_ROOM.props)?.key).toBe('pedestal_1');
  });

  it('keeps the side table in reach of a walk into the right wall and up from either landing, stopped by the table', () => {
    for (const [start, x] of [
      [LOUNGE_ROOM.playerStart, 415],
      [{ x: 398, y: 190 }, 415.5],
    ] as const) {
      let p: PlayerState = { ...createPlayer(LOUNGE_ROOM), ...start };
      for (let i = 0; i < 400; i += 1) p = stepPlayer(p, { x: 1, y: 0 }, LOUNGE_ROOM);
      for (let i = 0; i < 200; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, LOUNGE_ROOM);
      expect([p.x, p.y]).toEqual([x, 128.75]);
      expect(nearestInteractable(p, LOUNGE_ROOM.props)?.key).toBe('pedestal_2');
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

  it('is a corridor: no display spots, a door in each side wall on the row y 190', () => {
    expect(
      HALLWAY_ROOM.props.map((p) => [p.key, p.label, p.prompt, p.x, p.y, p.w, p.h, p.target]),
    ).toEqual([
      [
        'door_lounge',
        'Door',
        'To Lounge',
        88,
        190,
        16,
        16,
        { room: 'lounge', door: 'door_hallway' },
      ],
      ['door_study', 'Door', 'To Study', 392, 190, 16, 16, { room: 'study', door: 'door_hallway' }],
    ]);
    expect(arrival(door(HALLWAY_ROOM, 'door_lounge'))).toEqual({ x: 398, y: 190, facing: 'left' });
    expect(arrival(door(HALLWAY_ROOM, 'door_study'))).toEqual({ x: 162, y: 190, facing: 'right' });
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
      // The desk and the bookcase.
      { x: 144, y: 112, w: 32, h: 16 },
      { x: 288, y: 112, w: 48, h: 16 },
    ]);
    expect(insideWalls(STUDY_ROOM)).toEqual({ x: 144, y: 112, w: 192, h: 96 });
    expect(STUDY_ROOM.playerStart).toEqual({ x: 162, y: 190 });
    expect(hitsWall(STUDY_ROOM, 162, 190)).toBe(false);
    expect(STUDY_ROOM.floor).toBe(0x2a1618);
  });

  it('has two display spots, study_desk and study_bookshelf, on its furniture, a door in the left wall and glass doors in the bottom', () => {
    expect(
      STUDY_ROOM.props.map((p) => [p.key, p.label, p.prompt, p.x, p.y, p.w, p.h, p.pedestalKey]),
    ).toEqual([
      ['pedestal_1', 'Pedestal', 'Use Pedestal', 160, 123, 32, 10, 'study_desk'],
      ['pedestal_2', 'Pedestal', 'Use Pedestal', 328, 120.5, 16, 15, 'study_bookshelf'],
      ['door_hallway', 'Door', 'To Hallway', 136, 190, 16, 16, undefined],
      ['door_garden', 'Door', 'To Garden', 320, 216, 32, 16, undefined],
    ]);
    expect(door(STUDY_ROOM, 'door_hallway').x - 8).toBe(STUDY_ROOM.walls[2]?.x);
    expect(door(STUDY_ROOM, 'door_hallway').target).toEqual({
      room: 'hallway',
      door: 'door_study',
    });
    expect(arrival(door(STUDY_ROOM, 'door_hallway'))).toEqual({ x: 366, y: 190, facing: 'left' });
  });

  it("puts the glass doors in the bottom wall's band, x 304..336 left of the corner tile, leading to the garden and back", () => {
    const d = door(STUDY_ROOM, 'door_garden');
    expect(STUDY_ROOM.walls[1]).toEqual({ x: 128, y: 208, w: 224, h: 16 });
    expect([d.x - d.w / 2, d.x + d.w / 2, d.y - d.h / 2, d.y + d.h / 2]).toEqual([
      304, 336, 208, 224,
    ]);
    expect(d.target).toEqual({ room: 'garden', door: 'door_study' });
    expect(arrival(d)).toEqual({ x: 344, y: 162, facing: 'down' });
    expect(ROOMS[d.target?.room ?? 'study']).toBe(GARDEN_ROOM);
    // Each landing 26 px from the door leading back: below the garden's door, above the glass doors.
    const back = door(GARDEN_ROOM, 'door_study');
    expect(arrival(d)).toMatchObject({ x: back.x, y: back.y + 26 });
    expect(arrival(back)).toMatchObject({ x: d.x, y: d.y - 26 });
  });

  it('keeps the glass doors in reach of a walk into the right wall and down, however long the keys are held', () => {
    const d = door(STUDY_ROOM, 'door_garden');
    // From the hallway's landing and the garden's, along the row y 190 into the right wall, then down into the bottom wall.
    // On the 1.25 px step grid the wall stops them at x 335.75 and 335, 17.9 and 17.2 px from the doors' centre.
    for (const [start, x, gap] of [
      [STUDY_ROOM.playerStart, 335.75, 17.9],
      [{ x: 320, y: 190 }, 335, 17.2],
    ] as const) {
      let p: PlayerState = { ...createPlayer(STUDY_ROOM), ...start };
      for (let i = 0; i < 300; i += 1) p = stepPlayer(p, { x: 1, y: 0 }, STUDY_ROOM);
      expect([p.x, p.y]).toEqual([x, 190]);
      for (let i = 0; i < 200; i += 1) p = stepPlayer(p, { x: 0, y: 1 }, STUDY_ROOM);
      expect([p.x, p.y]).toEqual([x, 207.5]);
      expect(Math.hypot(d.x - p.x, d.y - p.y)).toBeCloseTo(gap, 1);
      expect(nearestInteractable(p, STUDY_ROOM.props)?.key).toBe('door_garden');
    }
    // From the garden's landing straight down: the bottom wall stops the walk 8.5 px above the doors' centre.
    let p: PlayerState = { ...createPlayer(STUDY_ROOM), x: 320, y: 190 };
    for (let i = 0; i < 200; i += 1) p = stepPlayer(p, { x: 0, y: 1 }, STUDY_ROOM);
    expect([p.x, p.y]).toEqual([320, 207.5]);
    expect(nearestInteractable(p, STUDY_ROOM.props)?.key).toBe('door_garden');
  });

  it('keeps each spot in reach of a player walked into a side wall and up against its furniture, however long the keys are held', () => {
    // From (162, 190) on the 1.25 px step grid the walls stop the player at x 144.5 and 335.75,
    // the desk and the bookcase at y 128.75.
    for (const [dx, key, x] of [
      [-1, 'pedestal_1', 144.5],
      [1, 'pedestal_2', 335.75],
    ] as const) {
      let p = createPlayer(STUDY_ROOM);
      for (let i = 0; i < 300; i += 1) p = stepPlayer(p, { x: dx, y: 0 }, STUDY_ROOM);
      for (let i = 0; i < 200; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, STUDY_ROOM);
      expect([p.x, p.y]).toEqual([x, 128.75]);
      expect(nearestInteractable(p, STUDY_ROOM.props)?.key).toBe(key);
    }
  });
});

describe('greenhouse room', () => {
  const inside = (room: Room, at: { x: number; y: number }): boolean => {
    const f = insideWalls(room);
    return at.x > f.x && at.x < f.x + f.w && at.y > f.y && at.y < f.y + f.h;
  };

  it("is an inset glass house on the shed's canvas, walled solid all round, its floor 22x10 tiles and empty", () => {
    expect([GREENHOUSE_ROOM.key, GREENHOUSE_ROOM.width, GREENHOUSE_ROOM.height]).toEqual([
      'greenhouse',
      480,
      270,
    ]);
    expect(GREENHOUSE_ROOM.bounds).toEqual({ x: 48, y: 48, w: 384, h: 192 });
    expect(GREENHOUSE_ROOM.edgeMargin).toBe(SHED_ROOM.edgeMargin);
    expect(GREENHOUSE_ROOM.walls).toEqual([
      { x: 48, y: 48, w: 384, h: 16 },
      { x: 48, y: 224, w: 384, h: 16 },
      { x: 48, y: 48, w: 16, h: 192 },
      { x: 416, y: 48, w: 16, h: 192 },
    ]);
    // 352x160 inside the ring: 22x10 tiles of 16 px.
    expect(insideWalls(GREENHOUSE_ROOM)).toEqual({ x: 64, y: 64, w: 352, h: 160 });
    expect(GREENHOUSE_ROOM.windows).toEqual([]);
    expect(GREENHOUSE_ROOM.furniture).toEqual([]);
    expect(GREENHOUSE_ROOM.playerStart).toEqual({ x: 240, y: 206 });
    expect(GREENHOUSE_ROOM.floor).toBe(0x1c2420);
  });

  it("has one door, in the bottom wall's centre, to 26 px below the garden's greenhouse door in the glass box's south face", () => {
    expect(
      GREENHOUSE_ROOM.props.map((p) => [p.key, p.label, p.prompt, p.x, p.y, p.w, p.h, p.target]),
    ).toEqual([
      [
        'door_garden',
        'Door',
        'To Garden',
        240,
        232,
        16,
        16,
        { room: 'garden', door: 'door_greenhouse' },
      ],
    ]);
    const d = door(GREENHOUSE_ROOM, 'door_garden');
    expect([d.x - d.w / 2, d.x + d.w / 2, d.y - d.h / 2, d.y + d.h / 2]).toEqual([
      232, 248, 224, 240,
    ]);
    const back = door(GARDEN_ROOM, 'door_greenhouse');
    // The bottom band of the greenhouse standing in the garden's lawn, x 256..416, y 304..416.
    const edges = [
      back.x - back.w / 2,
      back.x + back.w / 2,
      back.y - back.h / 2,
      back.y + back.h / 2,
    ];
    expect(edges).toEqual([328, 344, 400, 416]);
    expect(back.target).toEqual({ room: 'greenhouse', door: 'door_garden' });
    expect(d.target).toEqual({ room: 'garden', door: 'door_greenhouse' });
    expect(arrival(back)).toEqual({ x: d.x, y: d.y - 26, facing: 'up' });
    expect(arrival(d)).toEqual({ x: back.x, y: back.y + 26, facing: 'down' });
    expect(ROOMS[back.target?.room ?? 'garden']).toBe(GREENHOUSE_ROOM);
    expect(ROOMS[d.target?.room ?? 'greenhouse']).toBe(GARDEN_ROOM);
    // Each landing inside the other room's walls.
    for (const [room, at] of [
      [GREENHOUSE_ROOM, arrival(back)],
      [GARDEN_ROOM, arrival(d)],
    ] as const) {
      expect(inside(room, at), room.key).toBe(true);
      expect(hitsWall(room, at.x, at.y), room.key).toBe(false);
    }
  });

  it('keeps each door in reach of a walk from its landing into the wall it sits in, however long the key is held', () => {
    // Greenhouse: straight down from the landing into the bottom wall, 8.5 px above the door's centre.
    let p = createPlayer(GREENHOUSE_ROOM);
    for (let i = 0; i < 200; i += 1) p = stepPlayer(p, { x: 0, y: 1 }, GREENHOUSE_ROOM);
    expect([p.x, p.y]).toEqual([240, 223.5]);
    expect(nearestInteractable(p, GREENHOUSE_ROOM.props)?.key).toBe('door_garden');
    // Garden: straight up from its landing (336, 434) into the glass box's south face, 8.5 px from the door.
    p = { ...createPlayer(GARDEN_ROOM), x: 336, y: 434 };
    for (let i = 0; i < 300; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, GARDEN_ROOM);
    expect([p.x, p.y]).toEqual([336, 416.5]);
    const d = door(GARDEN_ROOM, 'door_greenhouse');
    expect(Math.hypot(d.x - p.x, d.y - p.y)).toBeCloseTo(8.5, 1);
    expect(nearestInteractable(p, GARDEN_ROOM.props)?.key).toBe('door_greenhouse');
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
    it(`${room.key}: a step into a solid piece of furniture is stopped, a step onto any other is not`, () => {
      expect(room.walls).toEqual([...ringWalls(room.bounds), ...furnitureWalls(room.furniture)]);
      expect(room.furniture.length).toBeGreaterThanOrEqual(2);
      for (const f of room.furniture) {
        // Just below the piece's front edge, stepping up into it.
        const below: PlayerState = { ...createPlayer(room), x: f.x + f.w / 2, y: f.y + f.h + 0.5 };
        expect(hitsWall(room, below.x, below.y)).toBe(false);
        const p = stepPlayer(below, { x: 0, y: -1 }, room);
        expect(p.y, `${room.key} ${f.sheet.key}`).toBe(f.solid ? below.y : below.y - 1.25);
      }
    });

    it(`${room.key}: every display spot is in reach from the floor below it, where a walk up stops`, () => {
      for (const s of room.props.filter((p) => p.pedestalKey !== undefined)) {
        let p: PlayerState = { ...createPlayer(room), x: s.x, y: 190 };
        for (let i = 0; i < 100; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, room);
        expect(hitsWall(room, p.x, p.y)).toBe(false);
        expect(Math.hypot(s.x - p.x, s.y - p.y), s.key).toBeLessThanOrEqual(INTERACT_RANGE);
        expect(nearestInteractable(p, room.props)?.key).toBe(s.key);
      }
    });

    it(`${room.key}: doors in its wall bands, each landing and the start on a floor, display spots on its floor`, () => {
      expect(onFloor(room, room.playerStart, room.edgeMargin)).toBe(true);
      for (const p of room.props) {
        if (p.target) {
          expect(
            room.walls.some((w) => touches(rectOf(p), w)),
            p.key,
          ).toBe(true);
          const to = ROOMS[p.target.room];
          expect(onFloor(to, arrival(p), to.edgeMargin), `${room.key}.${p.key}`).toBe(true);
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
      greenhouse: GREENHOUSE_ROOM,
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
    expect(doors).toHaveLength(12);
    for (const { from, d, target } of doors) {
      const to = ROOMS[target.room];
      const back = to.props.filter((p) => p.target?.room === from.key);
      expect(back, `${from.key}.${d.key}`).toHaveLength(1);
      expect(back[0]?.key).toBe(target.door);
      const at = arrival(d);
      expect(hitsWall(to, at.x, at.y)).toBe(false);
      const gap = back[0] && Math.hypot(back[0].x - at.x, back[0].y - at.y);
      expect(gap, `${from.key}.${d.key}`).toBe(26);
      expect(nearestInteractable(at, to.props), `${from.key}.${d.key}`).toBeUndefined();
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
