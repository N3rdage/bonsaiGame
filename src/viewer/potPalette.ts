/**
 * Pot colours by tier. Ported from `pot_palette` in
 * archive/gamemaker/scripts/scr_growth/scr_growth.gml so the 3D pot and the
 * future 2D sprite share one table. Standard is terracotta; fancy is glazed
 * celadon. `bodyLine`/`rimLine` were the 2D outlines; the 3D pot uses
 * `bodyLine` as its dark base gradient.
 */

import type { PotTier } from '../sim/types';

/** An sRGB colour with 0..255 integer channels. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface PotPalette {
  body: Rgb;
  bodyLine: Rgb;
  rim: Rgb;
  rimLine: Rgb;
  disc: Rgb;
  /** Glaze sheen; absent for unglazed pots. */
  highlight?: Rgb;
}

/** Soil surface colour (from the prototype's `_draw_pot`). */
export const SOIL_RGB: Rgb = { r: 48, g: 34, b: 24 };

const rgb = (r: number, g: number, b: number): Rgb => ({ r, g, b });

export function potPalette(tier: PotTier): PotPalette {
  if (tier === 1) {
    return {
      body: rgb(60, 110, 105),
      bodyLine: rgb(35, 70, 68),
      rim: rgb(95, 150, 140),
      rimLine: rgb(35, 70, 68),
      disc: rgb(45, 80, 75),
      highlight: rgb(150, 200, 190),
    };
  }
  return {
    body: rgb(150, 90, 55),
    bodyLine: rgb(85, 50, 30),
    rim: rgb(170, 105, 65),
    rimLine: rgb(85, 50, 30),
    disc: rgb(70, 55, 45),
  };
}
