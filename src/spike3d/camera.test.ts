import { describe, expect, it } from 'vitest';
import { castOffset } from '../world/lighting';
import {
  ANGLES,
  angleNamed,
  eyeDirection,
  followX,
  lightDirection,
  nextAngle,
  roomInput,
  screenFacing,
  viewWidthMetres,
} from './camera';

const south = angleNamed('south');
const north = angleNamed('north');

describe('the spike cameras', () => {
  it('cycles south, cutaway, north and back, and falls back to south', () => {
    expect(ANGLES.map((a) => a.key)).toEqual(['south', 'cutaway', 'north']);
    expect(nextAngle(south).key).toBe('cutaway');
    expect(nextAngle(nextAngle(south)).key).toBe('north');
    expect(nextAngle(north).key).toBe('south');
    expect(angleNamed(null).key).toBe('south');
    expect(angleNamed('east').key).toBe('south');
  });

  it('stands south of the player from the south and north of it from the road', () => {
    const s = eyeDirection(south);
    expect(s.z).toBeGreaterThan(0);
    expect(s.x).toBeCloseTo(0, 9);
    expect(s.y).toBeCloseTo(Math.sin((55 * Math.PI) / 180), 9);
    expect(Math.hypot(s.x, s.y, s.z)).toBeCloseTo(1, 9);
    expect(eyeDirection(north).z).toBeLessThan(0);
  });

  it("lights from the screen's upper left at every angle, as the rooms' cast shadow falls", () => {
    // From the south a post's shadow falls east and south, the rooms' castOffset in metres.
    const l = lightDirection(south.yaw);
    const shadow = { x: -l.x / l.y, z: -l.z / l.y };
    const room = castOffset(1);
    expect(shadow.x).toBeCloseTo(room.x, 9);
    expect(shadow.z).toBeCloseTo(room.y, 9);
    expect(Math.hypot(l.x, l.y, l.z)).toBeCloseTo(1, 9);
    // From the north the screen is turned round, and so is the light.
    const n = lightDirection(north.yaw);
    expect([n.x, n.y, n.z].map((v) => v.toFixed(9))).toEqual(
      [-l.x, l.y, -l.z].map((v) => v.toFixed(9)),
    );
  });

  it('turns the keys with the camera, so up is always up the screen', () => {
    expect(roomInput({ x: 0, y: -1 }, south.yaw)).toEqual({ x: 0, y: -1 });
    expect(roomInput({ x: 1, y: 0 }, south.yaw)).toEqual({ x: 1, y: 0 });
    // From the road, up the screen is south toward the house and right is west.
    expect(roomInput({ x: 0, y: -1 }, north.yaw)).toEqual({ x: 0, y: 1 });
    expect(roomInput({ x: 1, y: 0 }, north.yaw)).toEqual({ x: -1, y: 0 });
  });

  it("turns the player's sprite row with the camera", () => {
    expect(screenFacing('up', south.yaw)).toBe('up');
    expect(screenFacing('up', north.yaw)).toBe('down');
    expect(screenFacing('right', north.yaw)).toBe('left');
    expect(screenFacing('left', 90)).toBe('up');
  });

  it("shows today's world camera's width and keeps the view inside the garden", () => {
    // 480 room px on a desktop, 384 on a phone (the S22 in landscape), at 32 px a metre.
    expect(viewWidthMetres(1280, 720)).toBe(15);
    expect(viewWidthMetres(824, 384)).toBe(12);
    expect(followX(7, 15, -3.5, 14.5)).toBe(7);
    expect(followX(-3, 15, -3.5, 14.5)).toBe(4);
    expect(followX(14, 15, -3.5, 14.5)).toBe(7);
    expect(followX(14, 30, -3.5, 14.5)).toBe(5.5);
  });
});
