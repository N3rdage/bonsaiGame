// The PNG writer: an RGBA canvas ({ width, height, data }, as `finish` and
// `finishCutOut` return it) written to `path` with `pngjs`, and `joinStrip`,
// which lays finished canvases of one height side by side as a sheet's frames.

import { writeFileSync } from 'node:fs';
import pngjs from 'pngjs';

const { PNG } = pngjs;

export function writePng(path, canvas) {
  const png = new PNG({ width: canvas.width, height: canvas.height });
  png.data.set(canvas.data);
  writeFileSync(path, PNG.sync.write(png));
}

/** Finished canvases of one height, left to right, as one canvas: a sheet's frames from pages drawn on their own seeds. */
export function joinStrip(canvases) {
  const { height } = canvases[0];
  const width = canvases.reduce((sum, c) => sum + c.width, 0);
  const data = new Uint8ClampedArray(width * height * 4);
  let x0 = 0;
  for (const c of canvases) {
    if (c.height !== height)
      throw new Error(`a strip's frames share one height, not ${String(c.height)}`);
    for (let y = 0; y < height; y += 1) {
      data.set(c.data.subarray(y * c.width * 4, (y + 1) * c.width * 4), (y * width + x0) * 4);
    }
    x0 += c.width;
  }
  return { width, height, data };
}
