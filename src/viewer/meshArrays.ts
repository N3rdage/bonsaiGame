/**
 * Flat triangle-list accumulator shared by the pure mesh builders. Pure: no
 * three.js import, so every builder that uses it is unit-tested in Node.
 */

import type { Vec3 } from '../sim/types';
import type { Rgb } from './potPalette';

export interface MeshArrays {
  positions: Float32Array;
  /** Outward unit normals, three per vertex: the toon light ramp and the ink outline both read them. */
  normals: Float32Array;
  /** sRGB channels as 0..1 floats, three per vertex. */
  colors: Float32Array;
  /** Texture coordinates, two per vertex; (0, 0) for untextured meshes. */
  uvs: Float32Array;
}

/** `v` scaled to unit length; straight up when it has none. */
export function unit({ x, y, z }: Vec3): Vec3 {
  const len = Math.sqrt(x * x + y * y + z * z);
  return len > 0 ? { x: x / len, y: y / len, z: z / len } : { x: 0, y: 0, z: 1 };
}

export class TriangleList {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly uvs: number[] = [];

  vertex(p: Vec3, c: Rgb, n: Vec3, u = 0, v = 0): void {
    this.positions.push(p.x, p.y, p.z);
    this.normals.push(n.x, n.y, n.z);
    this.colors.push(c.r / 255, c.g / 255, c.b / 255);
    this.uvs.push(u, v);
  }

  /** Two-triangle quad in a single colour facing `n` (`_pot_quad`). */
  quad(p1: Vec3, p2: Vec3, p3: Vec3, p4: Vec3, c: Rgb, n: Vec3): void {
    this.vertex(p1, c, n);
    this.vertex(p2, c, n);
    this.vertex(p3, c, n);
    this.vertex(p1, c, n);
    this.vertex(p3, c, n);
    this.vertex(p4, c, n);
  }

  build(): MeshArrays {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      colors: new Float32Array(this.colors),
      uvs: new Float32Array(this.uvs),
    };
  }
}
