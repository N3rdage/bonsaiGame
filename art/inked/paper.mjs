// The paper: an integer hash, smooth value noise built on it, and the one
// paper grain every Inked sheet shares. The grain is a fixed texture, not a
// seeded one: it tiles every GRAIN_PERIOD art px (four 16 px tiles at 4 art
// px per logical px) and is sampled at world art-px coordinates, so two
// sheets laid side by side in the game continue the same sheet of paper.

/** The grain's repeat, in art px; every octave's cell divides it. */
export const GRAIN_PERIOD = 256;
const GRAIN_SEED = 1371;
/** The grain's octaves: [cell size in art px, weight]. Fine tooth, then fibre, then mottling. */
const OCTAVES = [
  [2, 0.45],
  [8, 0.35],
  [32, 0.2],
];

/** A deterministic hash of two integers and a seed, uniform in [0, 1). */
export function hash(x, y, seed) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Smooth value noise in [0, 1) at (x, y) with lattice cells `cell` wide. With
 * `period` (a multiple of `cell`) the lattice wraps, so the noise tiles.
 */
export function valueNoise(x, y, cell, seed, period = 0) {
  const fx = x / cell;
  const fy = y / cell;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const sx = (fx - x0) * (fx - x0) * (3 - 2 * (fx - x0));
  const sy = (fy - y0) * (fy - y0) * (3 - 2 * (fy - y0));
  const p = period / cell;
  const wrap = (i) => (p > 0 ? ((i % p) + p) % p : i);
  const at = (i, j) => hash(wrap(i), wrap(j), seed);
  const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
  const bottom = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
  return top * (1 - sy) + bottom * sy;
}

/** The paper grain at world art px (x, y), in [0, 1): 0 is smooth paper, 1 the deepest tooth. */
export function grain(x, y) {
  let g = 0;
  OCTAVES.forEach(([cell, weight], i) => {
    g += weight * valueNoise(x, y, cell, GRAIN_SEED + i, GRAIN_PERIOD);
  });
  return g;
}

/**
 * Darkens every pixel of `canvas` by the grain times `amount`, as paper's tooth
 * catches pigment; `origin` is the canvas's top-left in world art px.
 */
export function applyGrain(canvas, amount, [ox, oy] = [0, 0]) {
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const f = 1 - amount * grain(x + ox, y + oy);
      const t = (y * canvas.width + x) * 4;
      for (let j = 0; j < 3; j += 1) canvas.data[t + j] = Math.round(canvas.data[t + j] * f);
    }
  }
}
