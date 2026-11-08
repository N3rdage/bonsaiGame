/**
 * Pot mesh as flat triangle-list arrays, ready to feed a three.js
 * BufferGeometry. Pure: no three.js import, so it is unit-tested in Node.
 *
 * Ported from `_draw_pot`, `_pot_quad` and `_pot_box` in
 * archive/gamemaker/objects/obj_viewer_3d/Draw_0.gml. Z-up, soil surface at
 * z=0, base below. Drawn without culling, so winding order does not matter.
 */

import type { PotTier, Vec3 } from '../sim/types';
import { DISPLAY_SCALE } from '../sim/geometry';
import { dcos, dsin } from '../sim/vec3';
import { SOIL_RGB, potPalette, type Rgb } from './potPalette';

export interface MeshArrays {
  positions: Float32Array;
  /** sRGB channels as 0..1 floats, three per vertex. */
  colors: Float32Array;
}

const S = DISPLAY_SCALE;
export const POT_R_TOP = 0.1 * S;
export const POT_R_BOT = 0.072 * S;
export const POT_DEPTH = 0.06 * S;
export const POT_LIP = 0.014 * S;
export const POT_LIP_H = 0.016 * S;
export const POT_SOIL_Z = -0.012 * S;
export const POT_R_SOIL = POT_R_TOP - 0.01 * S;
export const POT_SEGMENTS = 28;
export const FOOT_HALF = 0.022 * S;
export const FOOT_H = 0.026 * S;

/** Body wall 2 + base cap 1 + rim annulus 2 + rim band 2 + soil 1. */
export const TRIANGLES_PER_SEGMENT = 8;
/** Four side quads and a base quad; the top face abuts the pot. */
export const TRIANGLES_PER_FOOT = 10;
export const FOOT_COUNT = 4;

class TriangleList {
  private readonly positions: number[] = [];
  private readonly colors: number[] = [];

  vertex(p: Vec3, c: Rgb): void {
    this.positions.push(p.x, p.y, p.z);
    this.colors.push(c.r / 255, c.g / 255, c.b / 255);
  }

  /** Two-triangle quad in a single colour (`_pot_quad`). */
  quad(p1: Vec3, p2: Vec3, p3: Vec3, p4: Vec3, c: Rgb): void {
    this.vertex(p1, c);
    this.vertex(p2, c);
    this.vertex(p3, c);
    this.vertex(p1, c);
    this.vertex(p3, c);
    this.vertex(p4, c);
  }

  /** A foot hanging from (cx, cy, topZ): four sides and a base (`_pot_box`). */
  box(cx: number, cy: number, topZ: number, half: number, h: number, side: Rgb, base: Rgb): void {
    const z1 = topZ - h;
    const a = { x: cx - half, y: cy - half, z: topZ };
    const b = { x: cx + half, y: cy - half, z: topZ };
    const c = { x: cx + half, y: cy + half, z: topZ };
    const d = { x: cx - half, y: cy + half, z: topZ };
    const a2 = { ...a, z: z1 };
    const b2 = { ...b, z: z1 };
    const c2 = { ...c, z: z1 };
    const d2 = { ...d, z: z1 };
    this.quad(a, b, b2, a2, side);
    this.quad(b, c, c2, b2, side);
    this.quad(c, d, d2, c2, side);
    this.quad(d, a, a2, d2, side);
    this.quad(a2, b2, c2, d2, base);
  }

  build(): MeshArrays {
    return { positions: new Float32Array(this.positions), colors: new Float32Array(this.colors) };
  }
}

const ring = (c: number, s: number, r: number, z: number): Vec3 => ({ x: c * r, y: s * r, z });

export function buildPotGeometry(tier: PotTier): MeshArrays {
  const pal = potPalette(tier);
  const list = new TriangleList();
  const rOuter = POT_R_TOP + POT_LIP;

  for (let i = 0; i < POT_SEGMENTS; i++) {
    const a1 = (i / POT_SEGMENTS) * 360;
    const a2 = ((i + 1) / POT_SEGMENTS) * 360;
    const c1 = dcos(a1);
    const s1 = dsin(a1);
    const c2 = dcos(a2);
    const s2 = dsin(a2);

    // Body wall, body colour at the top fading to the dark line colour at the base.
    const wt1 = ring(c1, s1, POT_R_TOP, 0);
    const wt2 = ring(c2, s2, POT_R_TOP, 0);
    const wb1 = ring(c1, s1, POT_R_BOT, -POT_DEPTH);
    const wb2 = ring(c2, s2, POT_R_BOT, -POT_DEPTH);
    list.vertex(wt1, pal.body);
    list.vertex(wt2, pal.body);
    list.vertex(wb2, pal.bodyLine);
    list.vertex(wt1, pal.body);
    list.vertex(wb2, pal.bodyLine);
    list.vertex(wb1, pal.bodyLine);

    list.vertex({ x: 0, y: 0, z: -POT_DEPTH }, pal.bodyLine);
    list.vertex(wb1, pal.bodyLine);
    list.vertex(wb2, pal.bodyLine);

    const ro1 = ring(c1, s1, rOuter, 0);
    const ro2 = ring(c2, s2, rOuter, 0);
    list.quad(wt1, ro1, ro2, wt2, pal.rim);
    list.quad(
      ro1,
      ring(c1, s1, rOuter, -POT_LIP_H),
      ring(c2, s2, rOuter, -POT_LIP_H),
      ro2,
      pal.rim,
    );

    list.vertex({ x: 0, y: 0, z: POT_SOIL_Z }, SOIL_RGB);
    list.vertex(ring(c1, s1, POT_R_SOIL, POT_SOIL_Z), SOIL_RGB);
    list.vertex(ring(c2, s2, POT_R_SOIL, POT_SOIL_Z), SOIL_RGB);
  }

  if (tier === 1) {
    const fr = POT_R_BOT * 0.62;
    for (let f = 0; f < FOOT_COUNT; f++) {
      const fa = 45 + f * 90;
      list.box(dcos(fa) * fr, dsin(fa) * fr, -POT_DEPTH, FOOT_HALF, FOOT_H, pal.body, pal.bodyLine);
    }
  }

  return list.build();
}
