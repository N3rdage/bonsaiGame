// A small ink rasteriser for the hand-drawn candidate. Coordinates are
// logical pixels; the page is held at `perLogical` art px per logical px
// times `ss` samples per art px, every primitive is drawn hard-edged into the
// samples, and `toCanvas` box-filters them down to art px, which is where the
// smooth edges come from.
//   fillPolygon  scanline fill (even-odd), optionally translucent: the washes.
//   stroke       a pen line: the polyline is subdivided, its vertices jittered
//                sideways by a seeded random walk, its width swelling in the
//                middle and thinning at the ends, and both ends run on a
//                little past their points, as a pen overshoots a corner.
//   hatch        parallel strokes across a convex polygon, ends ragged.

import { createCanvas } from './canvas.mjs';

export function createInk(width, height, { perLogical, ss, paper }) {
  const k = perLogical * ss;
  const W = width * k;
  const H = height * k;
  const rgb = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i += 1) rgb.set(paper, i * 3);
  return { k, ss, W, H, rgb, artWidth: width * perLogical, artHeight: height * perLogical };
}

function paint(ink, x, y, c, a) {
  const i = (y * ink.W + x) * 3;
  for (let j = 0; j < 3; j += 1) ink.rgb[i + j] = ink.rgb[i + j] * (1 - a) + c[j] * a;
}

/** Fills a polygon of logical points with `c` at opacity `a`. */
export function fillPolygon(ink, pts, c, a = 1) {
  const s = pts.map(([x, y]) => [x * ink.k, y * ink.k]);
  const ys = s.map((p) => p[1]);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(ink.H - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y += 1) {
    const cy = y + 0.5;
    const xs = [];
    for (let i = 0; i < s.length; i += 1) {
      const [ax, ay] = s[i];
      const [bx, by] = s[(i + 1) % s.length];
      if (ay <= cy !== by <= cy) xs.push(ax + ((cy - ay) * (bx - ax)) / (by - ay));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const xa = Math.max(0, Math.ceil(xs[i] - 0.5));
      const xb = Math.min(ink.W - 1, Math.floor(xs[i + 1] - 0.5));
      for (let x = xa; x <= xb; x += 1) paint(ink, x, y, c, a);
    }
  }
}

/** One segment with radii ra and rb at its ends, in sample space. */
function capsule(ink, ax, ay, ra, bx, by, rb, c) {
  const r = Math.max(ra, rb);
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r));
  const x1 = Math.min(ink.W - 1, Math.ceil(Math.max(ax, bx) + r));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r));
  const y1 = Math.min(ink.H - 1, Math.ceil(Math.max(ay, by) + r));
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const px = x + 0.5 - ax;
      const py = y + 0.5 - ay;
      const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, (px * dx + py * dy) / len2));
      const ex = px - t * dx;
      const ey = py - t * dy;
      const rr = ra + (rb - ra) * t;
      if (ex * ex + ey * ey <= rr * rr) paint(ink, x, y, c, 1);
    }
  }
}

/**
 * Draws a pen line through logical points. `width` is in art px; `jitter`
 * (art px) is the sideways wobble, `overshoot` (art px) how far the ends run on.
 */
export function stroke(ink, pts, { width, colour, rnd, jitter = 0.5, overshoot = 1.5 }) {
  const k = ink.k;
  const s = pts.map(([x, y]) => [x * k, y * k]);
  const extend = (from, to) => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    const o = overshoot * ink.ss * (0.4 + rnd());
    return [to[0] + (dx / len) * o, to[1] + (dy / len) * o];
  };
  if (s.length > 1 && overshoot > 0) {
    s.unshift(extend(s[1], s[0]));
    s.push(extend(s[s.length - 2], s[s.length - 1]));
  }
  const step = 4 * ink.ss;
  const path = [];
  for (let i = 0; i + 1 < s.length; i += 1) {
    const [ax, ay] = s[i];
    const [bx, by] = s[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let j = 0; j < n; j += 1) path.push([ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n]);
  }
  path.push(s[s.length - 1]);
  let drift = 0;
  const pen = path.map(([x, y], i) => {
    const [nx, ny] = path[Math.min(i + 1, path.length - 1)];
    const [px, py] = path[Math.max(i - 1, 0)];
    const len = Math.hypot(nx - px, ny - py) || 1;
    drift = drift * 0.6 + (rnd() - 0.5) * jitter * ink.ss;
    const t = path.length > 1 ? i / (path.length - 1) : 0.5;
    const swell = 0.55 + 0.45 * Math.sin(Math.PI * t);
    const r = (width * ink.ss * swell * (0.85 + 0.3 * rnd())) / 2;
    return [x - ((ny - py) / len) * drift, y + ((nx - px) / len) * drift, r];
  });
  for (let i = 0; i + 1 < pen.length; i += 1) {
    const [ax, ay, ra] = pen[i];
    const [bx, by, rb] = pen[i + 1];
    capsule(ink, ax, ay, ra, bx, by, rb, colour);
  }
  if (pen.length === 1) capsule(ink, pen[0][0], pen[0][1], pen[0][2], pen[0][0], pen[0][1], pen[0][2], colour);
}

/** Parallel strokes at `angle` (radians), `spacing` logical px apart, across convex polygon `poly`. */
export function hatch(ink, poly, { angle, spacing, width, colour, rnd }) {
  const d = [Math.cos(angle), Math.sin(angle)];
  const n = [-d[1], d[0]];
  const along = poly.map(([x, y]) => x * n[0] + y * n[1]);
  const lo = Math.min(...along);
  const hi = Math.max(...along);
  for (let off = lo + spacing / 2; off < hi; off += spacing) {
    const o = [n[0] * off, n[1] * off];
    const ts = [];
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const ea = (a[0] - o[0]) * n[0] + (a[1] - o[1]) * n[1];
      const eb = (b[0] - o[0]) * n[0] + (b[1] - o[1]) * n[1];
      if (ea <= 0 === eb <= 0) continue;
      const u = ea / (ea - eb);
      const p = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
      ts.push((p[0] - o[0]) * d[0] + (p[1] - o[1]) * d[1]);
    }
    if (ts.length < 2) continue;
    const t0 = Math.min(...ts);
    const t1 = Math.max(...ts);
    const len = t1 - t0;
    const a = t0 + len * 0.12 * rnd();
    const b = t1 - len * 0.12 * rnd();
    const at = (t) => [o[0] + d[0] * t, o[1] + d[1] * t];
    stroke(ink, [at(a), at(b)], { width, colour, rnd, jitter: 0.3, overshoot: 0 });
  }
}

/** Box-filters the samples down to art px. */
export function toCanvas(ink) {
  const out = createCanvas(ink.artWidth, ink.artHeight);
  const { ss } = ink;
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const i = ((y * ss + sy) * ink.W + x * ss + sx) * 3;
          for (let j = 0; j < 3; j += 1) sum[j] += ink.rgb[i + j];
        }
      }
      const t = (y * out.width + x) * 4;
      for (let j = 0; j < 3; j += 1) out.data[t + j] = Math.round(sum[j] / (ss * ss));
      out.data[t + 3] = 255;
    }
  }
  return out;
}
