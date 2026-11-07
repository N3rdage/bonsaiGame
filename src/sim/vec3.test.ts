import { describe, expect, it } from 'vitest';
import {
  darccos,
  dcos,
  degToRad,
  dsin,
  radToDeg,
  vec3,
  vec3Add,
  vec3Cross,
  vec3Length,
  vec3Normalize,
  vec3Rotate,
  vec3Scale,
  vec3Sub,
} from './vec3';

function expectVec(actual: { x: number; y: number; z: number }, x: number, y: number, z: number) {
  expect(actual.x).toBeCloseTo(x, 10);
  expect(actual.y).toBeCloseTo(y, 10);
  expect(actual.z).toBeCloseTo(z, 10);
}

describe('degree trig', () => {
  it('converts between degrees and radians', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 12);
    expect(radToDeg(Math.PI / 2)).toBeCloseTo(90, 12);
  });

  it('dcos / dsin take degrees', () => {
    expect(dcos(0)).toBe(1);
    expect(dcos(60)).toBeCloseTo(0.5, 12);
    expect(dsin(90)).toBeCloseTo(1, 12);
    expect(dsin(30)).toBeCloseTo(0.5, 12);
  });

  it('darccos returns degrees and clamps out-of-range input', () => {
    expect(darccos(1)).toBe(0);
    expect(darccos(0)).toBeCloseTo(90, 12);
    expect(darccos(-1)).toBeCloseTo(180, 12);
    expect(darccos(1.0000001)).toBe(0);
    expect(darccos(-5)).toBeCloseTo(180, 12);
  });
});

describe('vec3 basics', () => {
  it('adds, subtracts and scales', () => {
    expect(vec3Add(vec3(1, 2, 3), vec3(4, 5, 6))).toEqual(vec3(5, 7, 9));
    expect(vec3Sub(vec3(4, 5, 6), vec3(1, 2, 3))).toEqual(vec3(3, 3, 3));
    expect(vec3Scale(vec3(1, -2, 3), 2)).toEqual(vec3(2, -4, 6));
  });

  it('measures length', () => {
    expect(vec3Length(vec3(3, 4, 0))).toBe(5);
  });

  it('normalizes to unit length', () => {
    expectVec(vec3Normalize(vec3(0, 3, 4)), 0, 0.6, 0.8);
  });

  it('normalizes the zero vector to the zero vector', () => {
    expect(vec3Normalize(vec3(0, 0, 0))).toEqual(vec3(0, 0, 0));
  });

  it('cross(x, y) = z', () => {
    expect(vec3Cross(vec3(1, 0, 0), vec3(0, 1, 0))).toEqual(vec3(0, 0, 1));
    expect(vec3Cross(vec3(0, 1, 0), vec3(1, 0, 0))).toEqual(vec3(0, 0, -1));
  });
});

describe('vec3Rotate', () => {
  it('rotates +x by 90 degrees about +z onto +y', () => {
    expectVec(vec3Rotate(vec3(1, 0, 0), vec3(0, 0, 1), 90), 0, 1, 0);
  });

  it('leaves vectors parallel to the axis unchanged', () => {
    expectVec(vec3Rotate(vec3(0, 0, 2), vec3(0, 0, 1), 73), 0, 0, 2);
  });

  it('rotates +z by 20 degrees about +y toward +x', () => {
    expectVec(vec3Rotate(vec3(0, 0, 1), vec3(0, 1, 0), 20), dsin(20), 0, dcos(20));
  });

  it('preserves length', () => {
    const r = vec3Rotate(vec3(1, 2, 3), vec3Normalize(vec3(1, 1, 1)), 47);
    expect(vec3Length(r)).toBeCloseTo(Math.sqrt(14), 10);
  });
});
