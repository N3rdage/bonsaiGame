import { describe, expect, it } from 'vitest';
import { ROOMS } from '../world/gardenRoom';
import type { RoomKey } from '../world/shedRoom';
import {
  BETA_MAX,
  BETA_MIN,
  CameraGesture,
  CameraRig,
  EASE_MS,
  RADIUS_DEFAULT,
  RADIUS_MAX,
  RADIUS_MIN,
  SKIRTING_HEIGHT,
  TURN_STEP,
  cameraPosition,
  cutNames,
  cutSpan,
  ease,
  facesCamera,
  segmentCrossesBox,
} from './camera';
import { playerFeet } from './meshes';
import { roomPlan3d } from './plan';

const DEG = Math.PI / 180;
/** The heading of a camera standing on each side of the room: alpha puts it at (cos, -sin) in (east, south). */
const HEADING = { S: -90 * DEG, N: 90 * DEG, E: 0, W: 180 * DEG };

describe('facesCamera', () => {
  it.each(['N', 'S', 'E', 'W'] as const)('a camera due %s cuts that side only', (side) => {
    for (const wall of ['N', 'S', 'E', 'W'] as const) {
      expect(facesCamera(wall, HEADING[side])).toBe(wall === side);
    }
  });

  it('cuts two sides at a heading between them', () => {
    expect(facesCamera('S', -45 * DEG)).toBe(true);
    expect(facesCamera('E', -45 * DEG)).toBe(true);
    expect(facesCamera('N', -45 * DEG)).toBe(false);
    expect(facesCamera('W', -45 * DEG)).toBe(false);
    expect(facesCamera('N', 135 * DEG)).toBe(true);
    expect(facesCamera('W', 135 * DEG)).toBe(true);
  });

  it('keeps a side standing until the camera is well past it, and cuts it after', () => {
    expect(facesCamera('E', -80 * DEG)).toBe(false);
    expect(facesCamera('E', -60 * DEG)).toBe(true);
  });

  it('is periodic in the heading and never cuts an interior wall', () => {
    expect(facesCamera('S', HEADING.S + 4 * Math.PI)).toBe(true);
    for (let a = -Math.PI; a <= Math.PI; a += 0.1) expect(facesCamera('interior', a)).toBe(false);
  });
});

describe('cutSpan', () => {
  it('lowers a wall to the skirting, drops a piece above it and keeps a shorter one whole', () => {
    expect(cutSpan(0, 2.4)).toEqual({ z0: 0, z1: SKIRTING_HEIGHT });
    expect(cutSpan(0, 0.2)).toEqual({ z0: 0, z1: 0.2 });
    expect(cutSpan(2, 2.4)).toBeUndefined();
  });
});

describe('CameraRig', () => {
  it('starts south of the player, looking north, at the default distance', () => {
    const rig = new CameraRig();
    expect(rig.alpha).toBeCloseTo(-Math.PI / 2);
    expect(rig.radius).toBe(RADIUS_DEFAULT);
  });

  it('clamps the pitch above the floor and off straight down', () => {
    const rig = new CameraRig();
    rig.turn(0, 10);
    expect(rig.beta).toBe(BETA_MAX);
    rig.turn(0, -10);
    expect(rig.beta).toBe(BETA_MIN);
    expect(BETA_MAX).toBeLessThan(Math.PI / 2);
  });

  it('clamps the distance both ways', () => {
    const rig = new CameraRig();
    rig.zoom(100);
    expect(rig.radius).toBe(RADIUS_MAX);
    rig.zoom(0.001);
    expect(rig.radius).toBe(RADIUS_MIN);
  });

  it('steps to the next 45 degrees, from between steps too', () => {
    const rig = new CameraRig();
    const start = rig.alpha;
    rig.step(1);
    expect(rig.alpha).toBeCloseTo(start + TURN_STEP);
    rig.step(-1);
    rig.step(-1);
    expect(rig.alpha).toBeCloseTo(start - TURN_STEP);
    rig.turn(0.1, 0);
    rig.step(1);
    expect(rig.alpha).toBeCloseTo(start);
  });
});

describe('ease', () => {
  it('covers about two thirds of the way in one time constant, and all of it in none to wait for', () => {
    expect(ease(0, 1, EASE_MS)).toBeCloseTo(1 - Math.exp(-1));
    expect(ease(0, 1, 0)).toBe(0);
    expect(ease(0, 1, Infinity)).toBe(1);
  });
});

describe('CameraGesture', () => {
  it('turns by a one-pointer drag and takes no more than two pointers', () => {
    const rig = new CameraRig();
    const gesture = new CameraGesture(rig);
    const start = rig.alpha;
    expect(gesture.down(1, 100, 100)).toBe(true);
    gesture.move(1, 150, 100);
    expect(rig.alpha).toBeLessThan(start);
    const beta = rig.beta;
    gesture.move(1, 150, 140);
    expect(rig.beta).toBeLessThan(beta);
    expect(gesture.down(2, 0, 0)).toBe(true);
    expect(gesture.down(3, 0, 0)).toBe(false);
    gesture.up(1);
    gesture.up(2);
    expect(gesture.has(1)).toBe(false);
  });

  it('zooms by a pinch and does not turn', () => {
    const rig = new CameraRig();
    const gesture = new CameraGesture(rig);
    gesture.down(1, 100, 100);
    gesture.down(2, 200, 100);
    const alpha = rig.alpha;
    gesture.move(2, 300, 100);
    expect(rig.radius).toBeCloseTo(RADIUS_DEFAULT / 2);
    expect(rig.alpha).toBe(alpha);
    gesture.move(2, 150, 100);
    expect(rig.radius).toBeGreaterThan(RADIUS_DEFAULT / 2);
  });

  it('ignores a pointer it does not hold', () => {
    const rig = new CameraRig();
    new CameraGesture(rig).move(7, 10, 10);
    expect(rig.alpha).toBeCloseTo(-Math.PI / 2);
  });
});

describe('cameraPosition', () => {
  it('stands south of the target at the default heading, above it', () => {
    const p = cameraPosition(
      { alpha: -Math.PI / 2, beta: Math.PI / 3, radius: 10 },
      { x: 1, y: 2, z: 0 },
    );
    expect(p.x).toBeCloseTo(1);
    expect(p.y).toBeCloseTo(2 + 10 * Math.sin(Math.PI / 3));
    expect(p.z).toBeCloseTo(5);
  });
});

describe('segmentCrossesBox', () => {
  const box = {
    name: 'b',
    wash: 'wood',
    x0: 0,
    x1: 1,
    y0: 0,
    y1: 1,
    z0: 0,
    z1: 2,
    solid: true,
  } as const;
  it('finds a segment through, over and beside the box', () => {
    expect(segmentCrossesBox({ x: -1, y: 0.5, z: 1 }, { x: 2, y: 0.5, z: 1 }, box)).toBe(true);
    expect(segmentCrossesBox({ x: -1, y: 0.5, z: 3 }, { x: 2, y: 0.5, z: 3 }, box)).toBe(false);
    expect(segmentCrossesBox({ x: -1, y: 2, z: 1 }, { x: 2, y: 2, z: 1 }, box)).toBe(false);
    expect(segmentCrossesBox({ x: -1, y: 0.5, z: 1 }, { x: -0.5, y: 0.5, z: 1 }, box)).toBe(false);
  });
});

describe('cutNames', () => {
  const view = (alpha: number) => ({ alpha, beta: 55 * DEG, radius: RADIUS_DEFAULT });
  const names = (key: RoomKey, alpha: number, px = { x: 160, y: 160 }): string[] =>
    cutNames(roomPlan3d(ROOMS[key]), view(alpha), playerFeet(px));

  it.each(['shed', 'lounge', 'hallway', 'study', 'greenhouse'] as const)(
    '%s: cuts exactly the walls on the camera side',
    (key) => {
      const plan = roomPlan3d(ROOMS[key]);
      for (const side of ['N', 'S', 'E', 'W'] as const) {
        const expected = plan.walls.filter((w) => w.side === side).map((w) => w.name);
        expect(names(key, HEADING[side])).toEqual(expect.arrayContaining(expected));
        const other = plan.walls.filter((w) => w.side !== side && w.side !== 'interior');
        for (const w of other) expect(names(key, HEADING[side])).not.toContain(w.name);
      }
    },
  );

  it('changes the cut set as the camera turns', () => {
    expect(names('shed', HEADING.S)).not.toEqual(names('shed', HEADING.S + TURN_STEP));
  });

  it('cuts only the tall pieces that hide the player outdoors', () => {
    const piece = (name: string, x0: number, y0: number, z1: number) => ({
      name,
      wash: 'render' as const,
      x0,
      x1: x0 + 2,
      y0,
      y1: y0 + 0.5,
      z0: 0,
      z1,
      solid: true,
    });
    const plan = {
      ...roomPlan3d(ROOMS.garden),
      walls: [],
      furniture: [
        piece('between', 9, 11, 2.4),
        piece('beside', 20, 11, 2.4),
        piece('behind', 9, 8.5, 2.4),
        piece('fence', 9, 11.6, 0.75),
      ],
    };
    const player = { x: 10, y: 10, z: 0 };
    expect(cutNames(plan, view(HEADING.S), player)).toEqual(['between']);
    expect(cutNames(plan, view(HEADING.N), player)).toEqual(['behind']);
    expect(cutNames(plan, view(HEADING.E), player)).toEqual([]);
  });
});
