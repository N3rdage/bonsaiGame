import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../sim/types';
import {
  DEFAULT_DISTANCE,
  DEFAULT_PITCH,
  DEFAULT_YAW,
  FOV_DEGREES,
  ZOOM_MAX,
  cameraEye,
  targetZForTree,
  type OrbitCamera,
} from './camera';
import {
  BACKDROP_CSS_PX_PER_TEXEL,
  BACKDROP_MEAN_RGB,
  BACKDROP_TEXTURE_PX,
  GROUND_DISC_PX,
  GROUND_GAP,
  GROUND_HALF,
  GROUND_RADIUS,
  GROUND_TEXTURE_SIZE,
  POT_RIM_RADIUS,
  backdropTint,
  groundShadowPx,
  groundTexturePx,
  groundZ,
  potShadow,
  shadowOffset,
} from './ground';
import { FOOT_H, POT_DEPTH } from './potGeometry';
import { LIGHT_DIRECTION, SURROUND_RGB } from './toon';

const here = (file: string): string => new URL(file, import.meta.url).pathname;

/** An 8-bit RGB or RGBA, non-interlaced PNG's pixels, as `art/inked/canvas.mjs` writes them. */
function readPng(file: string): {
  width: number;
  height: number;
  channels: number;
  data: Uint8Array;
} {
  const bytes = readFileSync(file);
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[12] !== 0) throw new Error('only 8-bit, non-interlaced PNGs');
      channels = body[9] === 6 ? 4 : body[9] === 2 ? 3 : 0;
      if (channels === 0) throw new Error('only RGB or RGBA PNGs');
    } else if (type === 'IDAT') idat.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x] ?? 0;
      const a = x >= channels ? (data[y * stride + x - channels] ?? 0) : 0;
      const b = y > 0 ? (data[(y - 1) * stride + x] ?? 0) : 0;
      const c = x >= channels && y > 0 ? (data[(y - 1) * stride + x - channels] ?? 0) : 0;
      let predicted = 0;
      if (filter === 1) predicted = a;
      else if (filter === 2) predicted = b;
      else if (filter === 3) predicted = Math.floor((a + b) / 2);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      data[y * stride + x] = (v + predicted) & 0xff;
    }
  }
  return { width, height, channels, data };
}

describe('the ground', () => {
  it('is comfortably wider than the pot', () => {
    expect(POT_RIM_RADIUS).toBeCloseTo(0.456, 12);
    expect(GROUND_RADIUS).toBeCloseTo(1.6 * POT_RIM_RADIUS, 12);
  });

  it('lies just under the pot base, the footed pot standing taller', () => {
    expect(groundZ(0)).toBeCloseTo(-POT_DEPTH - GROUND_GAP, 12);
    expect(groundZ(1)).toBeCloseTo(-POT_DEPTH - FOOT_H - GROUND_GAP, 12);
    expect(GROUND_GAP).toBeGreaterThan(0);
    expect(GROUND_GAP).toBeLessThan(0.01);
  });

  it('lays its texture so the drawn disc lands at the ground radius', () => {
    expect(GROUND_TEXTURE_SIZE).toBe(64);
    expect(GROUND_DISC_PX).toBe(29);
    expect(groundTexturePx(0, 0)).toEqual({ px: 32, py: 32 });
    expect(groundTexturePx(GROUND_RADIUS, 0).px).toBeCloseTo(32 + GROUND_DISC_PX, 9);
    expect(groundTexturePx(0, GROUND_RADIUS).py).toBeCloseTo(32 - GROUND_DISC_PX, 9);
    expect(groundTexturePx(GROUND_HALF, -GROUND_HALF)).toEqual({ px: 64, py: 64 });
  });

  it('is a 256 art px, power-of-two, cut-out texture', () => {
    const png = readPng(here('./ground.png'));
    expect(png.width).toBe(GROUND_TEXTURE_SIZE * 4);
    expect(png.height).toBe(GROUND_TEXTURE_SIZE * 4);
    expect(png.channels).toBe(4);
    // The corners are cut away, the centre is opaque.
    expect(png.data[3]).toBe(0);
    const centre = ((png.height / 2) * png.width + png.width / 2) * 4 + 3;
    expect(png.data[centre]).toBe(255);
  });
});

describe('the pot shadow', () => {
  it('falls away from the light, further for a higher point', () => {
    const low = shadowOffset(0.1);
    const high = shadowOffset(0.2);
    expect(low.x * LIGHT_DIRECTION.x + low.y * LIGHT_DIRECTION.y).toBeLessThan(0);
    expect(high.x).toBeCloseTo(2 * low.x, 12);
    expect(high.y).toBeCloseTo(2 * low.y, 12);
    expect(low.z).toBe(0);
    expect(shadowOffset(0)).toEqual({ x: -0, y: -0, z: 0 });
  });

  it('follows the slope of the light', () => {
    const offset = shadowOffset(1.6, { x: 1, y: 0.4, z: 1.6 });
    expect(offset.x).toBeCloseTo(-1, 12);
    expect(offset.y).toBeCloseTo(-0.4, 12);
    expect(() => shadowOffset(1, { x: 1, y: 0, z: 0 })).toThrow();
  });

  it('pools round the pot, centred where its mid-height falls', () => {
    const pool = potShadow();
    const offset = shadowOffset(POT_DEPTH / 2);
    expect(pool.x).toBeCloseTo(offset.x, 12);
    expect(pool.y).toBeCloseTo(offset.y, 12);
    expect(pool.radius).toBeGreaterThan(POT_RIM_RADIUS);
    expect(Math.hypot(pool.x, pool.y) + pool.radius).toBeLessThan(GROUND_RADIUS);
  });

  it('pins the pool art/inked/viewer.mjs draws', () => {
    expect(groundShadowPx()).toEqual({ cx: 31.66, cy: 34.36, r: 20.51 });
    const generator = readFileSync(here('../../art/inked/viewer.mjs'), 'utf8');
    expect(generator).toContain('shadow: { cx: 31.66, cy: 34.36, r: 20.51 }');
    expect(generator).toContain(`size: ${String(GROUND_TEXTURE_SIZE)},`);
    expect(generator).toContain(`disc: ${String(GROUND_DISC_PX)},`);
  });
});

describe('the backdrop', () => {
  it('is one grain period, shown a texel to a CSS pixel', () => {
    expect(BACKDROP_TEXTURE_PX).toBe(256);
    expect(BACKDROP_CSS_PX_PER_TEXEL).toBe(1);
  });

  it('pins the mean of the texture as drawn', () => {
    const png = readPng(here('./backdrop.png'));
    expect(png.width).toBe(BACKDROP_TEXTURE_PX);
    expect(png.height).toBe(BACKDROP_TEXTURE_PX);
    const sum = [0, 0, 0];
    for (let i = 0; i < png.data.length; i += png.channels) {
      for (let c = 0; c < 3; c++) sum[c] = (sum[c] ?? 0) + (png.data[i + c] ?? 0);
    }
    const n = png.width * png.height;
    const [r, g, b] = sum.map((s) => Math.round(s / n));
    expect({ r, g, b }).toEqual(BACKDROP_MEAN_RGB);
  });

  it('is tinted so its mean lands on the surround', () => {
    const tint = backdropTint();
    expect(BACKDROP_MEAN_RGB.r * tint.r).toBeCloseTo(SURROUND_RGB.r, 9);
    expect(BACKDROP_MEAN_RGB.g * tint.g).toBeCloseTo(SURROUND_RGB.g, 9);
    expect(BACKDROP_MEAN_RGB.b * tint.b).toBeCloseTo(SURROUND_RGB.b, 9);
    for (const k of [tint.r, tint.g, tint.b]) {
      expect(k).toBeGreaterThan(0);
      expect(k).toBeLessThan(1);
    }
    expect(() => backdropTint({ r: 0, g: 1, b: 1 })).toThrow();
  });
});

/** Whether world point `p` (tree space; the mirror does not change what fits) lies inside the view of `cam` at `aspect`. */
function inView(cam: OrbitCamera, aspect: number, p: Vec3): boolean {
  const eye = cameraEye(cam);
  const f = { x: cam.target.x - eye.x, y: cam.target.y - eye.y, z: cam.target.z - eye.z };
  const fl = Math.hypot(f.x, f.y, f.z);
  const fw = { x: f.x / fl, y: f.y / fl, z: f.z / fl };
  const right = { x: fw.y, y: -fw.x, z: 0 };
  const rl = Math.hypot(right.x, right.y);
  const rt = { x: right.x / rl, y: right.y / rl, z: 0 };
  const up = {
    x: rt.y * fw.z - rt.z * fw.y,
    y: rt.z * fw.x - rt.x * fw.z,
    z: rt.x * fw.y - rt.y * fw.x,
  };
  const d = { x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z };
  const depth = d.x * fw.x + d.y * fw.y + d.z * fw.z;
  const sx = d.x * rt.x + d.y * rt.y + d.z * rt.z;
  const sy = d.x * up.x + d.y * up.y + d.z * up.z;
  const t = Math.tan(((FOV_DEGREES / 2) * Math.PI) / 180);
  return depth > 0 && Math.abs(sy / depth) <= t && Math.abs(sx / depth) <= t * aspect;
}

describe('the ground in frame', () => {
  // The desktop project's 16:9 and the S22 landscape's 824 x 384.
  const aspects = [1280 / 720, 824 / 384];
  const rim = Array.from({ length: 72 }, (_, i) => (i / 72) * 2 * Math.PI);

  it('fits whole at the default and the farthest zoom, a 25 cm tree in either pot', () => {
    for (const distance of [DEFAULT_DISTANCE, ZOOM_MAX]) {
      for (const tier of [0, 1] as const) {
        const cam: OrbitCamera = {
          yaw: DEFAULT_YAW,
          pitch: DEFAULT_PITCH,
          distance,
          target: { x: 0, y: 0, z: targetZForTree(25) },
        };
        for (const aspect of aspects) {
          for (const a of rim) {
            const p = {
              x: Math.cos(a) * GROUND_RADIUS,
              y: Math.sin(a) * GROUND_RADIUS,
              z: groundZ(tier),
            };
            expect(inView(cam, aspect, p)).toBe(true);
          }
        }
      }
    }
  });
});
