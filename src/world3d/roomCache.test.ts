import { describe, expect, it } from 'vitest';
import { ROOMS } from '../world/gardenRoom';
import { GREENHOUSE_ROOM } from '../world/greenhouseRoom';
import { LOUNGE_ROOM } from '../world/loungeRoom';
import type { Room } from '../world/shedRoom';
import {
  ROOM_CHANGE_LOG,
  logChange,
  neighbourKeys,
  roomSignature,
  type RoomChange,
} from './roomCache';

describe('neighbourKeys', () => {
  it('lists the rooms the shed doors lead to, in prop order', () => {
    expect(neighbourKeys(ROOMS.shed)).toEqual(['garden', 'lounge']);
  });

  it('lists each room once and never the room itself, for every room', () => {
    for (const room of Object.values(ROOMS)) {
      const keys = neighbourKeys(room);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys).not.toContain(room.key);
    }
  });

  it('is empty for a room whose props lead nowhere', () => {
    expect(neighbourKeys({ ...LOUNGE_ROOM, props: [] })).toEqual([]);
  });
});

describe('roomSignature', () => {
  it('is the same for the same room and differs between rooms', () => {
    expect(roomSignature(LOUNGE_ROOM)).toBe(roomSignature({ ...LOUNGE_ROOM }));
    expect(roomSignature(LOUNGE_ROOM)).not.toBe(roomSignature(GREENHOUSE_ROOM));
  });

  it('changes when a prop moves or one is added, so a kept set is never stale', () => {
    const [first, ...rest] = LOUNGE_ROOM.props;
    if (!first) throw new Error('the lounge has props');
    const moved: Room = { ...LOUNGE_ROOM, props: [{ ...first, x: first.x + 8 }, ...rest] };
    expect(roomSignature(moved)).not.toBe(roomSignature(LOUNGE_ROOM));
    const added: Room = {
      ...LOUNGE_ROOM,
      props: [...LOUNGE_ROOM.props, { ...first, key: 'extra' }],
    };
    expect(roomSignature(added)).not.toBe(roomSignature(LOUNGE_ROOM));
  });

  it('changes when furniture is added, as a placed item does', () => {
    const [piece] = LOUNGE_ROOM.furniture;
    if (!piece) throw new Error('the lounge has furniture');
    const placed: Room = {
      ...LOUNGE_ROOM,
      furniture: [...LOUNGE_ROOM.furniture, { ...piece, x: piece.x + 40 }],
    };
    expect(roomSignature(placed)).not.toBe(roomSignature(LOUNGE_ROOM));
  });
});

describe('logChange', () => {
  const change = (n: number): RoomChange => ({ room: 'shed', first: n === 0, ms: n });

  it('appends without touching the log it was given', () => {
    const log = [change(0)];
    expect(logChange(log, change(1)).map((c) => c.ms)).toEqual([0, 1]);
    expect(log).toHaveLength(1);
  });

  it('keeps the latest ROOM_CHANGE_LOG entries', () => {
    let log: RoomChange[] = [];
    for (let n = 0; n < ROOM_CHANGE_LOG + 5; n += 1) log = logChange(log, change(n));
    expect(log).toHaveLength(ROOM_CHANGE_LOG);
    expect(log[0]?.ms).toBe(5);
    expect(log.at(-1)?.ms).toBe(ROOM_CHANGE_LOG + 4);
  });
});
