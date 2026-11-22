import { describe, expect, it } from 'vitest';
import { CAST_SHADOW, SHADOW_ALPHA, castOffset } from '../world/lighting';
import { lightDirection, lightDirectionBabylon, shadowDarkness, shadowOffset } from './light';

describe('the 3D world light', () => {
  it('is a unit vector that travels down, east and south', () => {
    const d = lightDirection();
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 10);
    expect(d.x).toBeGreaterThan(0);
    expect(d.y).toBeGreaterThan(0);
    expect(d.z).toBeLessThan(0);
  });

  it('throws a shadow down and to the right of the foot, as the 2D world does', () => {
    const { x, y } = shadowOffset(2);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
    expect(y / x).toBeCloseTo(CAST_SHADOW.direction[1] / CAST_SHADOW.direction[0], 10);
  });

  it('keeps the 2D length per unit of height', () => {
    // 32 px to the metre scales height and run alike, so the 2D offset of a 64 px caster is the 3D one of a 2 m caster.
    const flat = castOffset(64);
    const { x, y } = shadowOffset(2);
    expect(x).toBeCloseTo(flat.x / 32, 10);
    expect(y).toBeCloseTo(flat.y / 32, 10);
    expect(Math.hypot(x, y)).toBeCloseTo(CAST_SHADOW.length * 2, 10);
  });

  it('lays the same direction in Babylon with north as +z and up as +y', () => {
    const d = lightDirection();
    expect(lightDirectionBabylon()).toEqual({ x: d.x, y: d.z, z: -d.y });
  });

  it('darkens by the complement of the shadow wash opacity', () => {
    expect(shadowDarkness()).toBeCloseTo(1 - SHADOW_ALPHA, 10);
  });
});
