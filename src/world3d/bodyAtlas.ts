/**
 * Dresses the player's body: recolours the swatch cells of the Rogue's atlas
 * (`rogue_texture.png`, a grid of vertical gradients the body's UVs sample) to
 * the look's `BODY_PALETTE`. Pure over RGBA bytes, so it is unit-tested in
 * Node; `renderer.ts` runs it on the decoded image before it becomes a texture.
 */

import { BODY_ATLAS, BODY_PALETTE } from './look';

/** A pixel's brightness, 0..255, by the Rec. 709 weights. */
function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Recolours `rgba` (a `width` x `height` RGBA image laid out as BODY_ATLAS's
 * grid) in place. Each palette cell keeps its gradient's shape: a pixel's place
 * between the cell's darkest and lightest luminance picks the same place
 * between the part's dark and light colours. Cells outside the palette and the
 * alpha channel are untouched.
 */
export function dressAtlas(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): void {
  const cellWidth = width / BODY_ATLAS.columns;
  const cellHeight = height / BODY_ATLAS.rows;
  for (const { cell, light, dark } of Object.values(BODY_PALETTE)) {
    const x0 = cell[0] * cellWidth;
    const y0 = cell[1] * cellHeight;
    let low = 255;
    let high = 0;
    for (let y = y0; y < y0 + cellHeight; y++) {
      for (let x = x0; x < x0 + cellWidth; x++) {
        const i = (y * width + x) * 4;
        const l = luminance(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0);
        low = Math.min(low, l);
        high = Math.max(high, l);
      }
    }
    const span = high - low;
    for (let y = y0; y < y0 + cellHeight; y++) {
      for (let x = x0; x < x0 + cellWidth; x++) {
        const i = (y * width + x) * 4;
        const l = luminance(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0);
        const t = span > 0 ? (l - low) / span : 1;
        for (let c = 0; c < 3; c++) {
          const shift = 16 - 8 * c;
          const from = (dark >> shift) & 255;
          const to = (light >> shift) & 255;
          rgba[i + c] = Math.round(from + (to - from) * t);
        }
      }
    }
  }
}
