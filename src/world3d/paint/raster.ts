/**
 * A texture as plain bytes, and the few operations the painters need on it: a
 * seeded random stream, colour helpers, a soft round brush that blends with
 * source-over alpha, a stroke of such dabs along a curve, rectangle fills and
 * a hash. Nothing here touches a canvas or the DOM, so painting runs in Node.
 * Dabs wrap round the edges, so a painted texture tiles without a seam.
 */

/** RGBA, straight alpha, row-major from the top left. Painted rasters are opaque. */
export interface Raster {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/** A rectangle in texels. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A point in texels. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A random stream: each call gives the next number in [0, 1). */
export type Rand = () => number;

/** An opaque raster of one 0xRRGGBB colour. */
export function raster(width: number, height: number, fill: number): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  const r = (fill >> 16) & 255;
  const g = (fill >> 8) & 255;
  const b = fill & 255;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

/** A seeded stream (mulberry32): the same seed gives the same numbers. */
export function rng(seed: number): Rand {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `hex` with each channel times `f`, clamped. */
export function shade(hex: number, f: number): number {
  const ch = (v: number): number => Math.max(0, Math.min(255, Math.round(v * f)));
  return (ch((hex >> 16) & 255) << 16) | (ch((hex >> 8) & 255) << 8) | ch(hex & 255);
}

/** `hex` moved toward `to` by `t`. */
export function mix(hex: number, to: number, t: number): number {
  const ch = (s: number): number => {
    const a = (hex >> s) & 255;
    const b = (to >> s) & 255;
    return Math.round(a + (b - a) * t);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

function wrap(v: number, size: number): number {
  return v < 0 || v >= size ? ((v % size) + size) % size : v;
}

/** Lays `colour` over the texel at byte offset `i` with `alpha`. */
function blend(data: Uint8ClampedArray, i: number, colour: number, alpha: number): void {
  const r = data[i] ?? 0;
  const g = data[i + 1] ?? 0;
  const b = data[i + 2] ?? 0;
  data[i] = r + (((colour >> 16) & 255) - r) * alpha;
  data[i + 1] = g + (((colour >> 8) & 255) - g) * alpha;
  data[i + 2] = b + ((colour & 255) - b) * alpha;
}

/**
 * One soft round dab of `colour` at (`cx`, `cy`) with the given radius, laid
 * over what is there with `alpha`. The edge falls off over one texel. A dab
 * over an edge continues on the opposite side. With a `clip`, only texels
 * inside it (after wrapping) are touched.
 */
export function dab(
  target: Raster,
  cx: number,
  cy: number,
  radius: number,
  colour: number,
  alpha: number,
  clip?: Rect,
): void {
  const { width, height, data } = target;
  const reach = radius + 0.5;
  const reach2 = reach * reach;
  const yEnd = Math.ceil(cy + reach);
  const xEnd = Math.ceil(cx + reach);
  for (let y = Math.floor(cy - reach); y <= yEnd; y++) {
    const wy = wrap(y, height);
    if (clip && (wy < clip.y || wy >= clip.y + clip.h)) continue;
    const dy = y + 0.5 - cy;
    for (let x = Math.floor(cx - reach); x <= xEnd; x++) {
      const dx = x + 0.5 - cx;
      const d2 = dx * dx + dy * dy;
      if (d2 >= reach2) continue;
      const wx = wrap(x, width);
      if (clip && (wx < clip.x || wx >= clip.x + clip.w)) continue;
      blend(data, (wy * width + wx) * 4, colour, alpha * Math.min(1, reach - Math.sqrt(d2)));
    }
  }
}

/** The brush a stroke is laid with: its width in texels, colour and the alpha its body ends up with. */
export interface Brush {
  readonly width: number;
  readonly colour: number;
  readonly alpha: number;
}

/**
 * A stroke from `from` to `to` bent toward `via` (a quadratic curve), laid as
 * dabs a fraction of a radius apart. Each dab's alpha is chosen so the body
 * of the stroke, where dabs overlap, ends near the brush's alpha, not a
 * string of beads.
 */
export function stroke(
  target: Raster,
  from: Point,
  via: Point,
  to: Point,
  brush: Brush,
  clip?: Rect,
): void {
  const radius = brush.width / 2;
  const step = Math.max(0.5, radius * 0.4);
  const dabs = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / step));
  const alpha = 1 - Math.pow(1 - brush.alpha, Math.min(1, step / (2 * radius)));
  for (let i = 0; i <= dabs; i++) {
    const t = i / dabs;
    const u = 1 - t;
    dab(
      target,
      u * u * from.x + 2 * u * t * via.x + t * t * to.x,
      u * u * from.y + 2 * u * t * via.y + t * t * to.y,
      radius,
      brush.colour,
      alpha,
      clip,
    );
  }
}

/** Lays `colour` over the rectangle (rounded to texels, cut to the raster) with `alpha`. */
export function fillRect(target: Raster, rect: Rect, colour: number, alpha = 1): void {
  const { width, height, data } = target;
  const x0 = Math.max(0, Math.round(rect.x));
  const y0 = Math.max(0, Math.round(rect.y));
  const x1 = Math.min(width, Math.round(rect.x + rect.w));
  const y1 = Math.min(height, Math.round(rect.y + rect.h));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) blend(data, (y * width + x) * 4, colour, alpha);
  }
}

/** FNV-1a (32 bit) over the raster's bytes, as 8 hex digits. */
export function hashRaster(target: Raster): string {
  let h = 0x811c9dc5;
  for (const byte of target.data) {
    h = Math.imul(h ^ byte, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
