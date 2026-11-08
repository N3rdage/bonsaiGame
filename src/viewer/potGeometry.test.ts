import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../sim/types';
import type { Rgb } from './potPalette';
import {
  FOOT_COUNT,
  FOOT_H,
  FOOT_HALF,
  POT_DEPTH,
  POT_LIP,
  POT_LIP_H,
  POT_R_BOT,
  POT_R_SOIL,
  POT_R_TOP,
  POT_SEGMENTS,
  POT_SOIL_Z,
  TRIANGLES_PER_FOOT,
  TRIANGLES_PER_SEGMENT,
  buildPotGeometry,
  type MeshArrays,
} from './potGeometry';

const tier0Triangles = POT_SEGMENTS * TRIANGLES_PER_SEGMENT;

function positionAt(mesh: MeshArrays, v: number): Vec3 {
  const p = mesh.positions;
  return { x: p[v * 3] ?? NaN, y: p[v * 3 + 1] ?? NaN, z: p[v * 3 + 2] ?? NaN };
}

function colorAt(mesh: MeshArrays, v: number): [number, number, number] {
  const c = mesh.colors;
  return [c[v * 3] ?? NaN, c[v * 3 + 1] ?? NaN, c[v * 3 + 2] ?? NaN];
}

function expectVec(actual: Vec3, expected: Vec3): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(1e-6);
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(1e-6);
  expect(Math.abs(actual.z - expected.z)).toBeLessThan(1e-6);
}

function expectColor(actual: [number, number, number], { r, g, b }: Rgb): void {
  const expected = [r / 255, g / 255, b / 255];
  actual.forEach((c, i) => {
    expect(c).toBeCloseTo(expected[i] ?? NaN, 6);
  });
}

describe('buildPotGeometry (obj_viewer_3d _draw_pot)', () => {
  it('pins the prototype dimensions in display units', () => {
    expect(POT_R_TOP).toBeCloseTo(0.4, 10);
    expect(POT_R_BOT).toBeCloseTo(0.288, 10);
    expect(POT_DEPTH).toBeCloseTo(0.24, 10);
    expect(POT_LIP).toBeCloseTo(0.056, 10);
    expect(POT_LIP_H).toBeCloseTo(0.064, 10);
    expect(POT_SOIL_Z).toBeCloseTo(-0.048, 10);
    expect(POT_R_SOIL).toBeCloseTo(0.36, 10);
    expect(POT_SEGMENTS).toBe(28);
    expect(FOOT_HALF).toBeCloseTo(0.088, 10);
    expect(FOOT_H).toBeCloseTo(0.104, 10);
    expect(TRIANGLES_PER_SEGMENT).toBe(8);
    expect(TRIANGLES_PER_FOOT).toBe(10);
    expect(FOOT_COUNT).toBe(4);
  });

  it('emits one triangle list with matching colour data', () => {
    const pot = buildPotGeometry(0);
    expect(pot.positions.length).toBe(tier0Triangles * 3 * 3);
    expect(pot.colors.length).toBe(pot.positions.length);
  });

  it('adds four feet to the fancy pot', () => {
    const pot = buildPotGeometry(1);
    expect(pot.positions.length).toBe((tier0Triangles + FOOT_COUNT * TRIANGLES_PER_FOOT) * 3 * 3);
    expect(FOOT_COUNT * TRIANGLES_PER_FOOT * 3).toBe(4 * 5 * 2 * 3);
  });

  it('builds the first segment of the terracotta pot vertex for vertex', () => {
    const body = { r: 150, g: 90, b: 55 };
    const dark = { r: 85, g: 50, b: 30 };
    const rim = { r: 170, g: 105, b: 65 };
    const soil = { r: 48, g: 34, b: 24 };
    const a = (2 * Math.PI) / 28;
    const ring = (r: number, z: number, second: boolean): Vec3 =>
      second ? { x: Math.cos(a) * r, y: Math.sin(a) * r, z } : { x: r, y: 0, z };
    const wt1 = ring(0.4, 0, false);
    const wt2 = ring(0.4, 0, true);
    const wb1 = ring(0.288, -0.24, false);
    const wb2 = ring(0.288, -0.24, true);
    const ro1 = ring(0.456, 0, false);
    const ro2 = ring(0.456, 0, true);
    const rb1 = ring(0.456, -0.064, false);
    const rb2 = ring(0.456, -0.064, true);
    const expected: [Vec3, Rgb][] = [
      [wt1, body],
      [wt2, body],
      [wb2, dark],
      [wt1, body],
      [wb2, dark],
      [wb1, dark],
      [{ x: 0, y: 0, z: -0.24 }, dark],
      [wb1, dark],
      [wb2, dark],
      [wt1, rim],
      [ro1, rim],
      [ro2, rim],
      [wt1, rim],
      [ro2, rim],
      [wt2, rim],
      [ro1, rim],
      [rb1, rim],
      [rb2, rim],
      [ro1, rim],
      [rb2, rim],
      [ro2, rim],
      [{ x: 0, y: 0, z: -0.048 }, soil],
      [ring(0.36, -0.048, false), soil],
      [ring(0.36, -0.048, true), soil],
    ];
    expect(expected).toHaveLength(TRIANGLES_PER_SEGMENT * 3);
    const pot = buildPotGeometry(0);
    expected.forEach(([p, c], v) => {
      expectVec(positionAt(pot, v), p);
      expectColor(colorAt(pot, v), c);
    });
  });

  it('hangs the first celadon foot at 45 degrees under the base', () => {
    const pot = buildPotGeometry(1);
    const first = tier0Triangles * 3;
    const centre = Math.cos(Math.PI / 4) * 0.17856;
    const h = 0.088;
    const corners: Vec3[] = [];
    for (const z of [-0.24, -0.344]) {
      for (const [dx, dy] of [
        [-h, -h],
        [h, -h],
        [h, h],
        [-h, h],
      ] as const) {
        corners.push({ x: centre + dx, y: centre + dy, z });
      }
    }
    const vertices = Array.from({ length: TRIANGLES_PER_FOOT * 3 }, (_, i) =>
      positionAt(pot, first + i),
    );
    for (const corner of corners) {
      const match = vertices.some(
        (v) =>
          Math.abs(v.x - corner.x) < 1e-6 &&
          Math.abs(v.y - corner.y) < 1e-6 &&
          Math.abs(v.z - corner.z) < 1e-6,
      );
      expect(match).toBe(true);
    }
    for (const v of vertices) {
      expect(corners.some((c) => Math.abs(v.x - c.x) < 1e-6 && Math.abs(v.y - c.y) < 1e-6)).toBe(
        true,
      );
    }
    for (let i = 0; i < TRIANGLES_PER_FOOT * 3; i++) {
      const sides = i < 24;
      expectColor(
        colorAt(pot, first + i),
        sides ? { r: 60, g: 110, b: 105 } : { r: 35, g: 70, b: 68 },
      );
      if (!sides) expect(positionAt(pot, first + i).z).toBeCloseTo(-0.344, 6);
    }
  });

  it.each([0, 1] as const)('keeps tier %i between the feet and the soil line', (tier) => {
    const { positions } = buildPotGeometry(tier);
    let maxRadius = 0;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i] ?? NaN;
      const y = positions[i + 1] ?? NaN;
      const z = positions[i + 2] ?? NaN;
      expect(z).toBeLessThanOrEqual(0);
      expect(z).toBeGreaterThanOrEqual(-(POT_DEPTH + FOOT_H) - 1e-6);
      maxRadius = Math.max(maxRadius, Math.hypot(x, y));
    }
    expect(maxRadius).toBeCloseTo(POT_R_TOP + POT_LIP, 5);
  });

  it('keeps colours in 0..1', () => {
    for (const c of [...buildPotGeometry(0).colors, ...buildPotGeometry(1).colors]) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});
