import { describe, expect, it } from 'vitest';
import { castOffset } from '../world/lighting';
import { DEFAULT_YAW, RESET_YAW, cameraEye, createOrbitCamera, toViewerSpace } from './camera';
import { shadowOffset } from './ground';
import { unit } from './meshArrays';
import {
  INK_RGB,
  LIGHT_DIRECTION,
  OUTLINE_DEPTH,
  OUTLINE_WIDTH_PX,
  SURROUND_RGB,
  TOON_RAMP,
  bothWindings,
  roomLight,
  toonRampBytes,
} from './toon';

describe('the toon ramp', () => {
  it('pins three bands, darkest first, the lit band the palette colour itself', () => {
    expect(TOON_RAMP).toEqual([150, 205, 255, 255]);
    expect(new Set(TOON_RAMP).size).toBe(3);
    expect([...TOON_RAMP].sort((a, b) => a - b)).toEqual(TOON_RAMP);
    expect(TOON_RAMP.at(-1)).toBe(255);
  });

  it('becomes one byte per texel', () => {
    expect(Array.from(toonRampBytes())).toEqual([150, 205, 255, 255]);
    expect(Array.from(toonRampBytes([0, 128]))).toEqual([0, 128]);
  });

  it('refuses levels a byte cannot hold', () => {
    expect(() => toonRampBytes([0, 256])).toThrow();
    expect(() => toonRampBytes([-1])).toThrow();
    expect(() => toonRampBytes([12.5])).toThrow();
  });
});

describe('bothWindings', () => {
  it('lists each triangle forwards then reversed', () => {
    expect(Array.from(bothWindings(6))).toEqual([0, 1, 2, 0, 2, 1, 3, 4, 5, 3, 5, 4]);
  });

  it('is empty for an empty mesh and refuses a partial triangle', () => {
    expect(bothWindings(0)).toHaveLength(0);
    expect(() => bothWindings(4)).toThrow();
  });
});

describe('the Inked viewer constants', () => {
  it('pins ink and surround to art/inked/style.mjs', () => {
    expect(INK_RGB).toEqual({ r: 50, g: 42, b: 38 });
    expect(SURROUND_RGB).toEqual({ r: 62, g: 54, b: 50 });
  });

  it('lights from above, at unit length', () => {
    const { x, y, z } = LIGHT_DIRECTION;
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 12);
    expect(z).toBeGreaterThan(0.7);
  });

  it("is the rooms' one light: at the default orbit a shadow falls the rooms' way, as far per unit of height", () => {
    expect(LIGHT_DIRECTION).toEqual(roomLight(DEFAULT_YAW));
    expect(RESET_YAW).toBe(DEFAULT_YAW);
    // The camera's right along the ground and the way toward it, in the tree's own space (z up,
    // before the y mirror), from the eye's place (cameraEye).
    const eye = cameraEye(createOrbitCamera());
    const toward = unit({ x: eye.x, y: eye.y, z: 0 });
    const right = { x: toward.y, y: -toward.x, z: 0 };
    // On screen the right is the right: the eye, looking at the trunk, sees `right` to its right
    // once the y mirror (toViewerSpace) is applied.
    const view = toViewerSpace(right);
    const forward = toViewerSpace({ x: -toward.x, y: -toward.y, z: 0 });
    expect(forward.x * view.y - forward.y * view.x).toBeLessThan(0);
    const offset = shadowOffset(1);
    const room = castOffset(1);
    expect(offset.x * right.x + offset.y * right.y).toBeCloseTo(room.x, 12);
    expect(offset.x * toward.x + offset.y * toward.y).toBeCloseTo(room.y, 12);
    // So the pool falls right of the trunk and toward the camera, down the screen, as a room's.
    expect(room.x).toBeGreaterThan(0);
    expect(room.y).toBeGreaterThan(0);
  });

  it('pins the outline', () => {
    expect(OUTLINE_WIDTH_PX).toBe(2);
    expect(OUTLINE_DEPTH).toBe(0.1);
  });
});

describe('unit', () => {
  it('scales to unit length and falls back to straight up', () => {
    expect(unit({ x: 3, y: 0, z: 4 })).toEqual({ x: 0.6, y: 0, z: 0.8 });
    expect(unit({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 1 });
  });
});
