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
import {
  DRIVE,
  FRONT_GARDEN_ROOM,
  GARAGE_FACE,
  HOUSE_FACE,
  PASSAGE_FENCE,
  PATH,
  ROAD,
  ROLLER_DOOR,
} from './frontGardenRoom';
import { EXTERIORS, GARDEN_ROOM, GREENHOUSE, HOUSE, ROOMS, SHED } from './gardenRoom';
import { GREENHOUSE_ROOM } from './greenhouseRoom';
import { INTERACT_RANGE, nearestInteractable } from './interactables';
import { HALLWAY_BOUNDS, HALLWAY_ROOM } from './hallwayRoom';
import {
  HALLWAY_BLOCK,
  HALLWAY_BLOCK_CAPS,
  KITCHEN_COUNTER,
  KITCHEN_FLOOR,
  LOUNGE_ROOM,
} from './loungeRoom';
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
  type Furniture,
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

  it("stands Draw_0's five decor pieces on their prototype foot points, halved, at their Inked frames' sizes, none of them solid", () => {
    expect(SHED_ROOM.furniture.map(({ sheet, x, y, w, h }) => [sheet.key, x, y, w, h])).toEqual([
      // Feet at prototype (440, 174), (212, 352), (706, 256), (706, 388) and (300, 384), halved:
      // (220, 87), (106, 176), (353, 128), (353, 194), (150, 192). The Inked frames: the shelf
      // 24 x 20, the tools 12 x 32, the watering can 16 x 12, the pot stack 12 x 20, the sack 16 x 20.
      ['spr_shelf', 208, 67, 24, 20],
      ['spr_tools', 100, 144, 12, 32],
      ['spr_watering_can', 345, 116, 16, 12],
      ['spr_pot_stack', 347, 174, 12, 20],
      ['spr_sack', 142, 172, 16, 20],
    ]);
    // Each rect's bottom-centre is its prototype foot point, halved.
    expect(SHED_ROOM.furniture.map(({ x, y, w, h }) => [x + w / 2, y + h])).toEqual([
      [fromPrototype(440), fromPrototype(174)],
      [fromPrototype(212), fromPrototype(352)],
      [fromPrototype(706), fromPrototype(256)],
      [fromPrototype(706), fromPrototype(388)],
      [fromPrototype(300), fromPrototype(384)],
    ]);
    for (const f of SHED_ROOM.furniture) {
      expect([f.w, f.h]).toEqual([f.sheet.frameWidth / 4, f.sheet.frameHeight / 4]);
    }
    expect(SHED_ROOM.furniture.every((f) => !f.solid)).toBe(true);
    // Each stands its real height (art/inked/shed.mjs) at 21.33 px/m on the rest of its frame.
    expect(SHED_ROOM.furniture.map((f) => [f.stands?.height, f.stands?.foot])).toEqual([
      [12, 8],
      [28, 4],
      [6, 6],
      [12, 8],
      [12, 8],
    ]);
    // The floor clutter sorts against the player; the wall-mounted shelf is baked. Of the other
    // rooms only the house rooms sort theirs, the pieces that stand up off the floor.
    expect(SHED_ROOM.furniture.map((f) => f.sorted)).toEqual([false, true, true, true, true]);
    const house: readonly Room[] = [LOUNGE_ROOM, HALLWAY_ROOM, STUDY_ROOM];
    for (const room of Object.values(ROOMS).filter((r) => r !== SHED_ROOM)) {
      expect(
        room.furniture.some((f) => f.sorted),
        room.key,
      ).toBe(house.includes(room));
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
          y: art.y - art.sheet.frameHeight * art.scale * art.originY,
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

  it("is plan B3's back garden, 14.5 x 16 m at 32 px a metre, with its green floor", () => {
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
      ['gate', 'Gate', 'To Front Garden', 432, 8, 16, 16, undefined],
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

  it('tops the passage with the side gate in its north fence, to the front garden, reached up the passage', () => {
    const gate = door(GARDEN_ROOM, 'gate');
    expect([gate.wall, gate.target, gate.sheet]).toEqual([
      'N',
      { room: 'frontGarden', door: 'gate' },
      SHEETS.gate,
    ]);
    // In the north fence's band across the middle of the passage's walkable metre, x 424..440.
    expect([
      gate.x - gate.w / 2,
      gate.x + gate.w / 2,
      gate.y - gate.h / 2,
      gate.y + gate.h / 2,
    ]).toEqual([424, 440, 0, 16]);
    // From the lawn, up the notch and the passage into the fence: 8.5 px below the gate.
    const p = walk({ x: 432, y: 274 }, { x: 0, y: -1 }, 300);
    expect([p.x, p.y]).toEqual([432, 16.5]);
    expect(nearestInteractable(p, GARDEN_ROOM.props)?.key).toBe('gate');
    // Its landing, from the front garden's gate: below it in the passage, on the ground.
    const at = landing(GARDEN_ROOM, wallDoor(GARDEN_ROOM, 'gate'));
    expect(at).toEqual({ x: 432, y: 34, facing: 'down' });
    expect(walkable(at.x, at.y)).toBe(true);
    expect(nearestInteractable(at, GARDEN_ROOM.props)).toBeUndefined();
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

  it('draws the buildings over their footprints: roofs, each 2.4 m face where the garden sees it, the caps of the walls it sees edge-on, a glass box', () => {
    expect(GARDEN_ROOM.furniture).toBe(EXTERIORS);
    expect(EXTERIORS.map(({ sheet, x, y, w, h, solid }) => [sheet, x, y, w, h, solid])).toEqual([
      [SHEETS.houseRoof, 0, 0, 416, 144, false],
      [SHEETS.houseFace, 160, 96, 248, 48, false],
      [SHEETS.houseCapV, 408, 0, 8, 144, false],
      [SHEETS.houseWindow, 204, 100, 40, 24, false],
      [SHEETS.shedRoof, 0, 144, 160, 112, false],
      [SHEETS.shedFace, 0, 208, 160, 48, false],
      [SHEETS.greenhouseRoof, 256, 304, 160, 112, true],
      [SHEETS.greenhouseCap, 256, 304, 160, 8, false],
      [SHEETS.greenhouseCapV, 256, 304, 8, 64, false],
      [SHEETS.greenhouseCapV, 408, 304, 8, 64, false],
      [SHEETS.greenhouseFace, 256, 368, 160, 48, false],
    ]);
    // Only the glass box is solid furniture, through its roof; the house and the shed are wall rects.
    expect(furnitureWalls(EXTERIORS)).toEqual([GREENHOUSE]);
    // Every piece lies on the 4 px grid (the kitchen window is centred on x 7 m) inside its building's footprint.
    for (const f of EXTERIORS) {
      expect([f.x, f.y, f.w, f.h].every((v) => v % 4 === 0)).toBe(true);
      const within = (r: Rect): boolean =>
        f.x >= r.x && f.y >= r.y && f.x + f.w <= r.x + r.w && f.y + f.h <= r.y + r.h;
      expect([HOUSE, SHED, GREENHOUSE].some(within), f.sheet.key).toBe(true);
    }
    // Each door stands in its face: the shed's plank door, the glazed leaves of the study and the greenhouse.
    expect(propSprite(door(GARDEN_ROOM))?.sheet).toBe(SHEETS.shedDoor);
    expect(propSprite(door(GARDEN_ROOM, 'door_study'))?.sheet).toBe(SHEETS.doorGlazed);
    expect(propSprite(door(GARDEN_ROOM, 'door_greenhouse'))?.sheet).toBe(SHEETS.doorGlazed);
  });
});

describe('lounge room', () => {
  it("is plan B3's lounge-kitchen on the shed's canvas, 8.5 x 4.5 m in a ring of its own, the hallway's block solid in its north-east corner", () => {
    expect([LOUNGE_ROOM.key, LOUNGE_ROOM.width, LOUNGE_ROOM.height]).toEqual(['lounge', 480, 270]);
    expect(LOUNGE_ROOM.bounds).toEqual({ x: 144, y: 48, w: 304, h: 176 });
    expect(LOUNGE_ROOM.edgeMargin).toBe(SHED_ROOM.edgeMargin);
    expect(LOUNGE_ROOM.walls).toEqual([
      { x: 144, y: 48, w: 304, h: 16 },
      { x: 144, y: 208, w: 304, h: 16 },
      { x: 144, y: 48, w: 16, h: 176 },
      { x: 432, y: 48, w: 16, h: 176 },
      // The hallway's 3 x 2 m block, the fireplace, the side table and the kitchen counter's runs.
      { x: 336, y: 64, w: 96, h: 64 },
      { x: 224, y: 64, w: 32, h: 24 },
      { x: 160, y: 64, w: 16, h: 16 },
      { x: 336, y: 188, w: 96, h: 20 },
      { x: 412, y: 128, w: 20, h: 60 },
    ]);
    // 17 x 9 tiles of 16 px, 8.5 x 4.5 m at 50 cm a tile.
    expect(insideWalls(LOUNGE_ROOM)).toEqual({ x: 160, y: 64, w: 272, h: 144 });
    // The block, 6 x 4 tiles, in the floor's north-east corner, drawn as the paper, standing as
    // the walls do.
    expect(HALLWAY_BLOCK).toEqual({
      sheet: SHEETS.paper,
      x: 336,
      y: 64,
      w: 96,
      h: 64,
      solid: true,
      stands: { height: 48 },
    });
    // The kitchen below the block, x 336..432 and y 128..208, its quarry tiles over it, is open
    // floor joined to the lounge inside its counter: 0.6 m (20 px) deep along its south wall and
    // up its east wall to the block.
    expect(KITCHEN_FLOOR).toMatchObject({ x: 336, y: 128, w: 96, h: 80, solid: false });
    expect(
      KITCHEN_COUNTER.map(({ sheet, x, y, w, h, solid, sorted }) => [
        sheet.key,
        x,
        y,
        w,
        h,
        solid,
        sorted,
      ]),
    ).toEqual([
      ['spr_counter', 336, 188, 96, 20, true, true],
      ['spr_counter_v', 412, 128, 20, 60, true, true],
    ]);
    for (const [x, y] of [
      [340, 132],
      [408, 132],
      [340, 184],
      [408, 184],
      [330, 180],
      [330, 204],
    ] as const) {
      expect(hitsWall(LOUNGE_ROOM, x, y), `${String(x)}, ${String(y)}`).toBe(false);
    }
    for (const [x, y] of [
      [340, 204],
      [428, 132],
      [428, 204],
    ] as const) {
      expect(hitsWall(LOUNGE_ROOM, x, y), `${String(x)}, ${String(y)}`).toBe(true);
    }
    expect(LOUNGE_ROOM.playerStart).toEqual({ x: 240, y: 190 });
    expect(hitsWall(LOUNGE_ROOM, 240, 190)).toBe(false);
  });

  it('walks from the lounge across into the kitchen, against its counter, and up into the block', () => {
    let p = createPlayer(LOUNGE_ROOM);
    for (let i = 0; i < 300; i += 1) p = stepPlayer(p, { x: 1, y: 0 }, LOUNGE_ROOM);
    // The counter's south run stops a walk along y 190 at the kitchen's edge.
    expect([p.x, p.y]).toEqual([335, 190]);
    for (let i = 0; i < 32; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, LOUNGE_ROOM);
    for (let i = 0; i < 300; i += 1) p = stepPlayer(p, { x: 1, y: 0 }, LOUNGE_ROOM);
    // Its east run stops a walk along y 150.
    expect([p.x, p.y]).toEqual([411.25, 150]);
    for (let i = 0; i < 100; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, LOUNGE_ROOM);
    expect([p.x, p.y]).toEqual([411.25, 128.75]);
  });

  it('has two display spots, lounge_mantel and lounge_side_table, on its furniture, a door in the bottom wall and one in the block', () => {
    expect(
      LOUNGE_ROOM.props.map((p) => [p.key, p.label, p.prompt, p.x, p.y, p.w, p.h, p.pedestalKey]),
    ).toEqual([
      ['pedestal_1', 'Pedestal', 'Use Pedestal', 240, 77, 32, 22, 'lounge_mantel'],
      ['pedestal_2', 'Pedestal', 'Use Pedestal', 168, 74, 16, 12, 'lounge_side_table'],
      ['door', 'Door', 'Back to Shed', 240, 216, 16, 16, undefined],
      ['door_hallway', 'Door', 'To Hallway', 344, 96, 16, 16, undefined],
    ]);
    // Plan B3 row 3: the bottom wall is the shed's row, so the shed door's square stays at x 240,
    // 2.5 m along the floor.
    expect(door(LOUNGE_ROOM).y - door(LOUNGE_ROOM).h / 2).toBe(SHED_RING.y1);
    expect(door(LOUNGE_ROOM).x - insideWalls(LOUNGE_ROOM).x).toBe(2.5 * 32);
    // Plan B3 row 4: in the block's west face, 1 m from its north end.
    const toHallway = door(LOUNGE_ROOM, 'door_hallway');
    expect([toHallway.x - 8, toHallway.y - HALLWAY_BLOCK.y]).toEqual([HALLWAY_BLOCK.x, 32]);
    expect(toHallway.wall).toBe('E');
    expect(toHallway.target).toEqual({ room: 'hallway', door: 'door_lounge' });
    expect(arrival(toHallway)).toEqual({ x: 210, y: 176, facing: 'right' });
    // Its landing, measured from the block's west face, is on the floor west of the block, facing it.
    expect(arrival(door(HALLWAY_ROOM, 'door_lounge'))).toEqual({ x: 318, y: 96, facing: 'left' });
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
    expect([p.x, p.y]).toEqual([240, 88.75]);
    expect(nearestInteractable(p, LOUNGE_ROOM.props)?.key).toBe('pedestal_1');
  });

  it('keeps the side table in reach of a walk into the left wall and up from either landing, stopped by the table', () => {
    // On the 1.25 px step grid: from the shed door's landing (240, 190) to (160, 80), from the
    // hallway door's (318, 96) to (160.5, 81).
    for (const [start, stop] of [
      [LOUNGE_ROOM.playerStart, [160, 80]],
      [{ x: 318, y: 96 }, [160.5, 81]],
    ] as const) {
      let p: PlayerState = { ...createPlayer(LOUNGE_ROOM), ...start };
      for (let i = 0; i < 400; i += 1) p = stepPlayer(p, { x: -1, y: 0 }, LOUNGE_ROOM);
      for (let i = 0; i < 200; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, LOUNGE_ROOM);
      expect([p.x, p.y]).toEqual(stop);
      expect(nearestInteractable(p, LOUNGE_ROOM.props)?.key).toBe('pedestal_2');
    }
  });

  it("keeps the hallway door in reach of a walk up to its row and east into the block's face", () => {
    let p = createPlayer(LOUNGE_ROOM);
    for (let i = 0; i < 76; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, LOUNGE_ROOM);
    expect([p.x, p.y]).toEqual([240, 95]);
    for (let i = 0; i < 200; i += 1) p = stepPlayer(p, { x: 1, y: 0 }, LOUNGE_ROOM);
    expect([p.x, p.y]).toEqual([335, 95]);
    expect(nearestInteractable(p, LOUNGE_ROOM.props)?.key).toBe('door_hallway');
  });
});

describe('hallway room', () => {
  it("is plan B3's 3 x 2 m entrance hall on the shed's canvas, walled solid all round", () => {
    expect([HALLWAY_ROOM.key, HALLWAY_ROOM.width, HALLWAY_ROOM.height]).toEqual([
      'hallway',
      480,
      270,
    ]);
    expect(HALLWAY_ROOM.bounds).toEqual({ x: 176, y: 128, w: 128, h: 96 });
    expect(HALLWAY_ROOM.edgeMargin).toBe(SHED_ROOM.edgeMargin);
    expect(HALLWAY_ROOM.walls).toEqual([
      { x: 176, y: 128, w: 128, h: 16 },
      { x: 176, y: 208, w: 128, h: 16 },
      { x: 176, y: 128, w: 16, h: 96 },
      { x: 288, y: 128, w: 16, h: 96 },
    ]);
    // 6 x 4 tiles of 16 px.
    expect(insideWalls(HALLWAY_ROOM)).toEqual({ x: 192, y: 144, w: 96, h: 64 });
    expect(HALLWAY_ROOM.playerStart).toEqual({ x: 210, y: 176 });
    expect(hitsWall(HALLWAY_ROOM, 210, 176)).toBe(false);
    expect(HALLWAY_ROOM.windows).toEqual([]);
    expect(HALLWAY_ROOM.floor).toBe(0x261c16);
  });

  it('has a runner and a console table along the bottom wall between the side doors, neither solid', () => {
    expect(
      HALLWAY_ROOM.furniture.map(({ sheet, x, y, w, h, solid }) => [sheet.key, x, y, w, h, solid]),
    ).toEqual([
      ['spr_runner', 200, 184, 60, 24, false],
      ['spr_hall_table', 266, 196, 16, 12, false],
    ]);
    const floor = insideWalls(HALLWAY_ROOM);
    for (const f of HALLWAY_ROOM.furniture) {
      expect(f.y + f.h).toBe(floor.y + floor.h);
      expect(f.x > floor.x && f.x + f.w < floor.x + floor.w).toBe(true);
    }
  });

  it('has no display spots, a door in each side wall 1 m from its north end, the front door in the top wall', () => {
    expect(
      HALLWAY_ROOM.props.map((p) => [
        p.key,
        p.label,
        p.prompt,
        p.x,
        p.y,
        p.w,
        p.h,
        p.wall,
        p.target,
      ]),
    ).toEqual([
      [
        'door_lounge',
        'Door',
        'To Lounge',
        184,
        176,
        16,
        16,
        'W',
        { room: 'lounge', door: 'door_hallway' },
      ],
      [
        'door_front',
        'Door',
        'To Front Garden',
        240,
        136,
        16,
        16,
        'N',
        { room: 'frontGarden', door: 'door_house' },
      ],
      [
        'door_study',
        'Door',
        'To Study',
        296,
        176,
        16,
        16,
        'E',
        { room: 'study', door: 'door_hallway' },
      ],
    ]);
    // Plan B3 row 6: the front door fills the top band's tile 1.5 m along, at the hall's centre, x 232..248.
    const front = door(HALLWAY_ROOM, 'door_front');
    expect([front.x - 8, front.y - 8]).toEqual([232, HALLWAY_BOUNDS.y]);
    expect(front.x).toBe(HALLWAY_BOUNDS.x + HALLWAY_BOUNDS.w / 2);
    expect(front.x - insideWalls(HALLWAY_ROOM).x).toBe(1.5 * 32);
    expect(arrival(front)).toEqual({ x: 336, y: 190, facing: 'up' });
    // Rows 5 and 7: each side door in its wall's band, 1 m from the north end.
    const floor = insideWalls(HALLWAY_ROOM);
    expect(door(HALLWAY_ROOM, 'door_lounge').x - 8).toBe(HALLWAY_BOUNDS.x);
    expect(door(HALLWAY_ROOM, 'door_study').x + 8).toBe(HALLWAY_BOUNDS.x + HALLWAY_BOUNDS.w);
    for (const key of ['door_lounge', 'door_study']) {
      expect(door(HALLWAY_ROOM, key).y - floor.y, key).toBe(32);
    }
    expect(arrival(door(HALLWAY_ROOM, 'door_lounge'))).toEqual({ x: 318, y: 96, facing: 'left' });
    expect(arrival(door(HALLWAY_ROOM, 'door_study'))).toEqual({ x: 178, y: 96, facing: 'right' });
  });

  it('stops a walk up or down the hall at its walls', () => {
    let p = createPlayer(HALLWAY_ROOM);
    for (let i = 0; i < 100; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, HALLWAY_ROOM);
    expect([p.x, p.y]).toEqual([210, 144.75]);
    for (let i = 0; i < 100; i += 1) p = stepPlayer(p, { x: 0, y: 1 }, HALLWAY_ROOM);
    expect([p.x, p.y]).toEqual([210, 207.25]);
  });

  it('keeps the front door in reach of a walk straight up from its landing, stopped by the top wall', () => {
    let p: PlayerState = { ...createPlayer(HALLWAY_ROOM), x: 240, y: 162 };
    expect(nearestInteractable(p, HALLWAY_ROOM.props)).toBeUndefined();
    for (let i = 0; i < 100; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, HALLWAY_ROOM);
    expect([p.x, p.y]).toEqual([240, 144.5]);
    expect(nearestInteractable(p, HALLWAY_ROOM.props)?.key).toBe('door_front');
  });

  it("keeps each side door in reach of a walk from the front door's landing into its wall", () => {
    for (const [key, dx, x] of [
      ['door_lounge', -1, 192.5],
      ['door_study', 1, 287.5],
    ] as const) {
      let p: PlayerState = { ...createPlayer(HALLWAY_ROOM), x: 240, y: 162 };
      for (let i = 0; i < 100; i += 1) p = stepPlayer(p, { x: dx, y: 0 }, HALLWAY_ROOM);
      expect([p.x, p.y], key).toEqual([x, 162]);
      expect(nearestInteractable(p, HALLWAY_ROOM.props)?.key).toBe(key);
    }
  });
});

describe('front garden room', () => {
  const room = FRONT_GARDEN_ROOM;
  const walk = (from: { x: number; y: number }, input: MoveInput, steps: number): PlayerState => {
    let p: PlayerState = { ...createPlayer(room), ...from };
    for (let i = 0; i < steps; i += 1) p = stepPlayer(p, input, room);
    return p;
  };

  it("is plan B3's front garden, 18 x 4 m at 32 px a metre below a 3 m road, walled by its ring", () => {
    expect([room.key, room.width, room.height]).toEqual(['frontGarden', 576, 272]);
    // x −3.5..14.5 m from room x 0; y −4..0 m below the road's 96 px.
    expect(room.bounds).toEqual({ x: 0, y: 96, w: 576, h: 128 });
    expect(ROAD).toEqual({ x: 0, y: 0, w: 576, h: 96 });
    expect(room.walls).toEqual(ringWalls(room.bounds));
    expect(insideWalls(room)).toEqual({ x: 16, y: 112, w: 544, h: 96 });
    expect(room.edgeMargin).toBe(SHED_ROOM.edgeMargin);
    expect([room.windows, room.floor]).toEqual([[], 0x30502c]);
    // Not a placeable room, and no display spots or source plants: its props are its two doors.
    expect(room.props.every((p) => p.wall !== undefined)).toBe(true);
    // Nothing in it is solid: the road and the roofs lie outside bounds, the rest is drawn over the ring or the lawn.
    expect(furnitureWalls(room.furniture)).toEqual([]);
  });

  it('has the front door and the side gate in its south band, each leading back to its far side', () => {
    expect(
      room.props.map((p) => [p.key, p.label, p.prompt, p.x, p.y, p.w, p.h, p.wall, p.target]),
    ).toEqual([
      [
        'door_house',
        'Door',
        'To Hallway',
        336,
        216,
        16,
        16,
        'S',
        { room: 'hallway', door: 'door_front' },
      ],
      ['gate', 'Gate', 'To Back Garden', 544, 216, 16, 16, 'S', { room: 'garden', door: 'gate' }],
    ]);
    // The front door at x 7 m and the gate at 13.5 m, room x = (m + 3.5) * 32.
    expect([(7 + 3.5) * 32, (13.5 + 3.5) * 32]).toEqual([336, 544]);
    expect(propSprite(door(room, 'door_house'))?.sheet).toBe(SHEETS.frontDoor);
    expect(propSprite(door(room, 'gate'))?.sheet).toBe(SHEETS.gate);
    expect(arrival(door(room, 'door_house'))).toEqual({ x: 240, y: 162, facing: 'down' });
    expect(arrival(door(room, 'gate'))).toEqual({ x: 432, y: 34, facing: 'down' });
    // The start is the front door's landing: the room is only entered through a door.
    const { x, y } = landing(room, wallDoor(room, 'door_house'));
    expect(room.playerStart).toEqual({ x, y });
    expect(room.playerStart).toEqual({ x: 336, y: 190 });
  });

  it('walks east along the lawn from the front door to the gate and back, each in reach against the south band', () => {
    let p = walk({ x: 336, y: 190 }, { x: 0, y: 1 }, 100);
    expect([p.x, p.y]).toEqual([336, 207.5]);
    expect(nearestInteractable(p, room.props)?.key).toBe('door_house');
    p = walk({ x: 336, y: 190 }, { x: 1, y: 0 }, 400);
    // Stopped by the east fence's column.
    expect([p.x, p.y]).toEqual([559.75, 190]);
    p = walk({ x: 544, y: 190 }, { x: 0, y: 1 }, 100);
    expect(nearestInteractable(p, room.props)?.key).toBe('gate');
    // Up toward the road, the fence stops the walk at its band, even at the drive's and the path's gaps.
    for (const x of [64, 336]) expect(walk({ x, y: 190 }, { x: 0, y: -1 }, 200).y).toBe(112.5);
  });

  it('draws the road, the paving, the beds, the faces with the roller door and windows, and the roofs', () => {
    expect(room.furniture.map(({ sheet, x, y, w, h }) => [sheet.key, x, y, w, h])).toEqual([
      ['spr_road', 0, 0, 576, 96],
      ['spr_drive', 16, 96, 96, 112],
      ['spr_path', 320, 96, 32, 112],
      ['spr_bed', 128, 112, 176, 16],
      ['spr_bed', 368, 112, 176, 16],
      // The 2.4 m faces stand on the south band's bottom edge, y 224, rising to y 176.
      ['spr_house_face', 0, 176, 112, 48],
      ['spr_roller_door', 17.5, 184, 77, 40],
      ['spr_house_face', 112, 176, 416, 48],
      // Each window 40 x 24, its sill 20 px above the face's foot, as the kitchen window's.
      ['spr_house_window', 148, 180, 40, 24],
      ['spr_house_window', 212, 180, 40, 24],
      ['spr_house_window', 404, 180, 40, 24],
      ['spr_house_window', 468, 180, 40, 24],
      ['spr_fence', 528, 208, 48, 16],
      ['spr_house_roof', 0, 224, 528, 48],
      // The house's east wall, edge-on beside the passage: its cap from the face's top to the canvas's foot.
      ['spr_house_cap_v', 520, 176, 8, 96],
    ]);
    // The windows clear the front door's 24 px leaf, x 324..348, and stay inside the house's face.
    const windows = room.furniture.filter((f) => f.sheet === SHEETS.houseWindow);
    for (const w of windows) {
      expect(w.x + w.w <= 324 || w.x >= 348).toBe(true);
      expect(w.x >= HOUSE_FACE.x && w.x + w.w <= HOUSE_FACE.x + HOUSE_FACE.w).toBe(true);
    }
    // The drive, x −3.5..0 m, and the path, centred on the front door, run from the kerb to the faces.
    expect(DRIVE.x + DRIVE.w).toBe(3.5 * 32);
    expect(PATH.x + PATH.w / 2).toBe(door(room, 'door_house').x);
    // The garage face, x −3.5..0 m, its 2.4 m roller door centred on x −1.75 m; the house's, 0..13 m.
    expect([GARAGE_FACE.x, GARAGE_FACE.w, HOUSE_FACE.x, HOUSE_FACE.w]).toEqual([0, 112, 112, 416]);
    expect(ROLLER_DOOR.x + ROLLER_DOOR.w / 2).toBe((-1.75 + 3.5) * 32);
    expect(ROLLER_DOOR.w).toBeCloseTo(2.4 * 32, 0);
    expect([PASSAGE_FENCE.x, PASSAGE_FENCE.w]).toEqual([528, 48]);
  });
});

describe('study room', () => {
  it("is plan B3's 4.5 x 4.5 m study on the shed's canvas, in a ring of its own, walled solid all round", () => {
    expect([STUDY_ROOM.key, STUDY_ROOM.width, STUDY_ROOM.height]).toEqual(['study', 480, 270]);
    expect(STUDY_ROOM.bounds).toEqual({ x: 144, y: 48, w: 176, h: 176 });
    expect(STUDY_ROOM.edgeMargin).toBe(SHED_ROOM.edgeMargin);
    expect(STUDY_ROOM.walls).toEqual([
      { x: 144, y: 48, w: 176, h: 16 },
      { x: 144, y: 208, w: 176, h: 16 },
      { x: 144, y: 48, w: 16, h: 176 },
      { x: 304, y: 48, w: 16, h: 176 },
      // The desk and the bookcase.
      { x: 160, y: 64, w: 32, h: 16 },
      { x: 256, y: 64, w: 48, h: 16 },
    ]);
    // 9 x 9 tiles of 16 px.
    expect(insideWalls(STUDY_ROOM)).toEqual({ x: 160, y: 64, w: 144, h: 144 });
    expect(STUDY_ROOM.playerStart).toEqual({ x: 178, y: 96 });
    expect(hitsWall(STUDY_ROOM, 178, 96)).toBe(false);
    expect(STUDY_ROOM.floor).toBe(0x2a1618);
  });

  it('has two display spots, study_desk and study_bookshelf, on its furniture, a door in the left wall and glass doors in the bottom', () => {
    expect(
      STUDY_ROOM.props.map((p) => [p.key, p.label, p.prompt, p.x, p.y, p.w, p.h, p.pedestalKey]),
    ).toEqual([
      ['pedestal_1', 'Pedestal', 'Use Pedestal', 176, 70, 32, 20, 'study_desk'],
      ['pedestal_2', 'Pedestal', 'Use Pedestal', 296, 72.5, 16, 15, 'study_bookshelf'],
      ['door_hallway', 'Door', 'To Hallway', 152, 96, 16, 16, undefined],
      ['door_garden', 'Door', 'To Garden', 232, 216, 48, 16, undefined],
    ]);
    // Plan B3 row 8: in the left wall's band, 1 m from its north end.
    const toHallway = door(STUDY_ROOM, 'door_hallway');
    expect(toHallway.x - 8).toBe(STUDY_ROOM.walls[2]?.x);
    expect(toHallway.y - insideWalls(STUDY_ROOM).y).toBe(32);
    expect(toHallway.target).toEqual({ room: 'hallway', door: 'door_study' });
    expect(arrival(toHallway)).toEqual({ x: 270, y: 176, facing: 'left' });
  });

  it("puts the glass doors in the bottom wall's band 2.25 m along, 1.5 m wide, leading to the garden and back", () => {
    const d = door(STUDY_ROOM, 'door_garden');
    expect(STUDY_ROOM.walls[1]).toEqual({ x: 144, y: 208, w: 176, h: 16 });
    expect(d.x - insideWalls(STUDY_ROOM).x).toBe(2.25 * 32);
    expect([d.x - d.w / 2, d.x + d.w / 2, d.y - d.h / 2, d.y + d.h / 2]).toEqual([
      208, 256, 208, 224,
    ]);
    expect(d.target).toEqual({ room: 'garden', door: 'door_study' });
    expect(arrival(d)).toEqual({ x: 344, y: 162, facing: 'down' });
    expect(ROOMS[d.target?.room ?? 'study']).toBe(GARDEN_ROOM);
    // Each landing 26 px from the door leading back: below the garden's door, above the glass doors.
    const back = door(GARDEN_ROOM, 'door_study');
    expect(arrival(d)).toMatchObject({ x: back.x, y: back.y + 26 });
    expect(arrival(back)).toMatchObject({ x: d.x, y: d.y - 26 });
  });

  it('keeps the glass doors in reach of a walk down into the bottom wall below them', () => {
    // From the garden's landing straight down: the bottom wall stops the walk 8.5 px above the doors' centre.
    let p: PlayerState = { ...createPlayer(STUDY_ROOM), x: 232, y: 190 };
    expect(nearestInteractable(p, STUDY_ROOM.props)).toBeUndefined();
    for (let i = 0; i < 200; i += 1) p = stepPlayer(p, { x: 0, y: 1 }, STUDY_ROOM);
    expect([p.x, p.y]).toEqual([232, 207.5]);
    expect(nearestInteractable(p, STUDY_ROOM.props)?.key).toBe('door_garden');
    // From the hallway's landing: down into the bottom wall, then east along it into reach.
    p = createPlayer(STUDY_ROOM);
    for (let i = 0; i < 200; i += 1) p = stepPlayer(p, { x: 0, y: 1 }, STUDY_ROOM);
    expect([p.x, p.y]).toEqual([178, 207.25]);
    let steps = 0;
    while (nearestInteractable(p, STUDY_ROOM.props)?.key !== 'door_garden' && steps < 200) {
      p = stepPlayer(p, { x: 1, y: 0 }, STUDY_ROOM);
      steps += 1;
    }
    expect([p.x, p.y]).toEqual([214.25, 207.25]);
  });

  it('keeps each spot in reach of a player walked up against its furniture from the landing, however long the keys are held', () => {
    // From (178, 96) on the 1.25 px step grid: straight up, the desk stops the player at y 81;
    // into the right wall (x 303) and up, the bookcase at y 81.
    for (const [dx, key, x] of [
      [0, 'pedestal_1', 178],
      [1, 'pedestal_2', 303],
    ] as const) {
      let p = createPlayer(STUDY_ROOM);
      for (let i = 0; i < 300; i += 1) p = stepPlayer(p, { x: dx, y: 0 }, STUDY_ROOM);
      for (let i = 0; i < 200; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, STUDY_ROOM);
      expect([p.x, p.y]).toEqual([x, 81]);
      expect(nearestInteractable(p, STUDY_ROOM.props)?.key).toBe(key);
    }
  });

  it("keeps the hallway door in reach of a walk from the garden's landing up to its row and west into the left wall", () => {
    let p: PlayerState = { ...createPlayer(STUDY_ROOM), x: 232, y: 190 };
    for (let i = 0; i < 75; i += 1) p = stepPlayer(p, { x: 0, y: -1 }, STUDY_ROOM);
    expect([p.x, p.y]).toEqual([232, 96.25]);
    for (let i = 0; i < 200; i += 1) p = stepPlayer(p, { x: -1, y: 0 }, STUDY_ROOM);
    expect([p.x, p.y]).toEqual([160.75, 96.25]);
    expect(nearestInteractable(p, STUDY_ROOM.props)?.key).toBe('door_hallway');
  });
});

describe('greenhouse room', () => {
  const inside = (room: Room, at: { x: number; y: number }): boolean => {
    const f = insideWalls(room);
    return at.x > f.x && at.x < f.x + f.w && at.y > f.y && at.y < f.y + f.h;
  };

  it("is an inset glass house on the shed's canvas, walled solid all round, its floor 10x7 tiles and empty", () => {
    expect([GREENHOUSE_ROOM.key, GREENHOUSE_ROOM.width, GREENHOUSE_ROOM.height]).toEqual([
      'greenhouse',
      480,
      270,
    ]);
    expect(GREENHOUSE_ROOM.bounds).toEqual({ x: 144, y: 64, w: 192, h: 144 });
    expect(GREENHOUSE_ROOM.edgeMargin).toBe(SHED_ROOM.edgeMargin);
    expect(GREENHOUSE_ROOM.walls).toEqual([
      { x: 144, y: 64, w: 192, h: 16 },
      { x: 144, y: 192, w: 192, h: 16 },
      { x: 144, y: 64, w: 16, h: 144 },
      { x: 320, y: 64, w: 16, h: 144 },
    ]);
    // 160x112 inside the ring: 10x7 tiles of 16 px, 5 x 3.5 m at 50 cm a tile.
    expect(insideWalls(GREENHOUSE_ROOM)).toEqual({ x: 160, y: 80, w: 160, h: 112 });
    expect(GREENHOUSE_ROOM.windows).toEqual([]);
    expect(GREENHOUSE_ROOM.furniture).toEqual([]);
    expect(GREENHOUSE_ROOM.playerStart).toEqual({ x: 240, y: 174 });
    expect(GREENHOUSE_ROOM.floor).toBe(0x1c2420);
    // The floor-tree grid keeps its first row only (y 200 is in the bottom wall's band): five spots.
    expect(floorRows(GREENHOUSE_ROOM)).toEqual([160]);
    expect([0, 1, 2, 3, 4, 5].map((i) => floorSpot(i, GREENHOUSE_ROOM).x)).toEqual([
      170, 202, 234, 266, 298, 170,
    ]);
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
        200,
        16,
        16,
        { room: 'garden', door: 'door_greenhouse' },
      ],
    ]);
    const d = door(GREENHOUSE_ROOM, 'door_garden');
    expect([d.x - d.w / 2, d.x + d.w / 2, d.y - d.h / 2, d.y + d.h / 2]).toEqual([
      232, 248, 192, 208,
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
    expect([p.x, p.y]).toEqual([240, 191.5]);
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
      // The lounge's kitchen tiles and the hallway block's caps are drawn on the floor and on the
      // block, never stepped into; neither is solid.
      const overlays: readonly Furniture[] = [KITCHEN_FLOOR, ...HALLWAY_BLOCK_CAPS];
      for (const f of overlays) expect(f.solid).toBe(false);
      for (const f of room.furniture.filter((g) => !overlays.includes(g))) {
        // Just below the piece's front edge, stepping up into it; else (a piece on the bottom wall,
        // the hallway's runner and table, the kitchen counter's south run) just above its back edge,
        // stepping down into it; else (the counter's east run, between the block and the south run)
        // just west of it, stepping east into it.
        const approaches = [
          { x: f.x + f.w / 2, y: f.y + f.h + 0.5, dx: 0, dy: -1 },
          { x: f.x + f.w / 2, y: f.y - 0.5, dx: 0, dy: 1 },
          { x: f.x - 0.5, y: f.y + f.h / 2, dx: 1, dy: 0 },
        ];
        const a = approaches.find((q) => !hitsWall(room, q.x, q.y) && onFloor(room, q, 0));
        if (!a) throw new Error(`${room.key} ${f.sheet.key}`);
        const from: PlayerState = { ...createPlayer(room), x: a.x, y: a.y };
        const p = stepPlayer(from, { x: a.dx, y: a.dy }, room);
        const moved = [from.x + 1.25 * a.dx, from.y + 1.25 * a.dy];
        expect([p.x, p.y], `${room.key} ${f.sheet.key}`).toEqual(
          f.solid ? [from.x, from.y] : moved,
        );
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
      frontGarden: FRONT_GARDEN_ROOM,
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
    expect(doors).toHaveLength(16);
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

  it('walks from each side door landing into the wall or block with the door leading back in reach', () => {
    // Each landing is 26 px from the door; on the 1.25 px step grid the wall stops the player 8.5 px short of its centre.
    for (const [room, key, dx, x, y] of [
      [LOUNGE_ROOM, 'door_hallway', 1, 335.5, 96],
      [HALLWAY_ROOM, 'door_lounge', -1, 192.5, 176],
      [HALLWAY_ROOM, 'door_study', 1, 287.5, 176],
      [STUDY_ROOM, 'door_hallway', -1, 160.5, 96],
    ] as const) {
      const d = door(room, key);
      const start = { x: d.x - 26 * dx, y: d.y };
      let p: PlayerState = { ...createPlayer(room), ...start };
      for (let i = 0; i < 200; i += 1) p = stepPlayer(p, { x: dx, y: 0 }, room);
      expect([p.x, p.y], `${room.key}.${key}`).toEqual([x, y]);
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
