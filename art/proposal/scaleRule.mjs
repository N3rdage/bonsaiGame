// The scale-rule diagram, in Potting Shed's style at 4 device px per logical
// px: the avatar, the north door, the workbench, the pedestal with the
// starter bonsai and a bookcase standing on one floor line in front of a
// plaster wall, a tile ruler along the floor, and beside each a thin bracket
// with a tick per tile and its height in tiles in a 3x5 digit font. The
// bonsai's own bracket is terracotta: it is drawn at hero scale.

import { blit, createCanvas, fillRect, scaleNearest } from './canvas.mjs';
import { painter } from './pixelPainter.mjs';
import { bookcase, PIECES } from './pixelScene.mjs';
import * as pottingShed from './pottingShed.mjs';
import { TILE } from './scale.mjs';

const ZOOM = 4;
const WIDTH = 260;
const HEIGHT = 88;
const FLOOR_Y = 72;

const GLYPHS = {
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  5: ['111', '100', '111', '001', '111'],
  '.': ['000', '000', '000', '000', '010'],
};

/** The pieces taken from the shed: their sprite rect in the scene and where they stand in the diagram. */
const LINE_UP = [
  { piece: 'avatar', crop: [96, 84, 16, 32], x: 20, tiles: '2' },
  { piece: 'northDoor', crop: [76, 8, 24, 40], x: 52, tiles: '2.5' },
  { piece: 'workbench', crop: [16, 28, 48, 40], x: 96, tiles: '2.5' },
  { piece: 'pedestal', crop: [120, 70, 16, 46], x: 164, tiles: '2', bracket: 32 },
];
const BOOKCASE = { x: 204, tiles: '3.5', height: 56 };

function crop(src, [x, y, w, h]) {
  const out = createCanvas(w, h);
  for (let yy = 0; yy < h; yy += 1) {
    const from = ((y + yy) * src.width + x) * 4;
    out.data.set(src.data.subarray(from, from + w * 4), yy * w * 4);
  }
  return out;
}

function text(canvas, s, cx, y, c) {
  const scale = 2;
  const width = s.length * 4 * scale - scale;
  let x = Math.round(cx - width / 2);
  for (const ch of s) {
    GLYPHS[ch].forEach((row, gy) => {
      [...row].forEach((on, gx) => {
        if (on === '1') fillRect(canvas, x + gx * scale, y + gy * scale, scale, scale, c);
      });
    });
    x += 4 * scale;
  }
}

/** A vertical bracket at logical x from the floor up `height` logical px, a tick per tile. */
function bracket(canvas, x, bottom, height, c, label) {
  const X = x * ZOOM;
  const top = (bottom - height) * ZOOM;
  fillRect(canvas, X, top, 2, height * ZOOM, c);
  fillRect(canvas, X - 6, top, 14, 2, c);
  fillRect(canvas, X - 6, bottom * ZOOM - 2, 14, 2, c);
  for (let t = TILE; t < height; t += TILE) fillRect(canvas, X - 4, (bottom - t) * ZOOM, 6, 2, c);
  if (label) text(canvas, label, X + 1, top - 16, c);
}

export function render(scene) {
  const M = pottingShed.materials;
  const room = createCanvas(scene.SHED.width, scene.SHED.height);
  const roomPainter = painter(room, pottingShed.style);
  for (const { piece } of LINE_UP) PIECES[piece](roomPainter, M, scene);

  const diagram = createCanvas(WIDTH, HEIGHT, M.plaster.m);
  const p = painter(diagram, pottingShed.style);
  p.rect(0, FLOOR_Y, WIDTH, HEIGHT - FLOOR_Y, M.floor.m);
  p.rect(0, FLOOR_Y, WIDTH, 1, M.wood.o);
  for (let x = 0; x < WIDTH; x += TILE) p.rect(x, FLOOR_Y + 1, 1, x % (TILE * 2) === 0 ? 6 : 3, M.wood.o);
  for (const { crop: [, , w], x } of LINE_UP) p.shadow(x + w / 2, FLOOR_Y, w / 2 + 3, 3);
  for (const { crop: rect, x } of LINE_UP) blit(diagram, crop(room, rect), x, FLOOR_Y - rect[3]);
  bookcase(p, M, BOOKCASE.x, FLOOR_Y);

  const out = scaleNearest(diagram, ZOOM);
  const ink = M.wood.o;
  for (const { crop: [, , , h], x, tiles, bracket: b } of LINE_UP) bracket(out, x - 5, FLOOR_Y, b ?? h, ink, tiles);
  const pedestal = LINE_UP[3];
  bracket(out, pedestal.x + 20, FLOOR_Y - 25, 19, M.terracotta.m);
  bracket(out, BOOKCASE.x - 5, FLOOR_Y, BOOKCASE.height, ink, BOOKCASE.tiles);
  return out;
}
