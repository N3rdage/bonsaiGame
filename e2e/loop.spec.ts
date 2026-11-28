import { bootWorld, collectErrors, expect, hook, test } from './drive';
import {
  frontToGate,
  gardenToGreenhouse,
  gardenToShed,
  greenhouseToGarden,
  hallwayToFront,
  hallwayToLounge,
  loungeToHallway,
  loungeToShed,
  passageToStudy,
  shedToGarden,
  shedToLounge,
  studyToHallway,
  type Crossing,
} from './rooms';

// The whole property in one walk from a new game in the shed, through every
// kind of door: round the house's loop (shed, lounge, hallway, the front door,
// the front garden, the side gate, the back garden's passage and notch, the
// study's glass doors, the study, the hallway, the lounge, the shed) and out to
// the back garden and the greenhouse and home again. At every door the hook is
// read just before it is used and just after the room it leads to shows: the
// player comes out of the wall opposite the one it went into, on the room's
// side of that door, inside the room, facing into it (doors.ts `landing`).

type Wall = 'N' | 'S' | 'E' | 'W';

const OPPOSITE: Record<Wall, Wall> = { N: 'S', S: 'N', E: 'W', W: 'E' };
/** The facing into the room from a door in each wall. */
const INWARD: Record<Wall, string> = { N: 'down', S: 'up', E: 'left', W: 'right' };

function isWall(w: string): w is Wall {
  return w === 'N' || w === 'S' || w === 'E' || w === 'W';
}

/** The door keyed `key` among the room's doors in the hook, which must exist. */
function doorIn(h: BonsaiTestHook, key: string): { x: number; y: number; wall: Wall } {
  const door = h.doors?.find((d) => d.key === key);
  if (!door || !isWall(door.wall)) {
    throw new Error(
      `${h.room} has no wall door '${key}' in [${(h.doors ?? []).map((d) => d.key).join(', ')}]`,
    );
  }
  return { x: door.x, y: door.y, wall: door.wall };
}

/** The ring band's depth, logical px (shedRoom.ts WALL_BAND): the floor starts this far inside `roomBounds`. */
const WALL_BAND = 16;

/** Asserts one door's crossing from room `from` to room `to` (see the comment at the top). */
function expectCrossing({ from, to }: Crossing, fromRoom: string, toRoom: string): void {
  const where = `${fromRoom} -> ${toRoom}`;
  expect(from.room, where).toBe(fromRoom);
  expect(to.room, where).toBe(toRoom);
  const left = doorIn(from, from.near);
  const arrived = doorIn(to, to.arrivedBeside ?? '');
  // (a) Out of the wall opposite the one gone into: S to N, W to E.
  expect(arrived.wall, `${where}: arrival wall`).toBe(OPPOSITE[left.wall]);
  // (b) Set down level with the arrival door, on the room's side of it, inside the room's walls.
  const { x, y, facing } = to.player;
  const side = {
    N: [x, y > arrived.y],
    S: [x, y < arrived.y],
    E: [y, x < arrived.x],
    W: [y, x > arrived.x],
  } as const;
  const [along, inward] = side[arrived.wall];
  expect(along, `${where}: level with the door`).toBe(
    arrived.wall === 'N' || arrived.wall === 'S' ? arrived.x : arrived.y,
  );
  expect(
    inward,
    `${where}: (${String(x)}, ${String(y)}) on the inward side of the ${arrived.wall} door at (${String(arrived.x)}, ${String(arrived.y)})`,
  ).toBe(true);
  const b = to.roomBounds;
  if (!b) throw new Error(`${where}: no roomBounds`);
  expect(
    x > b.x + WALL_BAND &&
      x < b.x + b.w - WALL_BAND &&
      y > b.y + WALL_BAND &&
      y < b.y + b.h - WALL_BAND,
    `${where}: (${String(x)}, ${String(y)}) inside ${JSON.stringify(b)}`,
  ).toBe(true);
  // (c) Facing into the room, and out of the door's reach.
  expect(facing, `${where}: facing`).toBe(INWARD[arrived.wall]);
  expect(to.near, `${where}: nothing in reach`).toBe('');
}

test.describe('the full loop', () => {
  test(
    'every door from the shed round the house, the front garden and the back garden lands facing into the room',
    { tag: '@walk' },
    async ({ page }) => {
      const errors = collectErrors(page);
      await bootWorld(page);
      const start = await hook(page);
      expect([start.room, start.arrivedBeside]).toEqual(['shed', '']);

      const legs: [string, string, (p: typeof page) => Promise<Crossing>][] = [
        ['shed', 'lounge', shedToLounge],
        ['lounge', 'hallway', loungeToHallway],
        ['hallway', 'frontGarden', hallwayToFront],
        ['frontGarden', 'garden', frontToGate],
        ['garden', 'study', passageToStudy],
        ['study', 'hallway', studyToHallway],
        ['hallway', 'lounge', hallwayToLounge],
        ['lounge', 'shed', loungeToShed],
        ['shed', 'garden', shedToGarden],
        ['garden', 'greenhouse', gardenToGreenhouse],
        ['greenhouse', 'garden', greenhouseToGarden],
        ['garden', 'shed', gardenToShed],
      ];
      for (const [from, to, walk] of legs) {
        expectCrossing(await walk(page), from, to);
      }
      expect(errors).toEqual([]);
    },
  );
});
