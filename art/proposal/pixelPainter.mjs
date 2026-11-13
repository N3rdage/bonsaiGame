// The pixel candidates' drawing primitives, at 1:1 logical pixels with hard
// edges. A material is { o, s, m, h }: outline, shadow, mid and highlight.
// The style decides how a form reads:
//   outline: true  -> a 1 px border in the material's own outline tone, the
//                     highlight on the top row and the shadow on the bottom
//                     row and right column (Potting Shed);
//   outline: false -> no border, highlight on the top row and left column,
//                     shadow on the bottom row and right column, corners
//                     rounded off (Soft Linen).
// `shade` maps a colour to its darker neighbour in the palette, for ground
// shadows that stay inside the palette.

import { getPixel, setPixel } from './canvas.mjs';

const key = (c) => `${String(c[0])},${String(c[1])},${String(c[2])}`;

export function painter(canvas, style) {
  const shadeMap = new Map(style.shade.map(([from, to]) => [key(from), to]));

  const px = (x, y, c) => setPixel(canvas, x, y, c);
  const rect = (x, y, w, h, c) => {
    for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) px(xx, yy, c);
  };

  /** A rectangular form in material `m`. */
  const box = (x, y, w, h, m) => {
    const round = !style.outline && w >= 4 && h >= 4;
    for (let yy = 0; yy < h; yy += 1) {
      for (let xx = 0; xx < w; xx += 1) {
        const edgeX = xx === 0 || xx === w - 1;
        const edgeY = yy === 0 || yy === h - 1;
        if (round && edgeX && edgeY) continue;
        let c = m.m;
        if (style.outline) {
          if (edgeX || edgeY) c = m.o;
          else if (yy === 1) c = m.h;
          else if (yy === h - 2 || xx === w - 2) c = m.s;
        } else if (yy === 0 || xx === 0) c = m.h;
        else if (yy === h - 1 || xx === w - 1) c = m.s;
        px(x + xx, y + yy, c);
      }
    }
  };

  const inEllipse = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;

  /** An elliptical form, lit from the upper left. */
  const ellipse = (cx, cy, rx, ry, m) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        if (!inEllipse(x, y, cx, cy, rx, ry)) continue;
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inEllipse(x + dx, y + dy, cx, cy, rx, ry));
        const u = (x + 0.5 - cx) / rx;
        const v = (y + 0.5 - cy) / ry;
        let c = m.m;
        if (style.outline && edge) c = m.o;
        else if (u + v < -0.7) c = m.h;
        else if (u + v > 0.6) c = m.s;
        px(x, y, c);
      }
    }
  };

  /** A soft ground shadow: every pixel inside the ellipse steps one tone darker. */
  const shadow = (cx, cy, rx, ry) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
        if (!inEllipse(x, y, cx, cy, rx, ry)) continue;
        const to = shadeMap.get(key(getPixel(canvas, x, y)));
        if (to) px(x, y, to);
      }
    }
  };

  /** A 2x2 checker of colour `c` over a rectangle: the only dither, for large flat areas. */
  const checker = (x, y, w, h, c) => {
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) if ((xx + yy) % 2 === 0) px(xx, yy, c);
    }
  };

  return { canvas, style, px, rect, box, ellipse, shadow, checker };
}
