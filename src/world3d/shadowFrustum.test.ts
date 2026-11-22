import { describe, expect, it } from 'vitest';
import { lightDirectionBabylon } from './light';
import { shadowFrustum, type Extent } from './shadowFrustum';

const ROOM: Extent = { min: { x: -6, y: -0.1, z: -8 }, max: { x: 6, y: 3, z: 8 } };

describe('the shadow frustum', () => {
  const direction = lightDirectionBabylon();

  it('looks from in front of the room along the light, its window holding the floor corners', () => {
    const f = shadowFrustum(ROOM, direction);
    expect(f.minZ).toBeGreaterThan(0);
    expect(f.maxZ).toBeGreaterThan(f.minZ);
    expect(f.right).toBeGreaterThan(f.left);
    expect(f.top).toBeGreaterThan(f.bottom);
    const length = Math.hypot(direction.x, direction.z);
    const right = { x: direction.z / length, z: -direction.x / length };
    for (const x of [ROOM.min.x, ROOM.max.x]) {
      for (const z of [ROOM.min.z, ROOM.max.z]) {
        const u = (x - f.position.x) * right.x + (z - f.position.z) * right.z;
        expect(u).toBeGreaterThanOrEqual(f.left);
        expect(u).toBeLessThanOrEqual(f.right);
      }
    }
  });

  it('spans the room, not the camera far plane', () => {
    const f = shadowFrustum(ROOM, direction);
    expect(f.maxZ - f.minZ).toBeLessThan(40);
    expect(f.right - f.left).toBeLessThan(40);
  });

  it('is the same every call and grows with the room', () => {
    const f = shadowFrustum(ROOM, direction);
    expect(shadowFrustum(ROOM, direction)).toEqual(f);
    const bigger = shadowFrustum({ min: ROOM.min, max: { x: 12, y: 3, z: 8 } }, direction);
    expect(bigger.right - bigger.left).toBeGreaterThan(f.right - f.left);
  });

  it('rounds its window edges out to a half metre', () => {
    const f = shadowFrustum(ROOM, direction);
    for (const edge of [f.left, f.right, f.bottom, f.top]) {
      expect(Math.abs(edge / 0.5 - Math.round(edge / 0.5))).toBeLessThan(1e-9);
    }
  });
});
