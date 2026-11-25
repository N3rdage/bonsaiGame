/**
 * The painted look's surfaces, made in code: brushwork on a canvas weave.
 * Each painter is a pure function of its parameters (colours, size in texels,
 * the tile's size in metres, a seed) and returns an opaque `Raster`; the same
 * parameters give the same bytes. Strokes are sized in centimetres on the
 * surface and converted through the texels per metre, so brushwork reads the
 * same at every texture size and stays wide enough to see at phone size.
 */

import { SURFACES } from '../look';
import {
  type Point,
  type Rand,
  type Raster,
  type Rect,
  dab,
  fillRect,
  mix,
  raster,
  rng,
  shade,
  stroke,
} from './raster';

/** The painters' sizes and numbers. Textures are square powers of two and repeat. */
export const PAINT = {
  /** Texture size in texels, per surface. */
  size: { wall: 512, floor: 512, tiles: 256 },
  /** What one texture spans, in metres across (u) and up or down (v). */
  metres: { wall: { u: 2, v: 2.4 }, floor: { u: 4, v: 4 }, tiles: { u: 2, v: 2 } },
  /** The default seed of each surface. */
  seed: { wall: 446, floor: 7, tiles: 99 },
  /** A brush stroke's width range in centimetres on the surface. */
  strokeWidthCm: [3, 7],
  /** A brush stroke's length range in centimetres on the surface. */
  strokeLengthCm: [10, 26],
  /** How many times over the strokes cover a filled area. */
  coverage: 2.4,
  /** How far a stroke may stray from its direction, in radians across its whole range. */
  strokeTilt: 0.5,
  /** A stroke's alpha range. */
  strokeAlpha: [0.35, 0.65],
  /** A stroke's tone: shaded across this range, then moved toward the warm or cool tint by up to `tint`. */
  strokeShade: [0.84, 1.14],
  warm: 0xffd8a0,
  cool: 0x6070a0,
  tint: 0.14,
  /** The canvas weave: a light thread every `pitch` texels across the rows, a dark one down the columns. */
  weave: { pitch: 3, light: 0.05, dark: 0.04 },
  wall: {
    /** Heights in metres of the skirting's top, the wainscot's top (under the rail) and the rail's top. */
    skirting: 0.13,
    wainscot: 0.92,
    rail: 0.97,
    boardCm: 12.5,
    seamCm: 0.8,
    highlightCm: 0.6,
    stripePitchCm: 25,
    stripeOffsetCm: 9.4,
    stripeWidthCm: 6.25,
    /** The motif's bands: the first row's height in metres, the pitch between rows, and the lowest height. */
    motifTop: 2.25,
    motifPitch: 0.1875,
    motifBottom: 1.05,
    /** Every other row is shifted along by this many centimetres. */
    motifShiftCm: 12.5,
    motifDabs: 14,
    motifRadiusCm: [1, 2.2],
    motifSpreadCm: { x: 3, y: 4 },
    motifTint: 0xe8d090,
  },
  wood: {
    rows: 32,
    plankLengthM: [1, 2.2],
    gapCm: 1.5,
    grainLines: 5,
    grainCm: 1.2,
    /** How far a grain line may stray across its plank, centimetres (4 texels at the default 128 a metre). */
    grainWobbleCm: 3.125,
    knotChance: 0.35,
    knotCm: 2.2,
  },
  tiles: {
    across: 8,
    groutCm: 1.6,
    /** The colour every other tile is moved toward. */
    checker: 0x2e4a5a,
  },
} as const;

/** Texels per metre across (u) and up or down (v). */
export interface Scale {
  readonly u: number;
  readonly v: number;
}

/** What every painter takes: the texture's size in texels, what it spans in metres, and a seed. */
export interface SurfaceParams {
  readonly size: number;
  readonly metresU: number;
  readonly metresV: number;
  readonly seed: number;
}

export interface WallParams extends SurfaceParams {
  readonly paper: number;
  readonly motif: number;
  readonly wainscot: number;
  readonly rail: number;
  readonly skirting: number;
}

export interface WoodParams extends SurfaceParams {
  readonly plank: number;
  readonly gap: number;
  readonly worn: number;
}

export interface TilesParams extends SurfaceParams {
  readonly tile: number;
  readonly grout: number;
}

export const WALL_DEFAULTS: WallParams = {
  size: PAINT.size.wall,
  metresU: PAINT.metres.wall.u,
  metresV: PAINT.metres.wall.v,
  seed: PAINT.seed.wall,
  ...SURFACES.walls,
};

export const WOOD_DEFAULTS: WoodParams = {
  size: PAINT.size.floor,
  metresU: PAINT.metres.floor.u,
  metresV: PAINT.metres.floor.v,
  seed: PAINT.seed.floor,
  ...SURFACES.floor,
};

export const TILES_DEFAULTS: TilesParams = {
  size: PAINT.size.tiles,
  metresU: PAINT.metres.tiles.u,
  metresV: PAINT.metres.tiles.v,
  seed: PAINT.seed.tiles,
  ...SURFACES.tiles,
};

/** Texels per metre of a surface's texture. */
export function texelsPerMetre(p: SurfaceParams): Scale {
  return { u: p.size / p.metresU, v: p.size / p.metresV };
}

/** `centimetres` on the surface in texels, at `perMetre` texels to the metre. */
function texels(centimetres: number, perMetre: number): number {
  return (centimetres / 100) * perMetre;
}

function between(range: readonly [number, number], t: number): number {
  return range[0] + (range[1] - range[0]) * t;
}

/** Whole texels for a feature `centimetres` thick, never less than one. */
function thickness(centimetres: number, perMetre: number): number {
  return Math.max(1, Math.round(texels(centimetres, perMetre)));
}

/** The canvas weave over the whole raster: light threads along rows and dark ones down columns. */
export function paintWeave(target: Raster, strength = 1): void {
  const { pitch, light, dark } = PAINT.weave;
  for (let y = 0; y < target.height; y += pitch) {
    fillRect(target, { x: 0, y, w: target.width, h: 1 }, 0xffffff, light * strength);
  }
  for (let x = 0; x < target.width; x += pitch) {
    fillRect(target, { x, y: 0, w: 1, h: target.height }, 0x000000, dark * strength);
  }
}

/**
 * Fills `area` with `colour` and builds it up with short, jittered round
 * brush strokes along `dir`, each a little lighter or darker and warmed or
 * cooled. Strokes stay inside the area.
 */
export function paintBrushFill(
  target: Raster,
  rand: Rand,
  area: Rect,
  colour: number,
  dir: 'h' | 'v',
  scale: Scale,
): void {
  fillRect(target, area, colour);
  const along = dir === 'h' ? scale.u : scale.v;
  const across = dir === 'h' ? scale.v : scale.u;
  const meanLength = texels((PAINT.strokeLengthCm[0] + PAINT.strokeLengthCm[1]) / 2, along);
  const meanWidth = texels((PAINT.strokeWidthCm[0] + PAINT.strokeWidthCm[1]) / 2, across);
  const count = Math.ceil((area.w * area.h * PAINT.coverage) / (meanLength * meanWidth));
  const base = dir === 'h' ? 0 : Math.PI / 2;
  for (let i = 0; i < count; i++) {
    const cx = area.x + rand() * area.w;
    const cy = area.y + rand() * area.h;
    const length = texels(between(PAINT.strokeLengthCm, rand()), along);
    const angle = base + (rand() - 0.5) * PAINT.strokeTilt;
    const tone = mix(
      shade(colour, between(PAINT.strokeShade, rand())),
      rand() < 0.5 ? PAINT.warm : PAINT.cool,
      rand() * PAINT.tint,
    );
    const alpha = between(PAINT.strokeAlpha, rand());
    const width = texels(between(PAINT.strokeWidthCm, rand()), across);
    const dx = (Math.cos(angle) * length) / 2;
    const dy = (Math.sin(angle) * length) / 2;
    const via: Point = {
      x: cx + (rand() - 0.5) * width * 0.5,
      y: cy + (rand() - 0.5) * width * 0.5,
    };
    stroke(
      target,
      { x: cx - dx, y: cy - dy },
      via,
      { x: cx + dx, y: cy + dy },
      { width, colour: tone, alpha },
      area,
    );
  }
}

/**
 * Striped wallpaper with a motif of leaf dabs over a wainscot of painted
 * boards, a dado rail and a skirting, on the weave. Wall texture rows run
 * from the floor at the bottom to the top of the wall at the top.
 */
export function paintWallpaper(params: Partial<WallParams> = {}): Raster {
  const p = { ...WALL_DEFAULTS, ...params };
  const w = PAINT.wall;
  const scale = texelsPerMetre(p);
  const rand = rng(p.seed);
  const out = raster(p.size, p.size, p.paper);
  const row = (z: number): number => Math.round(p.size - (z / p.metresV) * p.size);
  const column = (cmAlong: number): number => texels(cmAlong, scale.u);

  const paperBand: Rect = { x: 0, y: 0, w: p.size, h: row(w.rail) };
  paintBrushFill(out, rand, paperBand, p.paper, 'v', scale);
  const stripe = mix(p.paper, p.motif, 0.55);
  const pitch = column(w.stripePitchCm);
  for (let x = column(w.stripeOffsetCm); x < p.size; x += pitch) {
    const area: Rect = {
      x: Math.round(x),
      y: 0,
      w: Math.round(column(w.stripeWidthCm)),
      h: paperBand.h,
    };
    paintBrushFill(out, rand, area, stripe, 'v', scale);
  }
  const leaf = mix(p.motif, w.motifTint, 0.35);
  for (let k = 0; w.motifTop - k * w.motifPitch > w.motifBottom; k++) {
    const gy = row(w.motifTop - k * w.motifPitch);
    const shift = k % 2 === 0 ? 0 : column(w.motifShiftCm);
    for (let x = 0; x < p.size; x += pitch) {
      for (let d = 0; d < w.motifDabs; d++) {
        const ox = x + shift + (rand() - 0.5) * column(w.motifSpreadCm.x);
        const oy = gy + (rand() - 0.5) * texels(w.motifSpreadCm.y, scale.v);
        const radius = texels(between(w.motifRadiusCm, rand()), scale.u);
        dab(out, ox, oy, radius, leaf, 0.5, paperBand);
      }
    }
  }

  const board = column(w.boardCm);
  const woodTop = row(w.wainscot);
  const woodBottom = row(w.skirting);
  const seam = thickness(w.seamCm, scale.u);
  for (let x = 0; x < p.size; x += board) {
    const tone = shade(p.wainscot, 0.95 + rand() * 0.1);
    const area = { x: Math.round(x), y: woodTop, w: Math.round(board), h: woodBottom - woodTop };
    paintBrushFill(out, rand, area, tone, 'v', scale);
    fillRect(out, { ...area, w: seam }, shade(p.wainscot, 0.7), 0.8);
  }
  const lift = thickness(w.highlightCm, scale.v);
  const railTop = row(w.rail);
  const rail: Rect = { x: 0, y: railTop, w: p.size, h: woodTop - railTop };
  paintBrushFill(out, rand, rail, p.rail, 'h', scale);
  fillRect(out, { ...rail, h: lift }, shade(p.rail, 1.25), 0.6);
  const skirting: Rect = { x: 0, y: woodBottom, w: p.size, h: p.size - woodBottom };
  paintBrushFill(out, rand, skirting, p.skirting, 'h', scale);
  fillRect(out, { ...skirting, h: lift }, shade(p.skirting, 1.3), 0.6);

  paintWeave(out);
  return out;
}

/** Oak planks in staggered lengths, each its own tone with grain lines and the odd knot, and dark gaps between. */
export function paintWood(params: Partial<WoodParams> = {}): Raster {
  const p = { ...WOOD_DEFAULTS, ...params };
  const w = PAINT.wood;
  const scale = texelsPerMetre(p);
  const rand = rng(p.seed);
  const out = raster(p.size, p.size, p.plank);
  const rowHeight = p.size / w.rows;
  const gapU = thickness(w.gapCm, scale.u);
  const gapV = thickness(w.gapCm, scale.v);
  for (let r = 0; r < w.rows; r++) {
    const top = Math.round(r * rowHeight);
    const height = Math.round((r + 1) * rowHeight) - top;
    // Each row's joints start at its own offset and its last plank wraps
    // round the edge, so the repeat never lines every row's joint up at u 0.
    const offset = Math.floor(rand() * p.size);
    let x = offset;
    while (x < offset + p.size) {
      const length = Math.round(Math.max(1, scale.u * between(w.plankLengthM, rand())));
      const end = Math.min(offset + p.size, x + length);
      const tone = mix(shade(p.plank, 0.84 + rand() * 0.26), p.worn, rand() * 0.25);
      const parts =
        x >= p.size
          ? [{ from: x - p.size, to: end - p.size }]
          : end > p.size
            ? [
                { from: x, to: p.size },
                { from: 0, to: end - p.size },
              ]
            : [{ from: x, to: end }];
      for (const { from, to } of parts) {
        const area: Rect = { x: from, y: top, w: to - from, h: height };
        paintBrushFill(out, rand, area, tone, 'h', scale);
        for (let g = 0; g < w.grainLines; g++) {
          const gy = top + (0.15 + rand() * 0.7) * height;
          stroke(
            out,
            { x: from, y: gy },
            { x: from + area.w / 2, y: gy + (rand() - 0.5) * texels(w.grainWobbleCm, scale.v) },
            { x: to, y: gy },
            { width: texels(w.grainCm, scale.v), colour: shade(tone, 0.78), alpha: 0.25 },
            area,
          );
        }
      }
      const piece = parts[0];
      if (piece && rand() < w.knotChance) {
        const kx = piece.from + (0.2 + rand() * 0.6) * (piece.to - piece.from);
        const ky = top + height / 2 + (rand() - 0.5) * height * 0.3;
        const radius = texels(w.knotCm, scale.v);
        const area: Rect = { x: piece.from, y: top, w: piece.to - piece.from, h: height };
        dab(out, kx, ky, radius, shade(tone, 0.7), 0.35, area);
        dab(out, kx, ky, radius / 2, shade(tone, 0.6), 0.5, area);
      }
      fillRect(out, { x: x % p.size, y: top, w: gapU, h: height }, p.gap);
      x = end;
    }
    fillRect(out, { x: 0, y: top, w: p.size, h: gapV }, p.gap);
  }
  paintWeave(out, 0.8);
  return out;
}

/** A chequer of tiles, every other one cooler and darker, each tone-shifted and brushed, with grout between. */
export function paintTiles(params: Partial<TilesParams> = {}): Raster {
  const p = { ...TILES_DEFAULTS, ...params };
  const t = PAINT.tiles;
  const scale = texelsPerMetre(p);
  const rand = rng(p.seed);
  const out = raster(p.size, p.size, p.grout);
  const cell = p.size / t.across;
  const inset = Math.max(1, Math.round(thickness(t.groutCm, scale.u) / 2));
  for (let i = 0; i < t.across; i++) {
    for (let j = 0; j < t.across; j++) {
      const base = (i + j) % 2 === 1 ? mix(p.tile, t.checker, 0.75) : p.tile;
      const x = Math.round(i * cell) + inset;
      const y = Math.round(j * cell) + inset;
      const area: Rect = {
        x,
        y,
        w: Math.round((i + 1) * cell) - inset - x,
        h: Math.round((j + 1) * cell) - inset - y,
      };
      paintBrushFill(out, rand, area, shade(base, 0.9 + rand() * 0.16), 'h', scale);
    }
  }
  paintWeave(out);
  return out;
}
