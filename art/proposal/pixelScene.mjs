// The shed drawn in pixel art, shared by the two pixel candidates. Every shape
// goes through the painter (pixelPainter.mjs), so the candidate's style
// (outlined or not, rounded or not, dithered or not) and its materials decide
// the look; the forms and their placement are the scene's (scene.mjs).
//
// Materials a candidate supplies (each { o, s, m, h }): wood, top (sanded
// tops), boards (wall boards and door leaves), floor, cap, plaster, stone,
// metal, cream, foliage, bark, terracotta, celadon, soil, shirt, trousers,
// shoe, skin, hair, brass, glass, outside, rug, rugEdge; plus single colours
// lamp and dark.

import { seeded } from '../interiors/png.mjs';

/** A plain pot: a rim over a slightly narrower body. */
function pot(p, x, y, w, h, m) {
  p.box(x + 1, y + 1, w - 2, h - 1, m);
  p.box(x, y, w, 2, m);
}

function backWall(p, M, S) {
  const { x, y, w, h } = S.SHED.backWall;
  if (p.style.plasterWall) {
    p.rect(x, y, w, h, M.plaster.m);
    p.rect(x, y, w, 4, M.plaster.s);
    p.checker(x, y + 4, w, 4, M.plaster.s);
    p.checker(x + 1, y + 20, w, 1, M.plaster.h);
    p.rect(x, 28, w, 16, M.boards.m);
    for (let bx = x; bx < w; bx += 8) {
      p.rect(bx, 28, 1, 16, M.boards.h);
      p.rect(bx + 7, 28, 1, 16, M.boards.s);
    }
    p.box(x, 26, w, 3, M.top);
  } else {
    p.rect(x, y, w, h, M.boards.m);
    for (let bx = x; bx < w; bx += 8) {
      p.rect(bx, y, 1, h, M.boards.o);
      p.rect(bx + 1, y, 1, h, M.boards.h);
      p.rect(bx + 6, y, 1, h, M.boards.s);
    }
  }
  p.box(x, y, w, 4, M.wood);
  p.box(x, 44, w, 4, M.wood);
}

function window(p, M, S) {
  const { x, y, w, h } = S.SHED.window;
  p.box(x, y, w, h, M.wood);
  p.rect(x + 2, y + 2, w - 4, h - 4, M.glass.m);
  p.rect(x + 2, y + 2, w - 4, 3, M.glass.h);
  p.rect(x + 2, y + h - 5, w - 4, 3, M.glass.s);
  p.rect(x + 15, y + 2, 2, h - 4, M.wood.m);
  p.rect(x + 2, y + 11, w - 4, 2, M.wood.m);
  for (const [gx, gy] of [[x + 5, y + 8], [x + 21, y + 8], [x + 6, y + 20]]) {
    for (let i = 0; i < 3; i += 1) p.px(gx + i, gy - i, M.lamp);
  }
  p.box(x - 2, y + h - 2, w + 4, 4, M.top);
}

function shelfAndLantern(p, M, S) {
  const { x, y, w } = S.SHED.shelf;
  pot(p, x + 2, y + 4, 8, 8, M.terracotta);
  pot(p, x + 13, y + 5, 7, 7, M.celadon);
  p.ellipse(x + 16.5, y + 3, 4, 3, M.foliage);
  pot(p, x + 24, y + 7, 6, 5, M.terracotta);
  pot(p, x + 33, y + 6, 8, 6, M.terracotta);
  pot(p, x + 33, y + 3, 8, 4, M.terracotta);
  p.box(x, y + 11, w, 4, M.top);
  p.box(x + 3, y + 15, 2, 2, M.wood);
  p.box(x + w - 5, y + 15, 2, 2, M.wood);
  p.checker(62, 9, 13, 16, p.style.lampGlow);
  p.rect(68, 9, 1, 3, M.metal.s);
  p.box(65, 12, 7, 10, M.metal);
  p.rect(67, 14, 3, 6, M.lamp);
}

function northDoor(p, M, S) {
  const { x, y, w, h } = S.SHED.doorNorth;
  p.box(x, y, w, h, M.wood);
  p.box(x + 3, y + 3, w - 6, h - 3, M.boards);
  p.box(x + 6, y + 7, w - 12, 12, M.boards);
  p.box(x + 6, y + 23, w - 12, 13, M.boards);
  p.box(x + w - 7, y + 21, 3, 3, M.brass);
}

function floor(p, M, S) {
  const { x, y, w, h } = S.SHED.floor;
  const rnd = seeded(127);
  p.rect(x, y, w, h, M.floor.m);
  for (let row = 0; row < h / 8; row += 1) {
    const ry = y + row * 8;
    p.rect(x, ry + 7, w, 1, M.floor.s);
    p.rect(x, ry, w, 1, M.floor.h);
    for (let jx = x + Math.floor(rnd() * 24); jx < x + w; jx += 28 + Math.floor(rnd() * 20)) {
      p.rect(jx, ry, 1, 7, M.floor.s);
    }
  }
  if (p.style.dither) {
    p.checker(x, y, w, 3, M.floor.s);
    const pool = S.SHED.window;
    for (let ry = 0; ry < 22; ry += 1) p.checker(pool.x - 4 + Math.floor(ry / 2), 70 + ry, pool.w, 1, M.floor.h);
  }
}

function caps(p, M, S) {
  const { leftCap: l, rightCap: r, doorEast: d } = S.SHED;
  p.box(l.x, l.y, l.w, l.h, M.cap);
  p.box(r.x, r.y, r.w, r.h, M.cap);
  p.box(d.x, d.y, d.w, d.h, M.wood);
  p.rect(d.x + 2, d.y + 2, d.w - 4, 14, M.wood.s);
  p.rect(d.x + 2, d.y + 16, d.w - 4, d.h - 16, M.outside.m);
  for (let gy = d.y + 18; gy < d.y + d.h; gy += 4) p.px(d.x + 3 + (gy % 3), gy, M.outside.h);
}

function frontCap(p, M, S) {
  const { x, y, w, h } = S.SHED.frontCap;
  p.box(x, y, w, h, M.cap);
}

function doorLeaf(p, M, S) {
  const [hx, hy] = S.EAST_LEAF.hinge;
  const [fx, fy] = S.EAST_LEAF.free;
  p.shadow((hx + fx) / 2, (hy + fy) / 2 + 2, 9, 4);
  for (let x = fx; x < hx; x += 1) {
    const bottom = Math.round(fy + ((x - fx) * (hy - fy)) / (hx - fx));
    const top = bottom - S.EAST_LEAF.height + 1;
    for (let y = top; y <= bottom; y += 1) {
      let c = M.boards.m;
      const rail = y === top + 12 || y === top + 26;
      if (p.style.outline && (x === fx || x === hx - 1 || y === top || y === bottom)) c = M.boards.o;
      else if (x === fx || x === fx + 1 || y === top) c = M.boards.h;
      else if (rail || x === hx - 1) c = M.boards.s;
      p.px(x, y, c);
    }
  }
  p.box(fx + 2, fy - 22, 2, 3, M.brass);
}

function workbench(p, M, S) {
  p.shadow(40, 67, 27, 4);
  p.box(17, 46, 4, 22, M.wood);
  p.box(59, 46, 4, 22, M.wood);
  p.box(19, 58, 42, 3, M.wood);
  p.box(16, 28, 48, 20, M.top);
  p.box(16, 46, 48, 5, M.wood);
  pot(p, 21, 34, 8, 7, M.terracotta);
  p.ellipse(25, 32, 4, 3, M.foliage);
  p.box(33, 39, 10, 2, M.metal);
  p.box(43, 39, 5, 2, M.wood);
  p.box(51, 31, 9, 7, M.metal);
  p.box(49, 33, 2, 2, M.metal);
}

function plantingTable(p, M, S) {
  p.shadow(124, 67, 23, 4);
  p.box(105, 46, 4, 22, M.wood);
  p.box(139, 46, 4, 22, M.wood);
  p.box(104, 28, 40, 20, M.top);
  p.box(107, 31, 34, 13, M.soil);
  for (let sy = 34; sy < 42; sy += 5) {
    for (let sx = 110; sx < 140; sx += 6) {
      p.px(sx, sy, M.foliage.h);
      p.px(sx + 1, sy, M.foliage.m);
      p.px(sx, sy + 1, M.foliage.s);
    }
  }
  p.box(104, 46, 40, 5, M.wood);
}

function kiosk(p, M, S) {
  p.shadow(28, 115, 22, 4);
  p.box(8, 92, 40, 24, M.wood);
  for (const sx of [20, 34]) p.rect(sx, 95, 1, 18, M.wood.s);
  p.box(17, 99, 22, 8, M.cream);
  p.ellipse(28, 103, 3, 2, M.foliage);
  p.box(8, 72, 40, 21, M.top);
  p.box(12, 76, 7, 9, M.shirt);
  p.box(20, 77, 7, 9, M.terracotta);
  p.box(28, 76, 7, 9, M.foliage);
  p.box(37, 78, 8, 8, M.metal);
  p.box(39, 75, 3, 3, M.brass);
}

function bonsai(p, M, S) {
  const { cx, base } = S.BONSAI;
  pot(p, cx - 5, base - 4, 10, 5, M.terracotta);
  for (const [tx, ty] of [[0, -5], [0, -6], [-1, -7], [-1, -8], [0, -9], [1, -10], [1, -11]]) {
    p.px(cx + tx - 1, base + ty, M.bark.h);
    p.px(cx + tx, base + ty, M.bark.m);
  }
  p.px(cx - 3, base - 10, M.bark.m);
  p.ellipse(cx - 4, base - 11, 4, 2.5, M.foliage);
  p.ellipse(cx + 3.5, base - 13, 4.5, 3, M.foliage);
  p.ellipse(cx, base - 16, 4, 2.5, M.foliage);
}

function pedestal(p, M, S) {
  p.shadow(128, 115, 10, 3);
  p.box(120, 110, 16, 6, M.stone);
  p.box(123, 94, 10, 17, M.stone);
  p.box(120, 84, 16, 11, M.stone);
  bonsai(p, M, S);
}

function avatar(p, M, S) {
  p.shadow(104, 115, 7, 2.5);
  p.box(100, 104, 4, 10, M.trousers);
  p.box(104, 104, 4, 10, M.trousers);
  p.box(99, 112, 5, 4, M.shoe);
  p.box(104, 112, 6, 4, M.shoe);
  p.box(99, 94, 10, 12, M.shirt);
  p.box(103, 96, 4, 9, M.shirt);
  p.box(103, 104, 4, 3, M.skin);
  p.box(99, 85, 10, 10, M.skin);
  p.box(98, 84, 10, 5, M.hair);
  p.box(98, 84, 4, 8, M.hair);
  p.px(106, 89, M.dark);
  p.px(106, 88, M.dark);
  p.px(109, 90, M.skin.m);
  p.px(102, 90, M.skin.s);
}

function wateringCan(p, M, S) {
  p.shadow(61, 121, 7, 2);
  p.box(56, 113, 8, 9, M.metal);
  for (let i = 0; i < 5; i += 1) {
    p.px(63 + i, 117 - i, M.metal.o ?? M.metal.s);
    p.px(63 + i, 118 - i, M.metal.m);
  }
  p.box(67, 111, 3, 3, M.metal);
  p.rect(57, 110, 6, 1, M.metal.s);
  p.rect(56, 111, 1, 2, M.metal.s);
  p.rect(63, 111, 1, 2, M.metal.s);
}

function sack(p, M, S) {
  p.shadow(140, 141, 8, 2.5);
  p.ellipse(140, 134, 7, 8, M.cream);
  p.box(137, 124, 6, 5, M.cream);
  p.rect(137, 128, 6, 1, M.brass.m);
  p.rect(134, 133, 4, 1, M.cream.s);
}

function potStack(p, M, S) {
  p.shadow(144, 99, 7, 2);
  p.box(140, 88, 8, 12, M.terracotta);
  for (const ry of [84, 88, 92]) p.box(138, ry, 12, 3, M.terracotta);
}

function rug(p, M, S, o) {
  const { x, y, w, h } = o.sprite;
  p.box(x, y, w, h, M.rugEdge);
  p.box(x + 2, y + 2, w - 4, h - 4, M.rug);
  for (const sy of [y + 8, y + h - 9]) p.rect(x + 4, sy, w - 8, 1, M.rugEdge.h);
}

const DRAW = { rug, workbench, plantingTable, kiosk, pedestal, avatar, wateringCan, sack, potStack, doorLeaf };

/** Draws the whole shed of scene `S` (scene.mjs) with painter `p` in materials `M`. */
export function drawShed(p, M, S) {
  floor(p, M, S);
  backWall(p, M, S);
  window(p, M, S);
  shelfAndLantern(p, M, S);
  northDoor(p, M, S);
  caps(p, M, S);
  for (const o of S.sorted()) DRAW[o.kind](p, M, S, o);
  frontCap(p, M, S);
}

/** The bookcase from the scale table (not in the shed), standing on `floorY` at `x`: 40 x 56. */
export function bookcase(p, M, x, floorY) {
  const top = floorY - 56;
  p.shadow(x + 20, floorY, 22, 3);
  p.box(x, top, 40, 56, M.wood);
  p.box(x, top, 40, 12, M.top);
  const books = [M.shirt, M.terracotta, M.foliage, M.cream, M.celadon];
  for (let shelf = 0; shelf < 3; shelf += 1) {
    const sy = top + 14 + shelf * 14;
    p.rect(x + 3, sy, 34, 12, M.wood.s);
    for (let bx = x + 4, i = shelf; bx < x + 34; bx += 5, i += 1) p.box(bx, sy + 2 + (i % 2), 4, 10 - (i % 2), books[i % books.length]);
  }
}

export const PIECES = { workbench, pedestal, avatar, northDoor };
