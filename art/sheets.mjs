// Builds the web build's sprite sheets from the GameMaker prototype's frames.
//
// Each prototype sprite keeps one PNG per frame under
// archive/gamemaker/sprites/<name>/<frame-uuid>.png, in the order of the
// `frames` array of <name>.yy. This writes one horizontal strip per sprite to
// public/assets/<name>.png, frame 0 at the left, every frame the sprite's size.
//
// Run with `npm run art:sheets`; the output is committed.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';

const { PNG } = pngjs;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPRITES = join(ROOT, 'archive', 'gamemaker', 'sprites');
const OUT = join(ROOT, 'public', 'assets');

/** The prototype sprites the rooms, props and player draw (src/world/assets.ts). */
const NAMES = [
  'spr_player',
  'spr_floor_shed',
  'spr_floor_garden',
  'spr_source_plant',
  'spr_wall',
  'spr_fence',
  'spr_fence_v',
  'spr_door',
  'spr_workbench',
  'spr_planting_table',
  'spr_shop_kiosk',
  'spr_pedestal',
  'spr_shelf',
  'spr_tools',
  'spr_watering_can',
  'spr_pot_stack',
  'spr_sack',
];

/** GameMaker's .yy is JSON with trailing commas. */
function readYy(path) {
  return JSON.parse(readFileSync(path, 'utf8').replace(/,(\s*[}\]])/g, '$1'));
}

function buildSheet(name) {
  const yy = readYy(join(SPRITES, name, `${name}.yy`));
  const { width, height } = yy;
  const frames = yy.frames.map((f) =>
    PNG.sync.read(readFileSync(join(SPRITES, name, `${f.name}.png`))),
  );
  for (const [i, frame] of frames.entries()) {
    if (frame.width !== width || frame.height !== height) {
      throw new Error(
        `${name} frame ${String(i)} is ${String(frame.width)}x${String(frame.height)}, ` +
          `not ${String(width)}x${String(height)}`,
      );
    }
  }
  const sheet = new PNG({ width: width * frames.length, height });
  frames.forEach((frame, i) => {
    PNG.bitblt(frame, sheet, 0, 0, width, height, i * width, 0);
  });
  writeFileSync(join(OUT, `${name}.png`), PNG.sync.write(sheet));
  return `${name}.png  ${String(sheet.width)}x${String(height)}  ${String(frames.length)} frame(s)`;
}

mkdirSync(OUT, { recursive: true });
for (const name of NAMES) console.log(buildSheet(name));
