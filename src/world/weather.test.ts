import { describe, expect, it } from 'vitest';
import { SEASONS } from '../sim/seasons';
import { seededRandom } from '../viewer/seededRandom';
import { GARDEN_ROOM } from './gardenRoom';
import { HALLWAY_ROOM } from './hallwayRoom';
import { LOUNGE_ROOM } from './loungeRoom';
import { SHED_ROOM } from './shedRoom';
import { STUDY_ROOM } from './studyRoom';
import {
  SHED_WEATHER_AREA,
  WEATHER_MARGIN,
  createParticles,
  isIndoor,
  particleDraw,
  stepParticles,
  weatherArea,
  weatherProfile,
  type Particle,
  type WeatherProfile,
} from './weather';

/** Each profile against scr_weather's numbers, halved where they are px. */
const PROFILES = {
  spring: ['petals', 28, [0.11, 0.25], [6, 13], [1, 2], [1.5, 2.5], 0.04, 0.85, 3],
  summer: ['fireflies', 14, [-0.04, 0.04], [5, 11], [0.8, 1.8], [1.25, 2], 0, 0.9, 2],
  autumn: ['leaves', 24, [0.12, 0.275], [8, 17], [1.2, 2.2], [2, 3.5], 0.05, 0.92, 4],
  winter: ['snow', 48, [0.14, 0.3], [4, 9], [0.8, 1.6], [1, 2], 0.03, 0.88, 2],
} as const;

const pin = (p: WeatherProfile) => [
  p.kind,
  p.count,
  p.fall,
  p.swayAmp,
  p.swaySpeed,
  p.size,
  p.wind,
  p.alpha,
  p.colours.length,
];

const particle = (over: Partial<Particle>): Particle => ({
  bx: 100,
  y: 50,
  vy: 0.2,
  amp: 10,
  phase: 0,
  spd: 1,
  ampy: 0,
  phasey: 0,
  spdy: 0,
  size: 2,
  rot: 0,
  rspd: 0,
  colour: 0xffffff,
  gph: 0,
  ...over,
});

describe('weatherProfile', () => {
  it('pins each season in the garden against the halved GML numbers', () => {
    for (const season of SEASONS) {
      expect(pin(weatherProfile(season, false))).toEqual(PROFILES[season]);
    }
    expect(weatherProfile('spring', false).colours).toEqual([0xffd6e0, 0xffbed4, 0xfae2e9]);
    expect(weatherProfile('summer', false).colours).toEqual([0xd6f08c, 0xe8f6a5]);
    expect(weatherProfile('autumn', false).colours).toEqual([
      0xd25a28, 0xe68c28, 0xb2441e, 0xa0702a,
    ]);
    expect(weatherProfile('winter', false).colours).toEqual([0xffffff, 0xe2ecf6]);
    expect(weatherProfile('spring', false)).toMatchObject({
      rotating: true,
      hover: false,
      glow: false,
    });
    expect(weatherProfile('autumn', false)).toMatchObject({ rotating: true, hover: false });
    expect(weatherProfile('summer', false)).toMatchObject({
      rotating: false,
      hover: true,
      glow: true,
    });
    expect(weatherProfile('winter', false)).toMatchObject({
      rotating: false,
      hover: false,
      glow: false,
    });
  });

  it('gives the shed its dust motes whatever the season', () => {
    for (const season of SEASONS) {
      const p = weatherProfile(season, true);
      expect(pin(p)).toEqual([
        'motes',
        10,
        [0.02, 0.07],
        [1.5, 4.5],
        [0.6, 1.4],
        [0.75, 1.5],
        0.015,
        0.28,
        1,
      ]);
      expect(p).toMatchObject({ hover: true, glow: true, rotating: false, colours: [0xe8e2c8] });
    }
  });
});

describe('weatherArea', () => {
  it('is the halved wall ring in the shed and the whole room in the garden', () => {
    expect(weatherArea(SHED_ROOM)).toEqual({ x0: 80, y0: 48, x1: 384, y1: 208 });
    expect(weatherArea(SHED_ROOM)).toEqual(SHED_WEATHER_AREA);
    expect(weatherArea(GARDEN_ROOM)).toEqual({ x0: 0, y0: 0, x1: 480, y1: 270 });
    expect(WEATHER_MARGIN).toBe(12);
  });

  it("gives the lounge, hallway and study the shed's indoor motes over each room's own ring", () => {
    expect(isIndoor(SHED_ROOM)).toBe(true);
    expect(isIndoor(GARDEN_ROOM)).toBe(false);
    for (const [room, area] of [
      [LOUNGE_ROOM, { x0: 48, y0: 80, x1: 416, y1: 208 }],
      [HALLWAY_ROOM, { x0: 80, y0: 160, x1: 384, y1: 208 }],
      [STUDY_ROOM, { x0: 128, y0: 80, x1: 336, y1: 208 }],
    ] as const) {
      expect(isIndoor(room)).toBe(true);
      expect(weatherArea(room)).toEqual(area);
    }
  });
});

describe('createParticles', () => {
  const area = SHED_WEATHER_AREA;

  it('scatters count particles over the area within the profile ranges', () => {
    for (const [season, indoor] of [
      ['spring', false],
      ['summer', false],
      ['autumn', false],
      ['winter', false],
      ['spring', true],
    ] as const) {
      const profile = weatherProfile(season, indoor);
      const rng = seededRandom(7);
      const parts = createParticles(profile, area, () => rng.next());
      expect(parts).toHaveLength(profile.count);
      const within = (v: number, [lo, hi]: readonly [number, number]) => v >= lo && v <= hi;
      for (const p of parts) {
        expect(within(p.bx, [area.x0, area.x1]) && within(p.y, [area.y0, area.y1])).toBe(true);
        expect(within(p.vy, profile.fall)).toBe(true);
        expect(within(p.amp, profile.swayAmp)).toBe(true);
        expect(within(p.spd, profile.swaySpeed)).toBe(true);
        expect(within(p.size, profile.size)).toBe(true);
        expect(profile.colours).toContain(p.colour);
        if (profile.rotating) expect(within(p.rspd, [-1.6, 1.6])).toBe(true);
        else expect(p.rspd).toBe(0);
        if (!profile.hover) expect([p.ampy, p.spdy]).toEqual([0, 0]);
      }
    }
  });

  it('gives hover kinds 0.7x the sway amplitude and 0.8x the sway speed vertically', () => {
    const motes = weatherProfile('winter', true);
    const [p] = createParticles(motes, area, () => 0.5);
    expect(p?.amp).toBe(3);
    expect(p?.ampy).toBeCloseTo(2.1);
    expect(p?.spd).toBe(1);
    expect(p?.spdy).toBeCloseTo(0.8);
    expect([p?.bx, p?.y, p?.phase, p?.gph]).toEqual([232, 128, 180, 180]);
  });

  it('defaults to Math.random', () => {
    expect(createParticles(weatherProfile('winter', false), area)).toHaveLength(48);
  });
});

describe('stepParticles', () => {
  const area = { x0: 0, y0: 0, x1: 100, y1: 100 };
  const profile = weatherProfile('spring', false);

  it('falls, drifts, sways, spins and advances the glow at half the sway speed', () => {
    const p = particle({ vy: 0.2, spd: 1.5, spdy: 0.4, rspd: -1 });
    stepParticles([p], profile, area);
    expect(p.y).toBeCloseTo(50.2);
    expect(p.bx).toBeCloseTo(100.04);
    expect(p).toMatchObject({ phase: 1.5, phasey: 0.4, rot: -1, gph: 0.75 });
  });

  it('wraps toroidally over the area plus the 12 px margin', () => {
    const below = particle({ y: 112, vy: 0.5, bx: 50 });
    const right = particle({ bx: 111.98, vy: 0 });
    const above = particle({ y: -12, vy: -0.5, bx: 50 });
    stepParticles([below, right, above], profile, area);
    expect(below.y).toBeCloseTo(112.5 - 124);
    expect(right.bx).toBeCloseTo(112.02 - 124);
    expect(above.y).toBeCloseTo(-12.5 + 124);
  });
});

describe('particleDraw', () => {
  it('sways x by sin(phase) and bobs y by sin(phasey), in degrees', () => {
    const d = particleDraw(
      particle({ phase: 90, amp: 10, phasey: 270, ampy: 4 }),
      weatherProfile('summer', true),
    );
    expect(d.x).toBeCloseTo(110);
    expect(d.y).toBeCloseTo(46);
  });

  it('pulses glow kinds by 0.55 + 0.45 sin(gph) and draws snow at the base alpha', () => {
    const motes = weatherProfile('spring', true);
    expect(particleDraw(particle({ gph: 90 }), motes).alpha).toBeCloseTo(0.28);
    expect(particleDraw(particle({ gph: 270 }), motes).alpha).toBeCloseTo(0.028);
    const snow = particleDraw(particle({ gph: 270, size: 1.5 }), weatherProfile('winter', false));
    expect(snow.alpha).toBe(0.88);
    expect(snow.shapes).toEqual([{ kind: 'circle', r: 1.5, alpha: 0.88 }]);
  });

  it('gives a firefly a halo at twice the size and 0.35 of the alpha under its core', () => {
    const d = particleDraw(particle({ gph: 90, size: 2 }), weatherProfile('summer', false));
    expect(d.shapes).toEqual([
      { kind: 'circle', r: 4, alpha: 0.9 * 0.35 },
      { kind: 'circle', r: 2, alpha: 0.9 },
    ]);
  });

  it('draws petals 0.5w x 0.8h and leaves 0.55w x 1h of the size, turned by rot', () => {
    const at = { bx: 10, y: 20, amp: 0, size: 4 };
    const petal = particleDraw(particle(at), weatherProfile('spring', false));
    expect(petal.shapes).toEqual([
      {
        kind: 'quad',
        alpha: 0.85,
        points: [
          { x: 8, y: 16.8 },
          { x: 12, y: 16.8 },
          { x: 12, y: 23.2 },
          { x: 8, y: 23.2 },
        ],
      },
    ]);
    const leaf = particleDraw(particle({ ...at, rot: 90 }), weatherProfile('autumn', false));
    const shape = leaf.shapes[0];
    if (shape?.kind !== 'quad') throw new Error('leaves are quads');
    // Turned a quarter: the 2.2 px half-width now runs down y, the 4 px half-height along x.
    const [first] = shape.points;
    expect(first.x).toBeCloseTo(14);
    expect(first.y).toBeCloseTo(17.8);
    expect(shape.alpha).toBe(0.92);
  });
});
