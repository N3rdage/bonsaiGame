/**
 * Pot colours by tier, the one table the 3D pot and the 2D tree sprite share,
 * after `pot_palette` in archive/gamemaker/scripts/scr_growth/scr_growth.gml.
 * Standard is terracotta; fancy is glazed celadon. Every colour is an Inked
 * wash, the `WASHES` entry in art/inked/style.mjs named beside it.
 * `bodyLine`/`rimLine` outline the 2D pot; the 3D pot uses `bodyLine` as its
 * dark base gradient.
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

/** Soil surface colour: `soil`. */
export const SOIL_RGB: Rgb = { r: 120, g: 96, b: 78 };

const rgb = (r: number, g: number, b: number): Rgb => ({ r, g, b });

export function potPalette(tier: PotTier): PotPalette {
  if (tier === 1) {
    return {
      body: rgb(132, 176, 156), // celadon
      bodyLine: rgb(74, 114, 104), // celadonShade
      rim: rgb(162, 200, 180), // celadonRim
      rimLine: rgb(74, 114, 104), // celadonShade
      disc: rgb(74, 114, 104), // celadonShade
      highlight: rgb(222, 238, 226), // celadonSheen
    };
  }
  return {
    body: rgb(204, 112, 74), // terracotta
    bodyLine: rgb(128, 68, 46), // terracottaShade
    rim: rgb(220, 136, 96), // terracottaRim
    rimLine: rgb(128, 68, 46), // terracottaShade
    disc: rgb(128, 68, 46), // terracottaShade
  };
}
