// Candidate 3, Inked: hand-drawn, drawn with the Inked generator in
// art/inked/ (authored at 4 art px per logical px, supersampled, box-filtered
// down, then scaled to the screen bilinearly, never nearest-neighbour). This
// module is only the shed scene in that vocabulary. It renders twice: `inked`
// is the proposal of #127 (PROPOSAL_STYLE, every grunge knob off) and
// `inkedGrunge` the look as chosen in #137 (STYLE), from the same seed, so
// the lines underneath are the same and only the grunge differs.

import { createPage, finish, palette as inkedPalette, PER_LOGICAL, PROPOSAL_STYLE, STYLE, SURROUND } from '../inked/index.mjs';

function structure(k, scene) {
  const { SHED } = scene;
  const fl = SHED.floor;
  k.box(0, 0, SHED.width, SHED.height, null, { edges: false });
  k.box(fl.x, fl.y, fl.w, fl.h, 'floor', { edges: false });
  for (let y = fl.y + 8; y < fl.y + fl.h; y += 8) {
    k.line([[fl.x + 1, y], [fl.x + 50, y + 0.3]], 1.6);
    k.line([[fl.x + 54, y + 0.2], [fl.x + 118, y - 0.2]], 1.6);
    k.line([[fl.x + 122, y], [fl.x + fl.w - 1, y + 0.2]], 1.6);
    const j = fl.x + 10 + ((y * 37) % 120);
    k.line([[j, y - 7], [j, y - 1]], 1.5);
  }
  k.box(0, 0, SHED.width, 48, 'wall', { edges: false });
  k.hatchIn([[0, 4], [176, 4], [176, 9], [0, 9]], { angle: 0.6, spacing: 2 });
  for (let x = 8; x < 176; x += 8) k.line([[x, 5], [x + 0.3, 43]], 1.5);
  k.box(0, 0, 176, 4, 'wood');
  k.box(0, 44, 176, 4, 'wood');

  const w = SHED.window;
  k.box(w.x, w.y, w.w, w.h, 'wood');
  k.box(w.x + 2, w.y + 2, w.w - 4, w.h - 4, 'glass');
  k.line([[w.x + 16, w.y + 2], [w.x + 16, w.y + w.h - 2]], 2.2);
  k.line([[w.x + 2, w.y + 12], [w.x + w.w - 2, w.y + 12]], 2.2);
  for (const [gx, gy] of [[w.x + 6, w.y + 9], [w.x + 21, w.y + 9]]) k.line([[gx, gy], [gx + 4, gy - 4]], 1.6);
  k.box(w.x - 2, w.y + w.h - 2, w.w + 4, 4, 'top');

  const s = SHED.shelf;
  k.shape([[s.x + 3, s.y + 4], [s.x + 11, s.y + 4], [s.x + 10, s.y + 11], [s.x + 4, s.y + 11]], 'terracotta');
  k.blob(s.x + 17, s.y + 3, 4, 3, 'foliage', { bump: 0.25, lobes: 5 });
  k.shape([[s.x + 14, s.y + 6], [s.x + 20, s.y + 6], [s.x + 19, s.y + 11], [s.x + 15, s.y + 11]], 'glass');
  k.shape([[s.x + 24, s.y + 7], [s.x + 30, s.y + 7], [s.x + 29, s.y + 11], [s.x + 25, s.y + 11]], 'terracotta');
  k.shape([[s.x + 33, s.y + 3], [s.x + 41, s.y + 3], [s.x + 40, s.y + 11], [s.x + 34, s.y + 11]], 'terracotta', {
    hatching: [[s.x + 38, s.y + 3], [s.x + 41, s.y + 3], [s.x + 40, s.y + 11], [s.x + 38, s.y + 11]],
  });
  k.box(s.x, s.y + 11, s.w, 3, 'top');
  k.line([[s.x + 4, s.y + 14], [s.x + 4, s.y + 17], [s.x + 7, s.y + 14]], 1.8);
  k.line([[s.x + s.w - 4, s.y + 14], [s.x + s.w - 4, s.y + 17], [s.x + s.w - 7, s.y + 14]], 1.8);

  k.line([[68.5, 8], [68.5, 12]], 1.6);
  k.box(65, 12, 7, 10, 'lamp');
  k.line([[68.5, 14], [68.5, 20]], 1.5);

  const d = SHED.doorNorth;
  k.box(d.x, d.y, d.w, d.h, 'wood', { hatching: [[d.x + d.w - 3, d.y], [d.x + d.w, d.y], [d.x + d.w, d.y + d.h], [d.x + d.w - 3, d.y + d.h]] });
  k.box(d.x + 3, d.y + 3, d.w - 6, d.h - 3, 'wood');
  k.box(d.x + 6, d.y + 7, d.w - 12, 12, 'wood', { width: 1.8 });
  k.box(d.x + 6, d.y + 23, d.w - 12, 13, 'wood', { width: 1.8 });
  k.blob(d.x + d.w - 5.5, d.y + 22.5, 1.3, 1.3, 'brass', { width: 1.6 });

  const { leftCap: l, rightCap: r, doorEast: e } = SHED;
  k.box(l.x, l.y, l.w, l.h, 'cap', { hatching: true });
  k.box(r.x, r.y, r.w, r.h, 'cap', { hatching: true });
  k.box(e.x, e.y + 16, e.w, e.h - 16, 'outside');
  k.box(e.x, e.y, e.w, 16, 'wood');
  for (let gy = e.y + 20; gy < e.y + e.h; gy += 5) k.line([[e.x + 3, gy + 1], [e.x + 4, gy - 1.5]], 1.5);
  k.cornerShade(fl.x, fl.y, 1, 1);
  k.cornerShade(fl.x + fl.w, fl.y, -1, 1);
  k.cornerShade(fl.x, fl.y + fl.h, 1, -1);
  k.cornerShade(fl.x + fl.w, fl.y + fl.h, -1, -1);
}

function frontCap(k, scene) {
  const f = scene.SHED.frontCap;
  k.box(f.x, f.y, f.w, f.h, 'cap', { hatching: true });
  k.line([[scene.SHED.leftCap.w, f.y], [scene.SHED.leftCap.w, scene.SHED.leftCap.y]], 2.6);
}

const legs = (k, xs, y0, y1) => xs.forEach((x) => k.box(x, y0, 3.5, y1 - y0, 'wood', { width: 2.2 }));

const DRAW = {
  rug(k, _scene, o) {
    const { x, y, w, h } = o.sprite;
    k.box(x, y, w, h, 'rug');
    k.box(x + 3, y + 3, w - 6, h - 6, 'cream', { width: 1.8, wear: false });
    k.box(x + 6, y + 6, w - 12, h - 12, 'rug', { width: 1.8, wear: false });
    for (let fx = x + 2; fx < x + w; fx += 3) {
      k.line([[fx, y], [fx, y - 1.5]], 1.5);
      k.line([[fx, y + h], [fx, y + h + 1.5]], 1.5);
    }
  },
  workbench(k) {
    k.groundShadow(40, 67, 27, 4);
    k.box(19, 51, 42, 16, 'shadow', { edges: false, paper: false, hatching: 'shadow' });
    legs(k, [17, 59.5], 46, 67.5);
    k.box(19, 58, 42, 3, 'wood', { width: 2 });
    k.box(16, 28, 48, 18, 'top');
    k.box(16, 46, 48, 5, 'wood', { hatching: true });
    k.shape([[21, 34], [29, 34], [28, 41], [22, 41]], 'terracotta');
    k.blob(25, 32, 4.5, 3.2, 'foliage', { bump: 0.25, lobes: 6 });
    k.line([[33, 40], [43, 40]], 3);
    k.line([[43, 40], [48, 40]], 4);
    k.box(51, 31, 9, 7, 'metal', { hatching: [[57, 31], [60, 31], [60, 38], [57, 38]] });
  },
  plantingTable(k) {
    k.groundShadow(124, 67, 23, 4);
    k.box(107, 51, 34, 16, 'shadow', { edges: false, paper: false, hatching: 'shadow' });
    legs(k, [105, 139.5], 46, 67.5);
    k.box(104, 28, 40, 18, 'top');
    k.box(107, 31, 34, 12, 'soil');
    for (let sy = 35; sy < 42; sy += 5) {
      for (let sx = 110.5; sx < 140; sx += 6) k.line([[sx, sy + 1], [sx + 0.5, sy - 1], [sx + 1.8, sy - 1.6]], 1.6);
    }
    k.box(104, 46, 40, 5, 'wood', { hatching: true });
  },
  kiosk(k) {
    k.groundShadow(28, 115, 22, 4);
    k.box(8, 92, 40, 24, 'wood', { hatching: [[38, 92], [48, 92], [48, 116], [38, 116]] });
    k.line([[20, 94], [20, 114]], 1.6);
    k.box(15, 99, 18, 8, 'cream', { width: 2, wear: false });
    k.blob(24, 103, 3, 2, 'foliage', { width: 1.6 });
    k.box(8, 72, 40, 20, 'top');
    k.shape([[12, 76], [18, 75.5], [18.5, 84], [12.5, 84.5]], 'shirt', { width: 2 });
    k.shape([[20, 77], [26, 76.5], [26.5, 85], [20.5, 85.5]], 'terracotta', { width: 2 });
    k.shape([[28, 76], [34, 76], [34, 84.5], [28, 84.5]], 'foliage', { width: 2 });
    k.box(37, 78, 8, 8, 'metal', { width: 2 });
    k.blob(40.5, 76.5, 1.8, 1.4, 'brass', { width: 1.6 });
  },
  pedestal(k, scene) {
    k.groundShadow(128, 115, 10, 3);
    k.box(120, 110, 16, 6, 'stone', { hatching: [[132, 110], [136, 110], [136, 116], [132, 116]] });
    k.box(123, 95, 10, 15, 'stone', { hatching: [[130, 95], [133, 95], [133, 110], [130, 110]] });
    k.box(120, 84, 16, 11, 'stone');
    bonsai(k, scene.BONSAI);
  },
  avatar(k) {
    k.groundShadow(104, 115, 7, 2.5);
    k.shape([[100, 104], [104, 104], [103.6, 113], [100.4, 113]], 'trousers', { width: 2 });
    k.shape([[104, 104], [108, 104], [107.6, 113], [104.4, 113]], 'trousers', { width: 2, hatching: true });
    k.shape([[99, 113], [103.5, 113], [103.5, 115.5], [99, 115.5]], 'hair', { width: 2 });
    k.shape([[104, 113], [109.5, 113.5], [110, 115.5], [104, 115.5]], 'hair', { width: 2 });
    k.shape([[100, 95], [108, 95], [109, 105], [99, 105]], 'shirt', { hatching: [[99.5, 101], [109, 101], [109, 105], [99, 105]] });
    k.shape([[103, 96], [107, 96.5], [107, 104], [103.5, 104]], 'shirt', { width: 2 });
    k.blob(105.2, 105.3, 1.8, 1.6, 'skin', { width: 1.8 });
    k.blob(104, 89.5, 5, 5, 'skin');
    k.shape([[98.5, 89], [99.5, 85], [103, 83.6], [107.5, 84.8], [108.5, 87], [104, 87], [102, 89], [101, 92.5], [99, 92]], 'hair', { hatching: [[99.5, 85], [103, 84], [107, 85], [101.5, 91.5], [99.5, 91.5]], width: 2.2 });
    k.line([[106.4, 88.6], [106.5, 89.6]], 2.4);
    k.line([[108.8, 89.4], [109.8, 90.8], [108.9, 91.2]], 1.6);
    k.line([[106.5, 92.6], [107.8, 92.4]], 1.5);
  },
  potStack(k) {
    k.groundShadow(144, 99, 7, 2);
    k.shape([[140, 88], [148, 88], [147, 100], [141, 100]], 'terracotta', { hatching: [[145, 88], [148, 88], [147, 100], [145, 100]] });
    for (const ry of [84, 88, 92]) k.box(138, ry, 12, 3, 'terracotta', { width: 2 });
  },
  wateringCan(k) {
    k.groundShadow(61, 121, 7, 2);
    k.line([[57, 113], [57, 110], [63, 110], [63, 113]], 2);
    k.shape([[56, 113], [64, 113], [64, 122], [56, 122]], 'metal', { hatching: [[61, 113], [64, 113], [64, 122], [61, 122]] });
    k.line([[64, 119], [68.5, 113]], 2.4);
    k.blob(69, 112.5, 1.8, 1.5, 'metal', { width: 1.8 });
  },
  sack(k) {
    k.groundShadow(140, 141, 8, 2.5);
    k.shape(
      [[137, 124], [143, 124], [142.5, 128], [146, 131], [147.5, 137], [146, 141.5], [134, 141.5], [132.5, 137], [134, 131], [137.5, 128]],
      'cream',
      { hatching: [[143, 129], [146, 131], [147.5, 137], [146, 141.5], [142, 141.5]] },
    );
    k.line([[137, 128], [143, 128]], 2.2);
    k.line([[135, 133], [138, 134]], 1.6);
  },
  doorLeaf(k, scene) {
    const { hinge: [hx, hy], free: [fx, fy], height } = scene.EAST_LEAF;
    k.groundShadow((hx + fx) / 2, (hy + fy) / 2 + 2, 9, 4);
    k.shape([[fx, fy], [hx, hy], [hx, hy - height], [fx, fy - height]], 'wood', {
      hatching: [[hx - 3, hy - 3.5], [hx, hy], [hx, hy - height], [hx - 3, hy - height - 3.5]],
    });
    for (const t of [12, 26]) k.line([[fx + 1, fy - height + t], [hx - 1, hy - height + t - 1.3]], 1.8);
    k.blob(fx + 3, fy - 21, 1.3, 1.3, 'brass', { width: 1.6 });
  },
};

function bonsai(k, { cx, base }) {
  k.shape([[cx - 5.5, base - 4], [cx + 5.5, base - 4], [cx + 4.5, base + 1], [cx - 4.5, base + 1]], 'terracotta', {
    hatching: [[cx + 2, base - 4], [cx + 5.5, base - 4], [cx + 4.5, base + 1], [cx + 2, base + 1]],
    width: 2.2,
  });
  k.line([[cx - 6, base - 4], [cx + 6, base - 4]], 2.4);
  k.line([[cx + 0.5, base - 4.2], [cx - 0.8, base - 7.5], [cx + 1, base - 10.5], [cx + 1.5, base - 12]], 3.6);
  k.line([[cx - 0.4, base - 7.8], [cx - 3, base - 10]], 2.2);
  k.blob(cx - 4, base - 11, 4, 2.5, 'foliage', { bump: 0.2, lobes: 6, hatching: { angle: 0.4, spacing: 1.2 } });
  k.blob(cx + 3.5, base - 13, 4.5, 3, 'foliage', { bump: 0.2, lobes: 7, hatching: { angle: 0.4, spacing: 1.2 } });
  k.blob(cx, base - 16, 4, 2.5, 'foliage', { bump: 0.2, lobes: 6 });
}

/** Draws `scene` (scene.mjs) onto `canvas` in `style`, four canvas pixels per logical pixel. */
function drawIn(style, canvas, scene) {
  const page = createPage(scene.SHED.width, scene.SHED.height, { seed: 1270, style });
  structure(page.k, scene);
  for (const o of scene.sorted()) DRAW[o.kind](page.k, scene, o);
  frontCap(page.k, scene);
  canvas.data.set(finish(page).data);
}

const common = { nativePerLogical: PER_LOGICAL, smooth: true, surround: SURROUND };
export const inked = { ...common, slug: 'inked', name: 'Inked', palette: inkedPalette, draw: (canvas, scene) => drawIn(PROPOSAL_STYLE, canvas, scene) };
/** The chosen look (#137). It shares the proposal's palette, so it writes no strip of its own. */
export const inkedGrunge = { ...common, slug: 'inked-grunge', name: 'Inked, as chosen', draw: (canvas, scene) => drawIn(STYLE, canvas, scene) };
