import { describe, expect, it } from 'vitest';
import {
  collide,
  combineInput,
  groundDirection,
  screenFacing,
  stepWalker,
  stickInput,
  type Walker,
} from './movement';
import { PLAYER_RADIUS, WALK_SPEED } from './scene';

const none = { left: false, right: false, up: false, down: false };

describe('the walker', () => {
  it('adds the stick to the keys and caps the length at 1', () => {
    expect(combineInput({ ...none, up: true }, { x: 0, y: 0 })).toEqual({ x: 0, y: -1 });
    const both = combineInput({ ...none, up: true, right: true }, { x: 0, y: 0 });
    expect(Math.hypot(both.x, both.y)).toBeCloseTo(1, 12);
    expect(combineInput(none, { x: 0.3, y: 0.4 })).toEqual({ x: 0.3, y: 0.4 });
  });

  it('reads the stick as nothing in its dead zone and full at its radius', () => {
    expect(stickInput(3, 0)).toEqual({ x: 0, y: 0 });
    expect(stickInput(20, 0)).toEqual({ x: 0.5, y: 0 });
    expect(stickInput(0, 80)).toEqual({ x: 0, y: 1 });
  });

  it('walks up the screen away from the camera, whatever its yaw', () => {
    // Yaw 0: the camera south, looking north; up the screen is north (-y).
    expect(groundDirection({ x: 0, y: -1 }, 0)).toEqual({ x: 0, y: -1 });
    expect(groundDirection({ x: 1, y: 0 }, 0)).toEqual({ x: 1, y: 0 });
    // Yaw 90: the camera east, looking west; up the screen is west, right is north.
    const up = groundDirection({ x: 0, y: -1 }, 90);
    expect(up.x).toBeCloseTo(-1, 12);
    expect(up.y).toBeCloseTo(0, 12);
    const right = groundDirection({ x: 1, y: 0 }, 90);
    expect(right.y).toBeCloseTo(-1, 12);
    // Yaw 180: the camera north; up the screen is south.
    expect(groundDirection({ x: 0, y: -1 }, 180).y).toBeCloseTo(1, 12);
  });

  it('pushes a circle out of a box and slides along it', () => {
    const wall = { x0: 0, x1: 10, y0: 0, y1: 1 };
    // Overlapping the wall's south face by 0.1: pushed straight back out to the radius.
    const out = collide({ x: 5, y: 1 + PLAYER_RADIUS - 0.1 }, [wall]);
    expect(out.x).toBe(5);
    expect(out.y).toBeCloseTo(1 + PLAYER_RADIUS, 12);
    // A diagonal step into the wall keeps its sideways part.
    const w: Walker = { x: 5, y: 1 + PLAYER_RADIUS, heading: 0, walkAnim: 0 };
    const next = stepWalker(w, { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, 0, 0.1, [wall]);
    expect(next.x).toBeCloseTo(5 + Math.SQRT1_2 * WALK_SPEED * 0.1, 12);
    expect(next.y).toBeCloseTo(1 + PLAYER_RADIUS, 12);
  });

  it('pushes a centre inside a box out the nearest side', () => {
    const out = collide({ x: 0.9, y: 0.5 }, [{ x0: 0, x1: 1, y0: 0, y1: 1 }]);
    expect(out).toEqual({ x: 1 + PLAYER_RADIUS, y: 0.5 });
  });

  it('settles in a corner between two walls', () => {
    const walls = [
      { x0: 0, x1: 10, y0: 0, y1: 1 },
      { x0: 0, x1: 1, y0: 0, y1: 10 },
    ];
    const out = collide({ x: 1.1, y: 1.1 }, walls);
    expect(out.x).toBeCloseTo(1 + PLAYER_RADIUS, 12);
    expect(out.y).toBeCloseTo(1 + PLAYER_RADIUS, 12);
  });

  it('turns the walk cycle while moving and rests it at 0 standing', () => {
    const w: Walker = { x: 0, y: 0, heading: 0, walkAnim: 3.95 };
    const moved = stepWalker(w, { x: 1, y: 0 }, 0, 1 / 60, []);
    expect(moved.walkAnim).toBeCloseTo(0.09, 12);
    expect(stepWalker(moved, { x: 0, y: 0 }, 0, 1 / 60, []).walkAnim).toBe(0);
    expect(stepWalker(moved, { x: 0, y: 0 }, 0, 1 / 60, []).heading).toBe(moved.heading);
  });

  it('shows the row the walker faces as the camera sees it', () => {
    const north = -Math.PI / 2;
    expect(screenFacing(north, 0)).toBe('up');
    expect(screenFacing(north, 180)).toBe('down');
    expect(screenFacing(north, 90)).toBe('right');
    expect(screenFacing(0, 0)).toBe('right');
    expect(screenFacing(Math.PI / 2, 0)).toBe('down');
  });
});
