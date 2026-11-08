/**
 * Flat triangle-list accumulator shared by the pure mesh builders. Pure: no
 * three.js import, so every builder that uses it is unit-tested in Node.
 */

import type { Vec3 } from '../sim/types';
import type { Rgb } from './potPalette';

export interface MeshArrays {
  positions: Float32Array;
  /** sRGB channels as 0..1 floats, three per vertex. */
  colors: Float32Array;
}

export class TriangleList {
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

  build(): MeshArrays {
    return { positions: new Float32Array(this.positions), colors: new Float32Array(this.colors) };
  }
}
