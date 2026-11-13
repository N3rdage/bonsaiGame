// Candidate 2, Soft Linen: pixel art with no outlines, pastel and high-key.
// 1:1 logical pixels; forms read by value steps alone, the lightest tone on
// the top row and left column of each form and the darkest on the bottom row
// and right column; corners rounded off; a 2x2 checker dither only inside the
// large flat areas (the floor's window light and wall foot, the plaster
// wall's ceiling shade and the lamp's glow). Sage, oatmeal, dusty rose, slate
// blue and warm grey: 24 colours.

import { painter } from './pixelPainter.mjs';
import { drawShed } from './pixelScene.mjs';

export const slug = 'soft-linen';
export const name = 'Soft Linen';
export const nativePerLogical = 1;
export const smooth = false;

export const palette = [
  { name: 'dusk', rgb: [78, 72, 80] },
  { name: 'umber', rgb: [104, 88, 84] },
  { name: 'warm grey shadow', rgb: [150, 138, 132] },
  { name: 'warm grey', rgb: [178, 168, 160] },
  { name: 'warm grey light', rgb: [204, 196, 188] },
  { name: 'linen', rgb: [238, 230, 216] },
  { name: 'oatmeal shadow', rgb: [196, 176, 150] },
  { name: 'oatmeal', rgb: [218, 202, 178] },
  { name: 'oatmeal light', rgb: [234, 222, 200] },
  { name: 'birch shadow', rgb: [168, 132, 106] },
  { name: 'birch', rgb: [196, 162, 128] },
  { name: 'birch light', rgb: [220, 192, 158] },
  { name: 'rose shadow', rgb: [168, 116, 112] },
  { name: 'dusty rose', rgb: [200, 146, 136] },
  { name: 'rose light', rgb: [226, 180, 168] },
  { name: 'sage shadow', rgb: [116, 142, 112] },
  { name: 'sage', rgb: [148, 172, 136] },
  { name: 'sage light', rgb: [182, 202, 164] },
  { name: 'slate shadow', rgb: [96, 112, 140] },
  { name: 'slate blue', rgb: [128, 148, 176] },
  { name: 'slate light', rgb: [168, 186, 206] },
  { name: 'skin shadow', rgb: [216, 168, 144] },
  { name: 'skin', rgb: [240, 204, 178] },
  { name: 'lamp', rgb: [252, 238, 204] },
];

const c = Object.fromEntries(palette.map(({ name: n, rgb }) => [n, rgb]));
const mat = (s, m, h) => ({ s: c[s], m: c[m], h: c[h] });

const birch = mat('birch shadow', 'birch', 'birch light');
const MATERIALS = {
  wood: birch,
  top: mat('birch', 'birch light', 'oatmeal light'),
  boards: mat('birch shadow', 'birch', 'birch light'),
  floor: mat('oatmeal shadow', 'oatmeal', 'oatmeal light'),
  cap: mat('warm grey shadow', 'warm grey', 'warm grey light'),
  plaster: mat('warm grey light', 'linen', 'lamp'),
  stone: mat('warm grey shadow', 'warm grey light', 'linen'),
  metal: mat('slate shadow', 'slate blue', 'slate light'),
  cream: mat('warm grey shadow', 'warm grey light', 'linen'),
  foliage: mat('sage shadow', 'sage', 'sage light'),
  bark: mat('umber', 'umber', 'birch shadow'),
  terracotta: mat('rose shadow', 'dusty rose', 'rose light'),
  celadon: mat('sage shadow', 'sage', 'sage light'),
  soil: mat('umber', 'birch shadow', 'birch shadow'),
  shirt: mat('slate shadow', 'slate blue', 'slate light'),
  trousers: mat('umber', 'warm grey shadow', 'warm grey'),
  shoe: mat('dusk', 'umber', 'umber'),
  skin: mat('skin shadow', 'skin', 'skin'),
  hair: mat('dusk', 'umber', 'umber'),
  brass: mat('birch shadow', 'oatmeal shadow', 'lamp'),
  glass: mat('slate blue', 'slate light', 'lamp'),
  outside: mat('sage shadow', 'sage', 'sage light'),
  rug: mat('rose shadow', 'dusty rose', 'rose light'),
  rugEdge: mat('rose light', 'linen', 'linen'),
  lamp: c.lamp,
  dark: c.dusk,
};

const SHADE = [
  [c.oatmeal, c['oatmeal shadow']],
  [c['oatmeal light'], c.oatmeal],
  [c['oatmeal shadow'], c['warm grey shadow']],
  [c['dusty rose'], c['rose shadow']],
  [c['rose light'], c['dusty rose']],
  [c.linen, c['warm grey light']],
];

export const style = { outline: false, dither: true, plasterWall: true, lampGlow: c.lamp, shade: SHADE };
export const surround = c.dusk;

/** Draws `scene` (scene.mjs) onto `canvas`, one canvas pixel per logical pixel. */
export function draw(canvas, scene) {
  drawShed(painter(canvas, style), MATERIALS, scene);
}
