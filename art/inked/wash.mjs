// Washes: translucent colour laid into a form. With the style's wash knobs at
// zero a wash is a flat fill. Otherwise it behaves like watercolour drying:
// pigment pools at the edge into a darker rim (`washPool`, over
// `washPoolWidth` logical px), creeps a little past the outline in an
// uneven, noise-shaped bleed (`washBleed` logical px at most) and settles
// unevenly inside (`washGranulation`).

import { valueNoise } from './paper.mjs';
import { crossings, fillPolygon, paint } from './stroke.mjs';

/** The distance from (x, y) to the nearest edge of closed polygon `s`. */
function edgeDistance(s, x, y) {
  let best = Infinity;
  for (let i = 0; i < s.length; i += 1) {
    const [ax, ay] = s[i];
    const [bx, by] = s[(i + 1) % s.length];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

/** Lays colour `c` at opacity `a` into the polygon of logical points `pts`. */
export function wash(ink, pts, c, a) {
  const { washPool, washPoolWidth, washBleed, washGranulation } = ink.style;
  if (washPool <= 0 && washBleed <= 0 && washGranulation <= 0) {
    fillPolygon(ink, pts, c, a);
    return;
  }
  const s = pts.map(([x, y]) => [x * ink.k, y * ink.k]);
  const reach = washBleed * ink.k;
  const rim = washPoolWidth * ink.k;
  const seed = Math.floor(ink.g() * 1e9);
  const xs = s.map((p) => p[0]);
  const ys = s.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - reach));
  const x1 = Math.min(ink.W - 1, Math.ceil(Math.max(...xs) + reach));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - reach));
  const y1 = Math.min(ink.H - 1, Math.ceil(Math.max(...ys) + reach));
  for (let y = y0; y <= y1; y += 1) {
    const cy = y + 0.5;
    const row = crossings(s, cy);
    for (let x = x0; x <= x1; x += 1) {
      const cx = x + 0.5;
      const inside = row.filter((r) => r < cx).length % 2 === 1;
      const d = edgeDistance(s, cx, cy);
      let alpha;
      if (inside) {
        alpha = a + (d < rim ? washPool * (1 - d / rim) ** 2 : 0);
      } else {
        const limit = reach * (0.25 + 0.9 * valueNoise(x, y, 3 * ink.k, seed));
        if (d >= limit) continue;
        alpha = (a + washPool) * 0.6 * (1 - d / limit) ** 2;
      }
      if (washGranulation > 0) alpha *= 1 + washGranulation * (2 * valueNoise(x, y, 1.5 * ink.ss, seed + 1) - 1);
      paint(ink, x, y, c, Math.min(1, alpha));
    }
  }
}
