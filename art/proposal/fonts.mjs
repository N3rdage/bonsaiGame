// A one-off font comparison for the Inked art direction (#137): an HTML mock
// of the HUD badge and one panel over the Inked shed, screenshotted by
// Playwright's chromium at the S22 Ultra's landscape device pixels, once per
// candidate face. VT323 is the game's face today and stays so; Caveat is the
// hand-lettered candidate and Nunito the humanist one. Each face is sized so
// its lowercase reads at about VT323's height at the game's 8 and 10 logical
// px (32 and 40 device px at the canvas's 4 device px per logical px).
//
// Run with `npm run art:fonts`; the PNGs land in
// docs/proposals/art-direction/fonts/. Font rendering depends on the
// browser build, so unlike the art these are not byte-reproducible.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'proposals', 'art-direction', 'fonts');
const SHED = pathToFileURL(join(ROOT, 'docs', 'proposals', 'art-direction', 'inked-grunge-shed-s22-landscape.png')).href;
const font = (pkg, file) => pathToFileURL(join(ROOT, 'node_modules', '@fontsource', pkg, 'files', file)).href;

const FACES = [
  { slug: 'vt323', family: 'VT323', files: [[font('vt323', 'vt323-latin-400-normal.woff2'), 400]], scale: 1, weight: 400 },
  { slug: 'caveat', family: 'Caveat', files: [[font('caveat', 'caveat-latin-400-normal.woff2'), 400]], scale: 1.05, weight: 400 },
  {
    slug: 'nunito',
    family: 'Nunito',
    files: [
      [font('nunito', 'nunito-latin-400-normal.woff2'), 400],
      [font('nunito', 'nunito-latin-700-normal.woff2'), 700],
    ],
    scale: 0.72,
    weight: 400,
  },
];

const page = ({ family, files, scale, weight }) => `<!doctype html>
<style>
${files.map(([url, w]) => `@font-face { font-family: '${family}'; src: url('${url}'); font-weight: ${String(w)}; }`).join('\n')}
body { margin: 0; width: 2318px; height: 1080px; background: url('${SHED}'); font-family: '${family}', monospace; font-weight: ${String(weight)}; }
.badge { position: absolute; left: 230px; top: 24px; padding: 10px 22px; background: rgba(24, 36, 24, 0.82); color: #d8e6c8; border: 4px solid #4d6b45; border-radius: 6px; font-size: ${String(40 * scale)}px; }
.panel { position: absolute; right: 230px; top: 140px; width: 560px; padding: 24px 30px; background: rgba(24, 36, 24, 0.88); color: #d8e6c8; border: 4px solid #4d6b45; border-radius: 6px; font-size: ${String(32 * scale)}px; line-height: 1.25; }
.panel h2 { margin: 0 0 12px; font-size: ${String(40 * scale)}px; font-weight: ${files.length > 1 ? '700' : String(weight)}; }
.panel button { margin-top: 18px; font: inherit; font-size: ${String(40 * scale)}px; color: #182418; background: #c9dbb4; border: 0; padding: 6px 24px; border-radius: 4px; }
</style>
<div class="badge">Day 12 · Spring · $140</div>
<div class="panel">
  <h2>Juniper, 3 years</h2>
  <div>Health 82% · Height 18.4 cm</div>
  <div>Water: due tomorrow</div>
  <div>Style: informal upright</div>
  <div>Score 64 / 100</div>
  <button>Prune</button>
</div>`;

mkdirSync(OUT, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), 'bonsai-fonts-'));
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 2318, height: 1080 }, deviceScaleFactor: 1 });
for (const face of FACES) {
  const html = join(scratch, `${face.slug}.html`);
  writeFileSync(html, page(face));
  await tab.goto(pathToFileURL(html).href, { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  const file = join(OUT, `hud-${face.slug}-s22-landscape.png`);
  await tab.screenshot({ path: file });
  console.log(file);
}
await browser.close();
rmSync(scratch, { recursive: true });
