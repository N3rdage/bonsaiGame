// The glazed openings: the window and the study's glass doors.
//
// spr_window.png: one 32x32 frame, a four-pane window with a sill, transparent
// round it so it can be drawn over any room's top wall.
// spr_door_glass.png: the study's glazed double door, 64x32, two leaves of
// four panes each in a wooden frame, a brass handle on each meeting stile.
// spr_door_glass_single.png: one such leaf, 32x32, the garden's door back to
// the study.

import {
  BRASS,
  BRASS_DARK,
  GLASS,
  GLASS_DARK,
  GLASS_LIGHT,
  WOOD_DARK,
  WOOD_LIGHT,
  WOOD_MID,
} from './palette.mjs';
import { SIZE, fill, seeded, setPixel } from './png.mjs';

/**
 * The window, drawn over a top wall tile: transparent round it, so the room's
 * own wall (and its skirting board) shows at the edges. A dark-edged wooden
 * frame, four panes of glass split by a mullion and a transom, lighter towards
 * the top with a diagonal glint, and a sill across the bottom.
 */
function windowPane(png) {
  for (let y = 2; y <= 21; y += 1) {
    for (let x = 3; x <= 28; x += 1) {
      let c = WOOD_MID;
      if (x === 3 || x === 28 || y === 2) c = WOOD_DARK;
      else if (
        x >= 6 &&
        x <= 25 &&
        y >= 5 &&
        y <= 21 &&
        x !== 15 &&
        x !== 16 &&
        y !== 12 &&
        y !== 13
      ) {
        c = y < 9 ? GLASS_LIGHT : GLASS;
        if ((x + y) % 11 === 0 || (x + y) % 11 === 1) c = GLASS_LIGHT;
        if (y >= 19) c = GLASS_DARK;
      }
      setPixel(png, x, y, c);
    }
  }
  const rng = seeded(1000);
  for (let i = 0; i < 6; i += 1) {
    setPixel(png, 6 + Math.floor(rng() * 9), 14 + Math.floor(rng() * 5), GLASS_LIGHT);
  }
  for (let x = 2; x <= 29; x += 1) {
    setPixel(png, x, 22, WOOD_LIGHT);
    setPixel(png, x, 23, WOOD_DARK);
  }
}

/**
 * One glazed door leaf, 32x32 from column `ox`: a dark outline round a wooden
 * frame, four panes of glass split by a mullion and a transom (lighter at the
 * top, a diagonal glint, darker at the foot), a kick rail along the bottom and
 * a brass handle on its right or left stile. Its top row and outer column are
 * left transparent, so the wall shows round the door.
 */
function glassLeaf(png, ox, handleRight) {
  for (let y = 1; y < SIZE; y += 1) {
    for (let x = 1; x < SIZE - 1; x += 1) {
      const glass = x >= 5 && x <= 26 && y >= 5 && y <= 25 && x !== 15 && x !== 16 && y !== 15;
      let c = WOOD_MID;
      if (x === 1 || x === SIZE - 2 || y === 1 || y === SIZE - 1) c = WOOD_DARK;
      else if (y === 2 || y === 26) c = WOOD_LIGHT;
      else if (glass) {
        c = y < 9 ? GLASS_LIGHT : GLASS;
        if ((x + y) % 9 === 0) c = GLASS_LIGHT;
        if (y >= 23 || y === 13 || y === 14) c = GLASS_DARK;
      }
      setPixel(png, ox + x, y, c);
    }
  }
  const hx = handleRight ? 28 : 2;
  fill(png, ox + hx, 15, ox + hx + 1, 18, BRASS);
  fill(png, ox + hx, 18, ox + hx + 1, 18, BRASS_DARK);
}

export const WINDOW = { name: 'spr_window', width: SIZE, height: SIZE, draw: windowPane };

export const DOUBLE_DOOR = {
  name: 'spr_door_glass',
  width: SIZE * 2,
  height: SIZE,
  draw(png) {
    glassLeaf(png, 0, true);
    glassLeaf(png, SIZE, false);
    fill(png, SIZE - 1, 1, SIZE, SIZE - 1, WOOD_DARK);
  },
};

export const SINGLE_DOOR = {
  name: 'spr_door_glass_single',
  width: SIZE,
  height: SIZE,
  draw(png) {
    glassLeaf(png, 0, false);
  },
};
