/**
 * Pot mesh as flat triangle-list arrays, ready to feed a three.js
 * BufferGeometry. Pure: no three.js import, so it is unit-tested in Node.
 *
 * Ported from `_draw_pot`, `_pot_quad` and `_pot_box` in
 * archive/gamemaker/objects/obj_viewer_3d/Draw_0.gml. Z-up, soil surface at
 * z=0, base below. Drawn from both sides, so winding order does not matter;
 * every vertex carries its face's outward normal instead.
 */

import type { PotTier, Vec3 } from '../sim/types';
import { DISPLAY_SCALE } from '../sim/geometry';
import { dcos, dsin } from '../sim/vec3';
import { TriangleList, unit, type MeshArrays } from './meshArrays';
import { SOIL_RGB, potPalette, type Rgb } from './potPalette';

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

/** A foot hanging from (cx, cy, topZ): four sides and a base (`_pot_box`). */
function box(
  list: TriangleList,
  cx: number,
  cy: number,
  topZ: number,
  half: number,
  h: number,
  side: Rgb,
  base: Rgb,
): void {
  const z1 = topZ - h;
  const a = { x: cx - half, y: cy - half, z: topZ };
  const b = { x: cx + half, y: cy - half, z: topZ };
  const c = { x: cx + half, y: cy + half, z: topZ };
  const d = { x: cx - half, y: cy + half, z: topZ };
  const a2 = { ...a, z: z1 };
  const b2 = { ...b, z: z1 };
  const c2 = { ...c, z: z1 };
  const d2 = { ...d, z: z1 };
  list.quad(a, b, b2, a2, side, { x: 0, y: -1, z: 0 });
  list.quad(b, c, c2, b2, side, { x: 1, y: 0, z: 0 });
  list.quad(c, d, d2, c2, side, { x: 0, y: 1, z: 0 });
  list.quad(d, a, a2, d2, side, { x: -1, y: 0, z: 0 });
  list.quad(a2, b2, c2, d2, base, DOWN);
}

const ring = (c: number, s: number, r: number, z: number): Vec3 => ({ x: c * r, y: s * r, z });

const UP: Vec3 = { x: 0, y: 0, z: 1 };
const DOWN: Vec3 = { x: 0, y: 0, z: -1 };

/** The body wall's outward normal at angle (c, s): radial, tipped down because the wall narrows to the base. */
export function wallNormal(c: number, s: number): Vec3 {
  return unit({ x: c * POT_DEPTH, y: s * POT_DEPTH, z: -(POT_R_TOP - POT_R_BOT) });
}

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
    const n1 = wallNormal(c1, s1);
    const n2 = wallNormal(c2, s2);
    list.vertex(wt1, pal.body, n1);
    list.vertex(wt2, pal.body, n2);
    list.vertex(wb2, pal.bodyLine, n2);
    list.vertex(wt1, pal.body, n1);
    list.vertex(wb2, pal.bodyLine, n2);
    list.vertex(wb1, pal.bodyLine, n1);

    list.vertex({ x: 0, y: 0, z: -POT_DEPTH }, pal.bodyLine, DOWN);
    list.vertex(wb1, pal.bodyLine, DOWN);
    list.vertex(wb2, pal.bodyLine, DOWN);

    const ro1 = ring(c1, s1, rOuter, 0);
    const ro2 = ring(c2, s2, rOuter, 0);
    list.quad(wt1, ro1, ro2, wt2, pal.rim, UP);
    // The rim band, smooth around like the wall.
    const r1 = { x: c1, y: s1, z: 0 };
    const r2 = { x: c2, y: s2, z: 0 };
    const rb1 = ring(c1, s1, rOuter, -POT_LIP_H);
    const rb2 = ring(c2, s2, rOuter, -POT_LIP_H);
    list.vertex(ro1, pal.rim, r1);
    list.vertex(rb1, pal.rim, r1);
    list.vertex(rb2, pal.rim, r2);
    list.vertex(ro1, pal.rim, r1);
    list.vertex(rb2, pal.rim, r2);
    list.vertex(ro2, pal.rim, r2);

    list.vertex({ x: 0, y: 0, z: POT_SOIL_Z }, SOIL_RGB, UP);
    list.vertex(ring(c1, s1, POT_R_SOIL, POT_SOIL_Z), SOIL_RGB, UP);
    list.vertex(ring(c2, s2, POT_R_SOIL, POT_SOIL_Z), SOIL_RGB, UP);
  }

  if (tier === 1) {
    const fr = POT_R_BOT * 0.62;
    for (let f = 0; f < FOOT_COUNT; f++) {
      const fa = 45 + f * 90;
      box(
        list,
        dcos(fa) * fr,
        dsin(fa) * fr,
        -POT_DEPTH,
        FOOT_HALF,
        FOOT_H,
        pal.body,
        pal.bodyLine,
      );
    }
  }

  return list.build();
}
