// The compositor: an RGBA canvas, nearest-neighbour and bilinear scaling,
// alpha blitting, the S22 Ultra landscape frame and the palette strip, and
// the PNG writer. Every output image of the proposal passes through here.

import { writeFileSync } from 'node:fs';
import pngjs from 'pngjs';

const { PNG } = pngjs;

/** The S22 Ultra's landscape device pixels and the game's 16:9 canvas inside them. */
export const S22 = { width: 2318, height: 1080, gameWidth: 1920, zoom: 5 };
/** The letterbox colour either side of the game canvas, sampled from docs/screenshots/s22-ultra/r4d-4a-shed-landscape.png. */
export const LETTERBOX = [29, 42, 28];

export function createCanvas(width, height, fill) {
  const canvas = { width, height, data: new Uint8ClampedArray(width * height * 4) };
  if (fill) fillRect(canvas, 0, 0, width, height, fill);
  return canvas;
}

export function getPixel(canvas, x, y) {
  const i = (y * canvas.width + x) * 4;
  const d = canvas.data;
  return [d[i], d[i + 1], d[i + 2], d[i + 3]];
}

/** Sets one opaque pixel; anything off the canvas or a null colour is skipped. */
export function setPixel(canvas, x, y, c) {
  if (!c || x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const i = (y * canvas.width + x) * 4;
  canvas.data[i] = c[0];
  canvas.data[i + 1] = c[1];
  canvas.data[i + 2] = c[2];
  canvas.data[i + 3] = 255;
}

export function fillRect(canvas, x, y, w, h, c) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) setPixel(canvas, xx, yy, c);
  }
}

/** Draws `src` over `dst` at (dx, dy), blending by the source alpha. */
export function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y += 1) {
    const ty = y + dy;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width; x += 1) {
      const tx = x + dx;
      if (tx < 0 || tx >= dst.width) continue;
      const s = (y * src.width + x) * 4;
      const a = src.data[s + 3] / 255;
      if (a === 0) continue;
      const t = (ty * dst.width + tx) * 4;
      for (let k = 0; k < 3; k += 1) {
        dst.data[t + k] = Math.round(src.data[s + k] * a + dst.data[t + k] * (1 - a));
      }
      dst.data[t + 3] = 255;
    }
  }
}

/** Scales by a whole factor, each pixel becoming a k x k block: crisp pixel art. */
export function scaleNearest(src, k) {
  const out = createCanvas(src.width * k, src.height * k);
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const s = (Math.floor(y / k) * src.width + Math.floor(x / k)) * 4;
      const t = (y * out.width + x) * 4;
      for (let c = 0; c < 4; c += 1) out.data[t + c] = src.data[s + c];
    }
  }
  return out;
}

/** Scales to width x height by bilinear interpolation between pixel centres. */
export function scaleBilinear(src, width, height) {
  const out = createCanvas(width, height);
  const sx = src.width / width;
  const sy = src.height / height;
  const at = (x, y, c) => src.data[(y * src.width + x) * 4 + c];
  for (let y = 0; y < height; y += 1) {
    const fy = Math.min(Math.max((y + 0.5) * sy - 0.5, 0), src.height - 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, src.height - 1);
    const wy = fy - y0;
    for (let x = 0; x < width; x += 1) {
      const fx = Math.min(Math.max((x + 0.5) * sx - 0.5, 0), src.width - 1);
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, src.width - 1);
      const wx = fx - x0;
      const t = (y * width + x) * 4;
      for (let c = 0; c < 4; c += 1) {
        const top = at(x0, y0, c) * (1 - wx) + at(x1, y0, c) * wx;
        const bottom = at(x0, y1, c) * (1 - wx) + at(x1, y1, c) * wx;
        out.data[t + c] = Math.round(top * (1 - wy) + bottom * wy);
      }
    }
  }
  return out;
}

/**
 * Scales a candidate's native render so one logical pixel becomes `perLogical`
 * device pixels: nearest-neighbour for pixel art, bilinear for the inked art.
 */
export function toDevice(image, nativePerLogical, perLogical, smooth) {
  if (!smooth) return scaleNearest(image, perLogical / nativePerLogical);
  const k = perLogical / nativePerLogical;
  return scaleBilinear(image, Math.round(image.width * k), Math.round(image.height * k));
}

/** The phone frame: letterbox, the game canvas filled with the room's surround, the shed centred. */
export function s22Frame(shed, surround) {
  const frame = createCanvas(S22.width, S22.height, LETTERBOX);
  const gameX = (S22.width - S22.gameWidth) / 2;
  fillRect(frame, gameX, 0, S22.gameWidth, S22.height, surround);
  blit(frame, shed, gameX + (S22.gameWidth - shed.width) / 2, (S22.height - shed.height) / 2);
  return frame;
}

/** One 32 px swatch per palette colour, in order, in a single row. */
export function paletteStrip(palette) {
  const size = 32;
  const strip = createCanvas(size * palette.length, size);
  palette.forEach(({ rgb }, i) => fillRect(strip, i * size, 0, size, size, rgb));
  return strip;
}

export function writePng(path, canvas) {
  const png = new PNG({ width: canvas.width, height: canvas.height });
  png.data.set(canvas.data);
  writeFileSync(path, PNG.sync.write(png));
}
