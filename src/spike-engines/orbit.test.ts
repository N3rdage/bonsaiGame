import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ORBIT,
  DISTANCE_MAX,
  DISTANCE_MIN,
  PITCH_MAX,
  PITCH_MIN,
  clampOrbit,
  dragOrbit,
  eyeOf,
  keyTurnOrbit,
  pinchOrbit,
  targetOf,
  wheelOrbit,
} from './orbit';

describe('the orbit camera', () => {
  it('wraps yaw and clamps pitch and distance', () => {
    expect(clampOrbit({ yaw: -30, pitch: 0, distance: 100 })).toEqual({
      yaw: 330,
      pitch: PITCH_MIN,
      distance: DISTANCE_MAX,
    });
    expect(clampOrbit({ yaw: 400, pitch: 120, distance: 0 })).toEqual({
      yaw: 40,
      pitch: PITCH_MAX,
      distance: DISTANCE_MIN,
    });
  });

  it('turns on a drag: right swings yaw down, down raises pitch', () => {
    const o = dragOrbit(DEFAULT_ORBIT, 100, 50);
    expect(o.yaw).toBeCloseTo(330, 9);
    expect(o.pitch).toBeCloseTo(DEFAULT_ORBIT.pitch + 15, 9);
  });

  it('zooms in on a spreading pinch, out on the wheel', () => {
    expect(pinchOrbit(DEFAULT_ORBIT, 100, 200).distance).toBeCloseTo(DEFAULT_ORBIT.distance / 2, 9);
    expect(pinchOrbit(DEFAULT_ORBIT, 0, 200)).toEqual(DEFAULT_ORBIT);
    expect(wheelOrbit(DEFAULT_ORBIT, 100).distance).toBeGreaterThan(DEFAULT_ORBIT.distance);
    expect(wheelOrbit(DEFAULT_ORBIT, -100).distance).toBeLessThan(DEFAULT_ORBIT.distance);
  });

  it('turns on Q and E at a fixed rate', () => {
    expect(keyTurnOrbit(DEFAULT_ORBIT, 1, 0.5).yaw).toBe(45);
    expect(keyTurnOrbit(DEFAULT_ORBIT, -1, 0.5).yaw).toBe(315);
  });

  it('stands the eye south of the target at yaw 0 and east at yaw 90', () => {
    const t = targetOf({ x: 1, y: 2 });
    const south = eyeOf({ yaw: 0, pitch: 0, distance: 5 }, t);
    expect(south.x).toBeCloseTo(1, 12);
    expect(south.y).toBeCloseTo(7, 12);
    expect(south.z).toBeCloseTo(t.z, 12);
    const east = eyeOf({ yaw: 90, pitch: 90, distance: 5 }, t);
    expect(east.z).toBeCloseTo(t.z + 5, 12);
    const side = eyeOf({ yaw: 90, pitch: 0, distance: 5 }, t);
    expect(side.x).toBeCloseTo(6, 12);
  });
});
