import { describe, expect, it } from 'vitest';
import { LANDING_MARGIN, PLAYER_HALF, landing, wallDoor, type WallDoor } from './doors';
import { SHEETS } from './assets';
import { GARDEN_ROOM, GREENHOUSE, HOUSE, ROOMS, SHED } from './gardenRoom';
import { GREENHOUSE_ROOM } from './greenhouseRoom';
import { HALLWAY_ROOM } from './hallwayRoom';
import { INTERACT_RANGE } from './interactables';
import type { Facing } from './player';
import { SHED_ROOM, type Rect, type Room, type Wall } from './shedRoom';
import { STUDY_ROOM } from './studyRoom';

const INWARD: Record<Wall, Facing> = { N: 'down', S: 'up', E: 'left', W: 'right' };

const doors = Object.values(ROOMS).flatMap((room) =>
  room.props.flatMap((p) => (p.target ? [{ room, door: wallDoor(room, p.key) }] : [])),
);

/** True if the point lies inside or on the edge of `r`. */
const touches = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** True if the landing is on the room's side of the door's wall. */
function inward(door: WallDoor, at: { x: number; y: number }): boolean {
  if (door.wall === 'N') return at.y > door.y;
  if (door.wall === 'S') return at.y < door.y;
  if (door.wall === 'E') return at.x < door.x;
  return at.x > door.x;
}

describe('doors', () => {
  it('gives every door a wall and a target door in the target room that leads back', () => {
    expect(doors).toHaveLength(12);
    for (const { room, door } of doors) {
      const name = `${room.key}.${door.key}`;
      const target = door.target;
      if (!target) throw new Error(`${name} has no target`);
      const to: Room | undefined = ROOMS[target.room];
      expect(to, name).toBeDefined();
      const far = wallDoor(to, target.door);
      expect(far.target, name).toEqual({ room: room.key, door: door.key });
    }
  });

  it('lands inside bounds, on the inner side of the far door, clear of every wall, facing in', () => {
    for (const { room, door } of doors) {
      const name = `${room.key}.${door.key}`;
      const at = landing(room, door);
      const b = room.bounds;
      expect(at.x > b.x && at.x < b.x + b.w && at.y > b.y && at.y < b.y + b.h, name).toBe(true);
      expect(inward(door, at), name).toBe(true);
      // The player's sprite, PLAYER_HALF round its centre, overlaps no wall.
      for (const w of room.walls) {
        const grown = {
          x: w.x - PLAYER_HALF,
          y: w.y - PLAYER_HALF,
          w: w.w + 2 * PLAYER_HALF,
          h: w.h + 2 * PLAYER_HALF,
        };
        expect(touches(grown, at.x, at.y), `${name} ${JSON.stringify(w)}`).toBe(false);
      }
      expect(Math.hypot(door.x - at.x, door.y - at.y), name).toBeGreaterThan(INTERACT_RANGE);
      expect(at.facing, name).toBe(INWARD[door.wall]);
    }
  });

  it('assigns each door the wall its prop sits in', () => {
    expect(doors.map(({ room, door }) => `${room.key}.${door.key}:${door.wall}`)).toEqual([
      'shed.door:S',
      'shed.door_lounge:N',
      'garden.door:N',
      'garden.door_study:N',
      'garden.door_greenhouse:N',
      'lounge.door:S',
      'lounge.door_hallway:E',
      'hallway.door_lounge:W',
      'hallway.door_study:E',
      'study.door_hallway:W',
      'study.door_garden:S',
      'greenhouse.door_garden:S',
    ]);
  });

  it('pins the derived landing beside one door in each wall', () => {
    expect([PLAYER_HALF, LANDING_MARGIN, INTERACT_RANGE]).toEqual([12, 6, 20]);
    // N: the shed's lounge door (240, 56); its band's inner edge is 8 px below its centre.
    expect(landing(SHED_ROOM, wallDoor(SHED_ROOM, 'door_lounge'))).toEqual({
      x: 240,
      y: 82,
      facing: 'down',
    });
    // S: the greenhouse's door (240, 200).
    expect(landing(GREENHOUSE_ROOM, wallDoor(GREENHOUSE_ROOM, 'door_garden'))).toEqual({
      x: 240,
      y: 174,
      facing: 'up',
    });
    // S, 32 wide: the study's glass doors (320, 216).
    expect(landing(STUDY_ROOM, wallDoor(STUDY_ROOM, 'door_garden'))).toEqual({
      x: 320,
      y: 190,
      facing: 'up',
    });
    // E: the hallway's study door (392, 190).
    expect(landing(HALLWAY_ROOM, wallDoor(HALLWAY_ROOM, 'door_study'))).toEqual({
      x: 366,
      y: 190,
      facing: 'left',
    });
    // W: the hallway's lounge door (88, 190).
    expect(landing(HALLWAY_ROOM, wallDoor(HALLWAY_ROOM, 'door_lounge'))).toEqual({
      x: 114,
      y: 190,
      facing: 'right',
    });
  });

  it("steps a door in a building's face inside the garden out from that face, not the fence ring", () => {
    // Each face is one band deep, so the landing is 26 px below the door's centre as in a ring band.
    for (const [key, x, y, face] of [
      ['door', 80, 248, SHED],
      ['door_study', 344, 136, HOUSE],
      ['door_greenhouse', 336, 408, GREENHOUSE],
    ] as const) {
      const d = wallDoor(GARDEN_ROOM, key);
      expect([d.x, d.y, d.wall], key).toEqual([x, y, 'N']);
      expect(touches(face, d.x, d.y), key).toBe(true);
      expect(face.y + face.h - d.y, key).toBe(8);
      expect(landing(GARDEN_ROOM, d), key).toEqual({ x, y: y + 26, facing: 'down' });
    }
  });

  it('measures from the innermost solid holding the door, and from the ring where none does', () => {
    const base = { label: 'Door', prompt: 'Go', w: 16, h: 16 } as const;
    const room: Room = {
      ...SHED_ROOM,
      walls: [...SHED_ROOM.walls, { x: 200, y: 48, w: 32, h: 40 }],
      furniture: [{ sheet: SHEETS.desk, x: 280, y: 100, w: 32, h: 16, solid: true }],
    };
    // In the top band and a deeper wall overlapping it: stepped from the deeper one's edge, y 88.
    const deep: WallDoor = { ...base, key: 'a', x: 216, y: 56, wall: 'N' };
    expect(landing(room, deep)).toEqual({
      x: 216,
      y: 56 + 32 + PLAYER_HALF + LANDING_MARGIN,
      facing: 'down',
    });
    // In a solid piece of furniture's front edge, facing up into the room from its top (y 100).
    const desk: WallDoor = { ...base, key: 'b', x: 296, y: 108, wall: 'S' };
    expect(landing(room, desk)).toEqual({ x: 296, y: 82, facing: 'up' });
    // Held by no solid (outside the ring): the ring band's inner edge on its side, x 96 for W.
    const gap: WallDoor = { ...base, key: 'c', x: 70, y: 150, wall: 'W' };
    expect(landing(room, gap)).toEqual({
      x: 70 + 26 + PLAYER_HALF + LANDING_MARGIN,
      y: 150,
      facing: 'right',
    });
  });

  it('refuses a key that is not a door in a wall', () => {
    expect(() => wallDoor(SHED_ROOM, 'workbench')).toThrow('shed has no door workbench');
  });

  it("finds the garden's gate in the passage's north fence, a door with no target", () => {
    const gate = wallDoor(GARDEN_ROOM, 'gate');
    expect([gate.label, gate.prompt, gate.x, gate.y, gate.w, gate.h, gate.wall]).toEqual([
      'Gate',
      'Gate',
      440,
      8,
      16,
      16,
      'N',
    ]);
    expect(gate.target).toBeUndefined();
    expect(doors.some(({ door }) => door.key === 'gate')).toBe(false);
    // In the ring's top band, so a landing would be 26 px below it, inside the passage.
    expect(landing(GARDEN_ROOM, gate)).toEqual({ x: 440, y: 34, facing: 'down' });
  });
});
