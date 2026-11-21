import { describe, expect, it } from 'vitest';
import { MOVE_SPEED } from '../world/player';
import { CAMERA_ALPHA, TURN_STEP } from './camera';
import { cameraRelative, facingOf } from './move';

const UP = { x: 0, y: -1 };
const near = (v: { x: number; y: number }, x: number, y: number): void => {
  expect(v.x).toBeCloseTo(x, 9);
  expect(v.y).toBeCloseTo(y, 9);
};

describe('cameraRelative', () => {
  it('is the identity at the default heading', () => {
    near(cameraRelative({ x: 0.3, y: -0.8 }, CAMERA_ALPHA), 0.3, -0.8);
    near(cameraRelative({ x: 1, y: 1 }, CAMERA_ALPHA), 1, 1);
  });

  it('walks away from the camera at each cardinal heading', () => {
    // Camera south looks north; camera north looks south; east looks west; west looks east.
    near(cameraRelative(UP, -Math.PI / 2), 0, -1);
    near(cameraRelative(UP, Math.PI / 2), 0, 1);
    near(cameraRelative(UP, 0), -1, 0);
    near(cameraRelative(UP, Math.PI), 1, 0);
  });

  it('keeps right on the screen right of the way ahead', () => {
    near(cameraRelative({ x: 1, y: 0 }, Math.PI / 2), -1, 0);
    near(cameraRelative({ x: 1, y: 0 }, 0), 0, -1);
  });

  it('turns a diagonal with the camera', () => {
    // Up and right with the camera due east: ahead is west, right is north.
    near(cameraRelative({ x: 1, y: -1 }, 0), -1, -1);
    // A camera one step round from south, to the south-west: ahead is north-east.
    near(cameraRelative(UP, CAMERA_ALPHA - TURN_STEP), Math.SQRT1_2, -Math.SQRT1_2);
  });

  it('keeps the length, so the speed', () => {
    for (const input of [UP, { x: 1, y: 1 }, { x: 0.4, y: -0.2 }]) {
      for (let alpha = -4; alpha < 4; alpha += 0.7) {
        const v = cameraRelative(input, alpha);
        expect(Math.hypot(v.x, v.y) * MOVE_SPEED).toBeCloseTo(
          Math.hypot(input.x, input.y) * MOVE_SPEED,
          9,
        );
      }
    }
  });
});

describe('facingOf', () => {
  it('is the heading of the step, east 0 and south pi/2', () => {
    expect(facingOf(1, 0, 5)).toBe(0);
    expect(facingOf(0, 1, 5)).toBeCloseTo(Math.PI / 2, 9);
    expect(facingOf(-1, 0, 5)).toBeCloseTo(Math.PI, 9);
  });

  it('keeps the last facing when standing still', () => {
    expect(facingOf(0, 0, 1.25)).toBe(1.25);
  });
});
