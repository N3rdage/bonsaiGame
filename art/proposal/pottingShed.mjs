// Candidate 1, Potting Shed: pixel art, outlined and warm. 1:1 logical
// pixels, every form ringed by a 1 px outline in the darkest tone of its own
// material, three tones inside (shadow, mid, highlight), no dithering and no
// anti-aliasing. The palette grows ART_SPEC.md's 17 colours (kept at their
// values) with outline tones, a stone shadow and light, a cream for plaster
// and burlap, and a warm lamp light: 32 colours.

import { painter } from './pixelPainter.mjs';
import { drawShed } from './pixelScene.mjs';

export const slug = 'potting-shed';
export const name = 'Potting Shed';
export const nativePerLogical = 1;
export const smooth = false;

export const palette = [
  { name: 'night', rgb: [36, 30, 24] },
  { name: 'wood outline', rgb: [48, 30, 18] },
  { name: 'wood dark', rgb: [70, 45, 25] },
  { name: 'shed floor', rgb: [104, 76, 52] },
  { name: 'wood mid', rgb: [120, 85, 55] },
  { name: 'wood light', rgb: [160, 110, 70] },
  { name: 'sanded', rgb: [190, 140, 92] },
  { name: 'soil', rgb: [48, 34, 24] },
  { name: 'terracotta outline', rgb: [88, 46, 28] },
  { name: 'terracotta shadow', rgb: [120, 66, 40] },
  { name: 'terracotta', rgb: [150, 90, 55] },
  { name: 'terracotta light', rgb: [188, 122, 78] },
  { name: 'skin', rgb: [200, 150, 110] },
  { name: 'skin light', rgb: [226, 184, 144] },
  { name: 'brass', rgb: [170, 140, 70] },
  { name: 'lamp light', rgb: [250, 214, 140] },
  { name: 'cream shadow', rgb: [176, 156, 124] },
  { name: 'cream', rgb: [214, 198, 166] },
  { name: 'cream light', rgb: [238, 228, 204] },
  { name: 'slate outline', rgb: [46, 50, 58] },
  { name: 'stone dark', rgb: [90, 88, 85] },
  { name: 'slate', rgb: [116, 124, 134] },
  { name: 'stone grey', rgb: [160, 155, 150] },
  { name: 'stone light', rgb: [200, 197, 192] },
  { name: 'shirt outline', rgb: [38, 52, 84] },
  { name: 'shirt shadow', rgb: [58, 80, 124] },
  { name: 'player shirt', rgb: [80, 110, 160] },
  { name: 'glass', rgb: [104, 140, 148] },
  { name: 'celadon', rgb: [60, 110, 105] },
  { name: 'foliage dark', rgb: [45, 75, 40] },
  { name: 'foliage mid', rgb: [75, 120, 65] },
  { name: 'foliage light', rgb: [95, 140, 75] },
];

const c = Object.fromEntries(palette.map(({ name: n, rgb }) => [n, rgb]));
const mat = (o, s, m, h) => ({ o: c[o], s: c[s], m: c[m], h: c[h] });

const wood = mat('wood outline', 'wood dark', 'wood mid', 'wood light');
const MATERIALS = {
  wood,
  top: mat('wood outline', 'wood mid', 'wood light', 'sanded'),
  boards: mat('wood outline', 'wood dark', 'wood mid', 'wood light'),
  floor: mat('wood outline', 'wood dark', 'shed floor', 'wood mid'),
  cap: mat('wood outline', 'wood dark', 'wood mid', 'wood light'),
  plaster: mat('stone dark', 'cream shadow', 'cream', 'cream light'),
  stone: mat('slate outline', 'stone dark', 'stone grey', 'stone light'),
  metal: mat('slate outline', 'stone dark', 'slate', 'stone grey'),
  cream: mat('wood dark', 'cream shadow', 'cream', 'cream light'),
  foliage: mat('foliage dark', 'foliage dark', 'foliage mid', 'foliage light'),
  bark: mat('wood outline', 'wood dark', 'wood dark', 'wood mid'),
  terracotta: mat('terracotta outline', 'terracotta shadow', 'terracotta', 'terracotta light'),
  celadon: mat('slate outline', 'celadon', 'celadon', 'glass'),
  soil: mat('wood outline', 'soil', 'soil', 'wood dark'),
  shirt: mat('shirt outline', 'shirt shadow', 'player shirt', 'player shirt'),
  trousers: mat('wood outline', 'wood outline', 'wood dark', 'wood mid'),
  shoe: mat('wood outline', 'wood outline', 'wood outline', 'wood dark'),
  skin: mat('terracotta outline', 'skin', 'skin', 'skin light'),
  hair: mat('wood outline', 'wood outline', 'wood dark', 'wood dark'),
  brass: mat('wood outline', 'brass', 'brass', 'lamp light'),
  glass: mat('slate outline', 'celadon', 'glass', 'lamp light'),
  outside: mat('foliage dark', 'foliage dark', 'foliage mid', 'foliage light'),
  rug: mat('terracotta outline', 'terracotta shadow', 'terracotta shadow', 'terracotta'),
  rugEdge: mat('terracotta outline', 'cream shadow', 'cream', 'cream light'),
  lamp: c['lamp light'],
  dark: c['wood outline'],
};

/** Ground shadows step each floor and rug tone one darker. */
const SHADE = [
  [c['shed floor'], c['wood dark']],
  [c['wood mid'], c['shed floor']],
  [c['wood dark'], c['wood outline']],
  [c.cream, c['cream shadow']],
  [c['terracotta shadow'], c['terracotta outline']],
];

export const style = { outline: true, dither: false, plasterWall: false, lampGlow: null, shade: SHADE };
export const surround = c.night;
export const materials = MATERIALS;

/** Draws `scene` (scene.mjs) onto `canvas`, one canvas pixel per logical pixel. */
export function draw(canvas, scene) {
  drawShed(painter(canvas, style), MATERIALS, scene);
}
