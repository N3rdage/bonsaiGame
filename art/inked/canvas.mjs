// The PNG writer: an RGBA canvas ({ width, height, data }, as `finish` and
// `finishCutOut` return it) written to `path` with `pngjs`.

import { writeFileSync } from 'node:fs';
import pngjs from 'pngjs';

const { PNG } = pngjs;

export function writePng(path, canvas) {
  const png = new PNG({ width: canvas.width, height: canvas.height });
  png.data.set(canvas.data);
  writeFileSync(path, PNG.sync.write(png));
}
