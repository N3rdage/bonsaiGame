// Drawing shared by more than one room's sheets.

import { WOOD_DARK, WOOD_LIGHT, WOOD_MID } from './palette.mjs';
import { SIZE, setPixel } from './png.mjs';

/** The skirting board on the bottom 6 rows, shared by every wall. */
export function skirting(png) {
  for (let x = 0; x < SIZE; x += 1) {
    setPixel(png, x, 26, WOOD_LIGHT);
    for (let y = 27; y < 31; y += 1) setPixel(png, x, y, WOOD_MID);
    setPixel(png, x, 31, WOOD_DARK);
  }
}
