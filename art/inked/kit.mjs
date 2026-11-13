// The drawing kit: the vocabulary every Inked sheet is drawn in, bound to one
// page. Every form is laid in three passes: an opaque paper silhouette (so it
// hides what is behind it), a wash of low-saturation colour laid slightly off
// register as a brush would, then ink: each edge its own wobbling stroke,
// hatching on the shadow sides. After the ink, the style's wear: wood gets
// knots and splits, pots chips and rings, cloth frayed edges and a stain.
//
// `rnd` is the sheet's drawing generator. The heavy shadow passes (cross
// hatching, corner shading) and the wear draw from the page's grunge
// generator instead, so they vary with the page seed and never disturb the
// wobble of the lines underneath.

import { crossings, fillPolygon, hatch, stroke } from './stroke.mjs';
import { INK, PAPER, WASH_ALPHA, WASHES, WEAR_BY_WASH } from './style.mjs';
import { wash } from './wash.mjs';

const bounds = (pts) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
const inside = (pts, [x, y]) => crossings(pts, y).filter((c) => c < x).length % 2 === 1;

/** The kit for page `ink` (stroke.mjs's createInk), drawing with generator `rnd`; coordinates are logical px. */
export function kit(ink, rnd) {
  const { style, g } = ink;
  const line = (pts, width = 2.4) => stroke(ink, pts, { width, colour: INK, rnd, jitter: style.jitter, overshoot: style.overshoot });
  /** A thin grunge line (wear marks): drawn from the grunge generator. */
  const scratch = (pts, width) => stroke(ink, pts, { width, colour: INK, rnd: g, jitter: style.jitter, overshoot: 0.6 });
  const offRegister = (pts) => {
    const dx = (rnd() - 0.3) * 0.6;
    const dy = (rnd() - 0.3) * 0.6;
    return pts.map(([x, y]) => [x + dx + (rnd() - 0.5) * 0.4, y + dy + (rnd() - 0.5) * 0.4]);
  };
  const hatchIn = (pts, { angle = 0.9, spacing = 1.6, width = 1.5 } = {}) => hatch(ink, pts, { angle, spacing, width, colour: INK, rnd });
  /** The second, crossing pass of hatching that deepens a shadow; nothing when the style has no cross hatching. */
  const crossHatchIn = (pts) => {
    if (style.crossHatch) hatch(ink, pts, { ...style.crossHatch, width: 1.4, colour: INK, rnd: g });
  };

  const ring = (cx, cy, rx, ry, bump = 0, lobes = 0, phase = 0, n = 28) => {
    const pts = [];
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const r = 1 + bump * Math.abs(Math.sin((a * lobes) / 2 + phase));
      pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
    }
    return pts;
  };

  const wear = {
    wood(pts) {
      const { x0, x1, y0, y1 } = bounds(pts);
      const w = x1 - x0;
      const h = y1 - y0;
      const horizontal = w >= h;
      const long = Math.max(w, h);
      if (long < 8 || Math.min(w, h) < 3) return;
      const at = (u, v) => (horizontal ? [x0 + u * w, y0 + v * h] : [x0 + v * w, y0 + u * h]);
      const knots = Math.floor((style.wear * long) / 28 + g());
      for (let i = 0; i < knots; i += 1) {
        const [cx, cy] = at(0.15 + 0.7 * g(), 0.3 + 0.4 * g());
        if (!inside(pts, [cx, cy])) continue;
        const ra = 0.9 + 0.6 * g();
        const rb = Math.min(0.5 + 0.3 * g(), Math.min(w, h) * 0.25);
        const knot = horizontal ? ring(cx, cy, ra, rb, 0, 0, 0, 10) : ring(cx, cy, rb, ra, 0, 0, 0, 10);
        scratch([...knot, knot[0], knot[1]], 1.2);
      }
      const splits = Math.floor((style.wear * long) / 36 + g());
      for (let i = 0; i < splits; i += 1) {
        const end = g() < 0.5 ? 0.02 : 0.98;
        const v = 0.25 + 0.5 * g();
        const run = (2 + 3 * g()) / long;
        const from = at(end, v);
        const to = at(end < 0.5 ? end + run : end - run, v + (g() - 0.5) * 0.15);
        if (inside(pts, from) && inside(pts, to)) scratch([from, to], 1.1);
      }
    },
    pot(pts) {
      const { x0, x1, y0, y1 } = bounds(pts);
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 5 || h < 4) return;
      if (g() < 0.6 * style.wear) {
        const x = x0 + (0.25 + 0.5 * g()) * w;
        fillPolygon(ink, [[x - 0.9, y0 - 0.4], [x + 0.9, y0 - 0.4], [x + 0.15, y0 + 1.1]], PAPER);
        scratch([[x - 1, y0], [x + 0.1, y0 + 1.1], [x + 1, y0]], 1.1);
      }
      if (h >= 6 && g() < 0.8 * style.wear) {
        const y = y0 + h * (0.3 + 0.2 * g());
        const row = crossings(pts, y);
        const [a, b] = [row[0], row[row.length - 1]];
        if (b - a > 3) {
          fillPolygon(ink, [[a + 0.7, y], [b - 0.7, y], [b - 0.7, y + 0.8], [a + 0.7, y + 0.8]], PAPER, 0.4);
          scratch([[a + 0.6, y + 0.9], [a + (b - a) * (0.4 + 0.3 * g()), y + 0.95]], 1);
        }
      }
    },
    cloth(pts) {
      const { x0, x1, y0, y1 } = bounds(pts);
      const centre = [(x0 + x1) / 2, (y0 + y1) / 2];
      for (let i = 0; i < pts.length; i += 1) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        const len = Math.hypot(bx - ax, by - ay);
        if (len < 3) continue;
        const d = [(bx - ax) / len, (by - ay) / len];
        const flip = d[1] * ((ax + bx) / 2 - centre[0]) - d[0] * ((ay + by) / 2 - centre[1]) < 0 ? -1 : 1;
        const n = [d[1] * flip, -d[0] * flip];
        for (let t = 0.6; t < len - 0.6; t += 1.1) {
          if (g() >= 0.45 * style.wear) continue;
          const p = [ax + d[0] * t, ay + d[1] * t];
          const reach = 0.5 + g();
          const skew = (g() - 0.5) * 0.6;
          scratch([p, [p[0] + n[0] * reach + d[0] * skew, p[1] + n[1] * reach + d[1] * skew]], 0.9);
        }
      }
      if ((x1 - x0) * (y1 - y0) > 150 && g() < 0.7 * style.wear) {
        const spot = [x0 + (0.25 + 0.5 * g()) * (x1 - x0), y0 + (0.25 + 0.5 * g()) * (y1 - y0)];
        if (inside(pts, spot)) wash(ink, ring(spot[0], spot[1], 2 + 2 * g(), 1.2 + g(), 0.3, 3, g() * Math.PI, 16), WASHES.shadow, 0.14);
      }
    },
  };

  /**
   * A closed form: paper (unless it is a see-through shade), wash, optional
   * hatching (true for the whole form, a polygon for part of it, 'shadow' for
   * the whole form in heavy shadow), each edge as its own stroke, then wear
   * by material unless `wear` is false.
   */
  const shape = (pts, washName, { hatching, width = 2.6, edges = true, paper = true, wear: worn = true } = {}) => {
    if (paper) fillPolygon(ink, pts, PAPER);
    if (washName) wash(ink, offRegister(pts), WASHES[washName], WASH_ALPHA);
    if (hatching) {
      const area = hatching === true || hatching === 'shadow' ? pts : hatching;
      hatchIn(area);
      if (hatching === 'shadow') crossHatchIn(area);
    }
    if (edges) for (let i = 0; i < pts.length; i += 1) line([pts[i], pts[(i + 1) % pts.length]], width);
    const material = WEAR_BY_WASH[washName];
    if (worn && material && style.wear > 0) wear[material](pts);
  };
  const box = (x, y, w, h, washName, opts) => shape([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], washName, opts);

  /** An ellipse (or, with bump and lobes, a cloud), outlined in one stroke that runs past its start. */
  const blob = (cx, cy, rx, ry, washName, { bump = 0, lobes = 0, hatching, width = 2.4 } = {}) => {
    const pts = ring(cx, cy, rx, ry, bump, lobes, rnd() * Math.PI);
    fillPolygon(ink, pts, PAPER);
    if (washName) wash(ink, offRegister(pts), WASHES[washName], WASH_ALPHA);
    if (hatching) hatchIn(ring(cx + rx * 0.25, cy + ry * 0.35, rx * 0.7, ry * 0.6), hatching);
    line([...pts, pts[0], pts[1], pts[2]], width);
  };
  /** A soft ground shadow: a translucent wash and loose horizontal strokes, crossed when the style is heavy. */
  const groundShadow = (cx, cy, rx, ry) => {
    wash(ink, ring(cx, cy, rx, ry), WASHES.shadow, style.shadowAlpha);
    hatch(ink, ring(cx, cy, rx * 0.85, ry * 0.7), { angle: 0.15, spacing: 1.8, width: 1.5, colour: INK, rnd });
    crossHatchIn(ring(cx, cy, rx * 0.7, ry * 0.55));
  };
  /** Shadow gathered in a room corner at (x, y), the room lying towards (sx, sy) = (±1, ±1); nothing when `cornerShade` is 0. */
  const cornerShade = (x, y, sx, sy) => {
    const size = style.cornerShade;
    if (size <= 0) return;
    const tri = [[x, y], [x + sx * size, y], [x, y + sy * size]];
    wash(ink, tri, WASHES.shadow, 0.3);
    hatch(ink, tri, { angle: 0.9, spacing: 1.6, width: 1.4, colour: INK, rnd: g });
    crossHatchIn(tri);
  };
  return { line, shape, box, blob, groundShadow, hatchIn, cornerShade };
}
