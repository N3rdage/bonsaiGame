// The scale-rule diagram, in Potting Shed's style at 4 device px per logical
// px: the avatar, the north door, the workbench, the pedestal with the
// starter bonsai and a bookcase standing on one floor line in front of a
// plaster wall, a tile ruler along the floor, and beside each a thin bracket
// of its real height (floor to the top of its front face, a tick per tile),
// labelled in metres in a 3x5 digit font. Above furniture a thinner bracket
// marks the top face's depth, which the drawn sprite adds to its height. The
// bonsai's own bracket is terracotta: it is drawn at hero scale.

import { blit, createCanvas, crop, fillRect, scaleNearest } from './canvas.mjs';
import { painter } from './pixelPainter.mjs';
import { bookcase, PIECES } from './pixelScene.mjs';
import * as pottingShed from './pottingShed.mjs';
import { SIZES, TILE } from './scale.mjs';

const ZOOM = 4;
const WIDTH = 260;
const HEIGHT = 88;
const FLOOR_Y = 72;

const GLYPHS = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  7: ['111', '001', '010', '010', '010'],
  9: ['111', '101', '111', '001', '111'],
  '.': ['000', '000', '000', '000', '010'],
};

/** The pieces taken from the shed: their sprite rect in the scene, where they stand in the diagram and their scale-rule entry. */
const LINE_UP = [
  { piece: 'avatar', crop: [96, 84, 16, 32], x: 20, size: 'avatar' },
  { piece: 'northDoor', crop: [76, 8, 24, 40], x: 52, size: 'doorNorth' },
  { piece: 'workbench', crop: [16, 28, 48, 40], x: 96, size: 'workbench', topFace: true },
  { piece: 'pedestal', crop: [120, 70, 16, 46], x: 164, size: 'pedestal', topFace: true },
];
const BOOKCASE = { x: 204, size: 'bookcase', topFace: true };

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

/** A vertical bracket at logical x from `bottom` up `height` logical px, a tick per tile. */
function bracket(canvas, x, bottom, height, c) {
  const X = x * ZOOM;
  const top = (bottom - height) * ZOOM;
  fillRect(canvas, X, top, 2, height * ZOOM, c);
  fillRect(canvas, X - 6, top, 14, 2, c);
  fillRect(canvas, X - 6, bottom * ZOOM - 2, 14, 2, c);
  for (let t = TILE; t < height; t += TILE) fillRect(canvas, X - 4, (bottom - t) * ZOOM, 6, 2, c);
}

/** A piece's real-height bracket, the thinner top-face bracket above it, and its height in metres. */
function measure(canvas, x, { size, topFace }, c) {
  const { real, footprint, sprite } = SIZES[size];
  const top = topFace ? footprint[1] : 0;
  bracket(canvas, x, FLOOR_Y, sprite[1] - top, c);
  const X = x * ZOOM;
  const spriteTop = (FLOOR_Y - sprite[1]) * ZOOM;
  if (top) {
    fillRect(canvas, X, spriteTop, 1, top * ZOOM, c);
    fillRect(canvas, X - 4, spriteTop, 9, 1, c);
  }
  text(canvas, real[2].toFixed(1), X + 1, spriteTop - 16, c);
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
  for (const piece of LINE_UP) measure(out, piece.x - 5, piece, ink);
  const pedestal = LINE_UP[3];
  bracket(out, pedestal.x + 20, FLOOR_Y - 25, 19, M.terracotta.m);
  measure(out, BOOKCASE.x - 5, BOOKCASE, ink);
  return out;
}
