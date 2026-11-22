import { describe, expect, it } from 'vitest';
import { INWARD, landing, wallDoor } from '../world/doors';
import { ROOMS } from '../world/gardenRoom';
import type { Wall } from '../world/shedRoom';
import { DOOR_REACH, doorWalkedInto, walksIntoDoor } from './doorWalk';

const WALLS: readonly Wall[] = ['N', 'S', 'E', 'W'];
const door = (wall: Wall) => ({
  key: 'd',
  label: 'Door',
  prompt: 'To Elsewhere',
  x: 100,
  y: 100,
  w: 16,
  h: 16,
  wall,
});

describe('walksIntoDoor', () => {
  it.each(WALLS)('takes a %s door walked into, and not one walked from', (wall) => {
    const { dx, dy } = INWARD[wall];
    const player = { x: 100 + dx * 10, y: 100 + dy * 10 };
    expect(walksIntoDoor(player, { x: -dx, y: -dy }, door(wall))).toBe(true);
    expect(walksIntoDoor(player, { x: dx, y: dy }, door(wall))).toBe(false);
    expect(walksIntoDoor(player, { x: 0, y: 0 }, door(wall))).toBe(false);
  });

  it('does not take a door walked past along its wall', () => {
    expect(walksIntoDoor({ x: 100, y: 110 }, { x: 1, y: 0 }, door('N'))).toBe(false);
    expect(walksIntoDoor({ x: 100, y: 110 }, { x: 1, y: -0.2 }, door('N'))).toBe(false);
    expect(walksIntoDoor({ x: 110, y: 100 }, { x: 0, y: 1 }, door('W'))).toBe(false);
  });

  it('takes a diagonal approach within the cone', () => {
    expect(walksIntoDoor({ x: 100, y: 110 }, { x: 0.5, y: -1 }, door('N'))).toBe(true);
  });

  it('needs the player in the strip: across the door and within its reach', () => {
    const north = door('N');
    const up = { x: 0, y: -1 };
    expect(walksIntoDoor({ x: 100, y: 100 + DOOR_REACH }, up, north)).toBe(true);
    expect(walksIntoDoor({ x: 100, y: 100 + DOOR_REACH + 1 }, up, north)).toBe(false);
    expect(walksIntoDoor({ x: 100, y: 90 }, up, north)).toBe(false);
    expect(walksIntoDoor({ x: 112, y: 110 }, up, north)).toBe(true);
    expect(walksIntoDoor({ x: 113, y: 110 }, up, north)).toBe(false);
  });
});

describe('every door in the world', () => {
  const doors = Object.values(ROOMS).flatMap((room) =>
    room.props
      .filter((p) => p.target !== undefined)
      .map((p) => ({ room, door: wallDoor(room, p.key) })),
  );

  it('has a landing outside its own strip, so arriving does not go straight back', () => {
    expect(doors.length).toBeGreaterThan(0);
    for (const { room, door: d } of doors) {
      const { x, y } = landing(room, d);
      const { dx, dy } = INWARD[d.wall];
      const target = doorWalkedInto({ x, y }, { x: -dx, y: -dy }, room);
      expect(target, `${room.key}/${d.key}`).toBeUndefined();
    }
  });

  it('is taken from the strip walking into it, and leads to its target', () => {
    for (const { room, door: d } of doors) {
      const { dx, dy } = INWARD[d.wall];
      const player = { x: d.x + dx * 8, y: d.y + dy * 8 };
      expect(doorWalkedInto(player, { x: -dx, y: -dy }, room), `${room.key}/${d.key}`).toEqual(
        d.target,
      );
    }
  });
});
