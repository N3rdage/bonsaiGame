// Renders the art-direction proposal (backlog #127): the same shed scene in
// three candidate styles, each at the S22 Ultra's landscape size and at 2x,
// with its palette strip, plus the scale-rule diagram. Potting Shed also gets
// a phone render at today's world zoom, the camera following the avatar.
// Inked, the chosen look, renders twice: as proposed and as chosen (#137).
//
// scale.mjs is the scale rule as data and scene.mjs the scene; pottingShed,
// softLinen and inked are the candidates (each exports a palette and
// draw(canvas, scene) at its native authoring scale; inked draws with the
// generator in art/inked/); canvas.mjs composites
// and writes the PNGs. Everything is seeded, so a rerun reproduces the
// committed bytes.
//
// Run with `node art/proposal/render.mjs`; the output is committed under
// docs/proposals/art-direction/.

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCanvas, paletteStrip, phoneView, s22Frame, S22, toDevice, writePng } from './canvas.mjs';
import { inked, inkedGrunge } from './inked.mjs';
import * as pottingShed from './pottingShed.mjs';
import * as scaleRule from './scaleRule.mjs';
import * as scene from './scene.mjs';
import * as softLinen from './softLinen.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'proposals', 'art-direction');
mkdirSync(OUT, { recursive: true });

function save(file, canvas) {
  writePng(join(OUT, file), canvas);
  console.log(`${file}  ${String(canvas.width)}x${String(canvas.height)}`);
}

for (const candidate of [pottingShed, softLinen, inked, inkedGrunge]) {
  const n = candidate.nativePerLogical;
  const shed = createCanvas(scene.SHED.width * n, scene.SHED.height * n);
  candidate.draw(shed, scene);
  const device = toDevice(shed, n, S22.zoom, candidate.smooth);
  save(`${candidate.slug}-shed-s22-landscape.png`, s22Frame(device, candidate.surround));
  if (candidate === pottingShed) {
    const { sprite } = scene.OBJECTS.find((o) => o.kind === 'avatar');
    const focus = { x: sprite.x + sprite.w / 2, y: sprite.y + sprite.h / 2 };
    const today = phoneView(shed, candidate.surround, focus, S22.todayZoom);
    save(`${candidate.slug}-shed-s22-landscape-zoom2.png`, s22Frame(today, candidate.surround));
  }
  save(`${candidate.slug}-shed-2x.png`, toDevice(shed, n, 2, candidate.smooth));
  if (candidate.palette) save(`${candidate.slug}-palette.png`, paletteStrip(candidate.palette));
}

save('scale-rule.png', scaleRule.render(scene));
