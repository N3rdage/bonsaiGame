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
  pressRoute,
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
  const setup = (): { rig: CameraRig; gesture: CameraGesture } => {
    const rig = new CameraRig();
    return { rig, gesture: new CameraGesture(rig) };
  };

  it('turns by a one-finger drag', () => {
    const { rig, gesture } = setup();
    const start = rig.alpha;
    expect(gesture.down(1, 100, 100, 'camera')).toBe('drag');
    gesture.move(1, 150, 100);
    expect(rig.alpha).toBeLessThan(start);
    const beta = rig.beta;
    gesture.move(1, 150, 140);
    expect(rig.beta).toBeLessThan(beta);
    expect(gesture.up(1)).toBe('drag');
    expect(gesture.held).toBe(false);
  });

  it('leaves the camera alone while a finger is the stick', () => {
    const { rig, gesture } = setup();
    expect(gesture.down(1, 100, 100, 'stick')).toBe('stick');
    gesture.move(1, 150, 140);
    expect(rig.alpha).toBe(new CameraRig().alpha);
    expect(rig.beta).toBe(new CameraRig().beta);
    expect(gesture.up(1)).toBe('stick');
  });

  it.each([
    ['one finger on each half', 'stick', 'camera'],
    ['both on the right', 'camera', 'camera'],
    ['both on the left', 'stick', 'stick'],
    ['a button first, ground second', 'button', 'camera'],
    ['a button second', 'camera', 'button'],
  ] as const)('zooms by a pinch and does not turn: %s', (_name, first, second) => {
    const { rig, gesture } = setup();
    gesture.down(1, 100, 100, first);
    expect(gesture.down(2, 200, 100, second)).toBe('pinch');
    const { alpha, beta } = rig;
    gesture.move(2, 300, 100);
    expect(rig.radius).toBeCloseTo(RADIUS_DEFAULT / 2);
    gesture.move(2, 150, 100);
    expect(rig.radius).toBeGreaterThan(RADIUS_DEFAULT / 2);
    gesture.move(1, 90, 300);
    expect(rig.alpha).toBe(alpha);
    expect(rig.beta).toBe(beta);
  });

  it('stays a pinch, with nothing turned or tapped, until every finger is up', () => {
    const { rig, gesture } = setup();
    gesture.down(1, 100, 100, 'camera');
    gesture.down(2, 200, 100, 'camera');
    expect(gesture.up(1)).toBe('pinch');
    gesture.move(2, 260, 180);
    expect(rig.alpha).toBe(new CameraRig().alpha);
    expect(gesture.down(1, 100, 100, 'camera')).toBe('ignored');
    expect(gesture.up(2)).toBe('pinch');
    expect(gesture.up(1)).toBeUndefined();
    expect(gesture.down(3, 10, 10, 'camera')).toBe('drag');
  });

  it('holds a press on a button without turning the camera or being the stick', () => {
    const { rig, gesture } = setup();
    expect(gesture.down(1, 100, 100, 'button')).toBe('button');
    expect(gesture.held).toBe(true);
    gesture.move(1, 200, 200);
    expect(rig.alpha).toBe(new CameraRig().alpha);
    expect(rig.beta).toBe(new CameraRig().beta);
    expect(gesture.pinching).toBe(false);
    expect(gesture.up(1)).toBe('button');
  });

  it('makes a button and a finger on bare ground a pinch until both are up', () => {
    const { rig, gesture } = setup();
    expect(gesture.down(1, 100, 100, 'button')).toBe('button');
    expect(gesture.pinching).toBe(false);
    expect(gesture.down(2, 200, 100, 'camera')).toBe('pinch');
    expect(gesture.pinching).toBe(true);
    gesture.move(2, 300, 100);
    expect(rig.radius).toBeCloseTo(RADIUS_DEFAULT / 2);
    expect(gesture.up(2)).toBe('pinch');
    expect(gesture.pinching).toBe(true);
    expect(gesture.up(1)).toBe('pinch');
    expect(gesture.pinching).toBe(false);
  });

  it('is not pinching for a lone drag or stick', () => {
    const { gesture } = setup();
    gesture.down(1, 0, 0, 'camera');
    gesture.move(1, 10, 10);
    expect(gesture.pinching).toBe(false);
    gesture.up(1);
    gesture.down(2, 0, 0, 'stick');
    expect(gesture.pinching).toBe(false);
  });

  it('ignores a third finger and a pointer it does not hold', () => {
    const { rig, gesture } = setup();
    gesture.down(1, 0, 0, 'camera');
    gesture.down(2, 100, 0, 'camera');
    expect(gesture.down(3, 0, 0, 'camera')).toBe('ignored');
    expect(gesture.up(3)).toBeUndefined();
    gesture.move(7, 10, 10);
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
      roofs: [],
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

  it('cuts a roof over the line from the camera to the player, whole from the floor up', () => {
    const roof = (name: string, x0: number, y0: number) => ({
      name,
      wash: 'tile' as const,
      x0,
      x1: x0 + 2,
      y0,
      y1: y0 + 2,
      low: 2.25,
      high: 3,
      form: { kind: 'gable', axis: 'x' } as const,
    });
    const plan = {
      ...roomPlan3d(ROOMS.garden),
      walls: [],
      furniture: [],
      roofs: [roof('between', 9, 10.5), roof('beside', 20, 11), roof('behind', 9, 7)],
    };
    const player = { x: 10, y: 10, z: 0 };
    expect(cutNames(plan, view(HEADING.S), player)).toEqual(['between']);
    expect(cutNames(plan, view(HEADING.N), player)).toEqual(['behind']);
    expect(cutNames(plan, view(HEADING.E), player)).toEqual([]);
  });
});

describe('pressRoute', () => {
  const press = { world3d: true, touch: true, left: true };

  it('is the stick in the 2D world, whatever the press', () => {
    expect(pressRoute({ ...press, world3d: false, touch: false, left: false })).toBe('stick');
  });

  it('makes a touch on the left half the stick', () => {
    expect(pressRoute(press)).toBe('stick');
  });

  it('gives a touch on the right half and the mouse to the camera', () => {
    expect(pressRoute({ ...press, left: false })).toBe('camera');
    expect(pressRoute({ ...press, touch: false })).toBe('camera');
  });
});
