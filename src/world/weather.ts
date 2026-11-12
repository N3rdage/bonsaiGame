/**
 * Ambient seasonal weather (scr_weather, obj_weather): petals, fireflies,
 * leaves or snow in the garden, faint dust motes in the shed. Pure eye candy
 * derived from the season; nothing is persisted. Pure: no Phaser or DOM, and
 * the random numbers are injected. The scene steps the field and draws what
 * `particleDraw` returns.
 *
 * Every prototype distance, px-per-step speed, amplitude and size is halved
 * for the 480x270 canvas (`fromPrototype`); counts, alphas, colours and the
 * angular speeds (sway, spin, glow phase in degrees per step) are verbatim.
 */

import type { Season } from '../sim/seasons';
import { WALL_BAND, fromPrototype, type Room } from './shedRoom';

export type WeatherKind = 'motes' | 'petals' | 'fireflies' | 'leaves' | 'snow';

/** A `random_range` span, [min, max]. */
type Span = readonly [number, number];

export interface WeatherProfile {
  readonly kind: WeatherKind;
  readonly count: number;
  /** Fall speed, logical px per 60 Hz step (negative rises). */
  readonly fall: Span;
  /** Sway amplitude, logical px. */
  readonly swayAmp: Span;
  /** Sway phase speed, degrees per step. */
  readonly swaySpeed: Span;
  /** Radius, or quad height, in logical px. */
  readonly size: Span;
  /** Horizontal drift, logical px per step. */
  readonly wind: number;
  /** Petals and leaves spin. */
  readonly rotating: boolean;
  /** Hover kinds bob vertically as well as sway. */
  readonly hover: boolean;
  /** Glow kinds pulse their alpha. */
  readonly glow: boolean;
  readonly alpha: number;
  /** 0xRRGGBB; each particle picks one. */
  readonly colours: readonly number[];
}

const half = (lo: number, hi: number): Span => [fromPrototype(lo), fromPrototype(hi)];

const MOTES: WeatherProfile = {
  kind: 'motes',
  count: 10,
  fall: half(0.04, 0.14),
  swayAmp: half(3, 9),
  swaySpeed: [0.6, 1.4],
  size: half(1.5, 3),
  wind: fromPrototype(0.03),
  rotating: false,
  hover: true,
  glow: true,
  alpha: 0.28,
  colours: [0xe8e2c8],
};

const SEASONAL: Readonly<Record<Season, WeatherProfile>> = {
  spring: {
    kind: 'petals',
    count: 28,
    fall: half(0.22, 0.5),
    swayAmp: half(12, 26),
    swaySpeed: [1.0, 2.0],
    size: half(3, 5),
    wind: fromPrototype(0.08),
    rotating: true,
    hover: false,
    glow: false,
    alpha: 0.85,
    colours: [0xffd6e0, 0xffbed4, 0xfae2e9],
  },
  summer: {
    kind: 'fireflies',
    count: 14,
    fall: half(-0.08, 0.08),
    swayAmp: half(10, 22),
    swaySpeed: [0.8, 1.8],
    size: half(2.5, 4),
    wind: 0,
    rotating: false,
    hover: true,
    glow: true,
    alpha: 0.9,
    colours: [0xd6f08c, 0xe8f6a5],
  },
  autumn: {
    kind: 'leaves',
    count: 24,
    fall: half(0.24, 0.55),
    swayAmp: half(16, 34),
    swaySpeed: [1.2, 2.2],
    size: half(4, 7),
    wind: fromPrototype(0.1),
    rotating: true,
    hover: false,
    glow: false,
    alpha: 0.92,
    colours: [0xd25a28, 0xe68c28, 0xb2441e, 0xa0702a],
  },
  winter: {
    kind: 'snow',
    count: 48,
    fall: half(0.28, 0.6),
    swayAmp: half(8, 18),
    swaySpeed: [0.8, 1.6],
    size: half(2, 4),
    wind: fromPrototype(0.06),
    rotating: false,
    hover: false,
    glow: false,
    alpha: 0.88,
    colours: [0xffffff, 0xe2ecf6],
  },
};

/** weather_profile: the shed's dust motes whatever the season, else the season's weather. */
export function weatherProfile(season: Season, indoor: boolean): WeatherProfile {
  return indoor ? MOTES : SEASONAL[season];
}

export interface WeatherArea {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** The shed's wall ring, SHED_X0..SHED_Y1 (160, 96)..(768, 416), halved. */
export const SHED_WEATHER_AREA: WeatherArea = {
  x0: fromPrototype(160),
  y0: fromPrototype(96),
  x1: fromPrototype(768),
  y1: fromPrototype(416),
};

/** Spawn and wrap band just outside the area: the prototype's 24 px, halved. */
export const WEATHER_MARGIN = fromPrototype(24);

/** Whether a room has the indoor motes (every room but the garden, which has the season's weather; the glass greenhouse is indoors). */
export function isIndoor(room: Room): boolean {
  return room.key !== 'garden';
}

/** An indoor room's wall ring from its top-left corner tile to its bottom-right one (the shed's SHED_WEATHER_AREA), or the whole room for the garden. */
export function weatherArea(room: Room): WeatherArea {
  if (!isIndoor(room)) return { x0: 0, y0: 0, x1: room.width, y1: room.height };
  const { x, y, w, h } = room.bounds;
  return { x0: x, y0: y, x1: x + w - WALL_BAND, y1: y + h - WALL_BAND };
}

/** One particle (obj_weather's struct); angles in degrees. */
export interface Particle {
  /** Sway pivot x; the drawn x adds the sway. */
  bx: number;
  y: number;
  vy: number;
  amp: number;
  phase: number;
  spd: number;
  ampy: number;
  phasey: number;
  spdy: number;
  size: number;
  rot: number;
  rspd: number;
  colour: number;
  /** Glow phase. */
  gph: number;
}

/** obj_weather Create: `count` particles scattered over the whole area, so the field is full at once. */
export function createParticles(
  profile: WeatherProfile,
  area: WeatherArea,
  rng: () => number = Math.random,
): Particle[] {
  const range = ([lo, hi]: Span): number => lo + rng() * (hi - lo);
  const parts: Particle[] = [];
  for (let i = 0; i < profile.count; i += 1) {
    parts.push({
      bx: area.x0 + rng() * (area.x1 - area.x0),
      y: area.y0 + rng() * (area.y1 - area.y0),
      vy: range(profile.fall),
      amp: range(profile.swayAmp),
      phase: rng() * 360,
      spd: range(profile.swaySpeed),
      ampy: profile.hover ? range(profile.swayAmp) * 0.7 : 0,
      phasey: rng() * 360,
      spdy: profile.hover ? range(profile.swaySpeed) * 0.8 : 0,
      size: range(profile.size),
      rot: rng() * 360,
      rspd: profile.rotating ? range([-1.6, 1.6]) : 0,
      colour: profile.colours[Math.floor(rng() * profile.colours.length)] ?? 0xffffff,
      gph: rng() * 360,
    });
  }
  return parts;
}

/** obj_weather Step: fall, wind, sway, spin and glow, wrapping toroidally inside the area plus the margin. */
export function stepParticles(parts: Particle[], profile: WeatherProfile, area: WeatherArea): void {
  const loX = area.x0 - WEATHER_MARGIN;
  const hiX = area.x1 + WEATHER_MARGIN;
  const loY = area.y0 - WEATHER_MARGIN;
  const hiY = area.y1 + WEATHER_MARGIN;
  for (const p of parts) {
    p.y += p.vy;
    p.bx += profile.wind;
    p.phase += p.spd;
    p.phasey += p.spdy;
    p.rot += p.rspd;
    p.gph += p.spd * 0.5;
    if (p.bx < loX) p.bx += hiX - loX;
    else if (p.bx > hiX) p.bx -= hiX - loX;
    if (p.y < loY) p.y += hiY - loY;
    else if (p.y > hiY) p.y -= hiY - loY;
  }
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A quad's corners in order; drawn as the triangles 0-1-2 and 0-2-3. */
export type Quad = readonly [Point, Point, Point, Point];

export type WeatherShape =
  | { readonly kind: 'circle'; readonly r: number; readonly alpha: number }
  | { readonly kind: 'quad'; readonly points: Quad; readonly alpha: number };

/** What one particle draws this frame, in its colour, back to front. */
export interface ParticleDraw {
  readonly x: number;
  readonly y: number;
  readonly alpha: number;
  readonly colour: number;
  readonly shapes: readonly WeatherShape[];
}

const dsin = (deg: number): number => Math.sin((deg * Math.PI) / 180);
const dcos = (deg: number): number => Math.cos((deg * Math.PI) / 180);

/** weather_draw_quad: the corners of a (2hw x 2hh) rectangle about (x, y) turned by `ang` degrees. */
function quad(x: number, y: number, hw: number, hh: number, ang: number): Quad {
  const c = dcos(ang);
  const s = dsin(ang);
  const at = (u: number, v: number): Point => ({ x: x + u * c - v * s, y: y + u * s + v * c });
  return [at(-hw, -hh), at(hw, -hh), at(hw, hh), at(-hw, hh)];
}

/** obj_weather Draw for one particle: sway and bob, the glow pulse, and its shapes. */
export function particleDraw(p: Particle, profile: WeatherProfile): ParticleDraw {
  const x = p.bx + dsin(p.phase) * p.amp;
  const y = p.y + dsin(p.phasey) * p.ampy;
  const alpha = profile.glow ? profile.alpha * (0.55 + 0.45 * dsin(p.gph)) : profile.alpha;
  const shapes: WeatherShape[] =
    profile.kind === 'leaves'
      ? [{ kind: 'quad', points: quad(x, y, p.size * 0.55, p.size, p.rot), alpha }]
      : profile.kind === 'petals'
        ? [{ kind: 'quad', points: quad(x, y, p.size * 0.5, p.size * 0.8, p.rot), alpha }]
        : profile.kind === 'fireflies'
          ? [
              { kind: 'circle', r: p.size * 2, alpha: alpha * 0.35 },
              { kind: 'circle', r: p.size, alpha },
            ]
          : [{ kind: 'circle', r: p.size, alpha }];
  return { x, y, alpha, colour: p.colour, shapes };
}
