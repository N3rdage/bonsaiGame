// Generates the game's sound effects (backlog 7-b): short mono 16-bit PCM
// WAVs at 22050 Hz, one per key of SOUND_KEYS in src/platform/audio.ts,
// written to public/assets/audio/<key>.wav.
//
// No dependency and no encoder: each effect is a few lines of synthesis
// (sines, sweeps and filtered noise under an envelope). Noise comes from a
// seeded PRNG, so a rerun writes byte-identical files. Every effect is
// peak-normalised to the same level, so none is louder than the others.
//
// Run with `npm run art:sounds`; the output is committed.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'assets', 'audio');

const RATE = 22050;
/** Every effect's peak, as a fraction of full scale: quiet, and the same for all. */
const PEAK = 0.5;
const TAU = 2 * Math.PI;

/** mulberry32: a small seeded PRNG, uniform in [0, 1). */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `ms` of silence to fill. */
function buffer(ms) {
  return new Float64Array(Math.round((RATE * ms) / 1000));
}

/** White noise in -1..1 from a seeded PRNG. */
function noise(seed) {
  const rand = prng(seed);
  return () => rand() * 2 - 1;
}

/** A one-pole low-pass at `hz`: returns a function filtering one sample at a time. */
function lowPass(hz) {
  const k = 1 - Math.exp((-TAU * hz) / RATE);
  let y = 0;
  return (x) => {
    y += k * (x - y);
    return y;
  };
}

/** A one-pole high-pass at `hz`. */
function highPass(hz) {
  const lp = lowPass(hz);
  return (x) => x - lp(x);
}

/** A short linear fade-in over the first `ms`, so no effect starts with a click. */
function attack(t, ms) {
  return Math.min(1, (t * 1000) / ms);
}

/** Adds a decaying sine from `startMs`: `hz` may be a function of time for a sweep. */
function tone(out, { startMs = 0, ms, hz, decay, gain = 1, attackMs = 2 }) {
  const start = Math.round((RATE * startMs) / 1000);
  const n = Math.min(out.length - start, Math.round((RATE * ms) / 1000));
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / RATE;
    const f = typeof hz === 'function' ? hz(t) : hz;
    phase += (TAU * f) / RATE;
    out[start + i] += gain * Math.sin(phase) * Math.exp(-t * decay) * attack(t, attackMs);
  }
}

/** Adds filtered noise from `startMs` under a decaying envelope. */
function burst(out, { startMs = 0, ms, seed, decay, gain = 1, filter, attackMs = 1 }) {
  const start = Math.round((RATE * startMs) / 1000);
  const n = Math.min(out.length - start, Math.round((RATE * ms) / 1000));
  const white = noise(seed);
  for (let i = 0; i < n; i += 1) {
    const t = i / RATE;
    out[start + i] += gain * filter(white()) * Math.exp(-t * decay) * attack(t, attackMs);
  }
}

/** The recipes, by key. */
const RECIPES = {
  // A soft blip for every button tap.
  click: () => {
    const out = buffer(40);
    tone(out, { ms: 40, hz: 1200, decay: 110 });
    return out;
  },
  // A low thump with a little scuff on top.
  footstep: () => {
    const out = buffer(70);
    tone(out, { ms: 70, hz: (t) => 150 - 500 * t, decay: 55, attackMs: 3 });
    burst(out, { ms: 40, seed: 7, decay: 90, gain: 0.25, filter: lowPass(900) });
    return out;
  },
  // A low-passed pour with a few bubbles rising through it.
  water: () => {
    const out = buffer(450);
    const lp = lowPass(700);
    const white = noise(11);
    for (let i = 0; i < out.length; i += 1) {
      const t = i / RATE;
      const swell = Math.min(1, t / 0.05) * Math.min(1, (0.45 - t) / 0.15);
      out[i] += 0.6 * lp(white()) * swell;
    }
    const rand = prng(23);
    for (const startMs of [40, 120, 190, 280, 350]) {
      const base = 350 + rand() * 250;
      tone(out, {
        startMs,
        ms: 60,
        hz: (t) => base + 4000 * t,
        decay: 60,
        gain: 0.35,
        attackMs: 4,
      });
    }
    return out;
  },
  // Two quick bright ticks: the blades meeting.
  snip: () => {
    const out = buffer(120);
    burst(out, { ms: 30, seed: 3, decay: 220, filter: highPass(3000) });
    burst(out, { startMs: 60, ms: 30, seed: 5, decay: 260, gain: 0.8, filter: highPass(3500) });
    return out;
  },
  // A rising sine sweep: wire wound round a branch.
  wire: () => {
    const out = buffer(200);
    tone(out, { ms: 200, hz: (t) => 400 + (500 * t) / 0.2, decay: 12, attackMs: 6 });
    tone(out, { ms: 200, hz: (t) => 800 + (1000 * t) / 0.2, decay: 18, gain: 0.2, attackMs: 6 });
    return out;
  },
  // A wooden knock, then a short creak of the hinge.
  door: () => {
    const out = buffer(300);
    tone(out, { ms: 80, hz: 180, decay: 45 });
    burst(out, { ms: 40, seed: 13, decay: 120, gain: 0.4, filter: lowPass(1200) });
    tone(out, {
      startMs: 110,
      ms: 190,
      hz: (t) => 520 + 120 * Math.sin(TAU * 9 * t),
      decay: 9,
      gain: 0.25,
      attackMs: 20,
    });
    return out;
  },
  // Two sine notes, B5 then E6: a coin landing.
  coin: () => {
    const out = buffer(350);
    tone(out, { ms: 90, hz: 987.77, decay: 25, gain: 0.8 });
    tone(out, { startMs: 80, ms: 270, hz: 1318.51, decay: 11 });
    return out;
  },
};

/** The samples peak-normalised to PEAK, faded out over the last 5 ms, as 16-bit little-endian PCM in a WAV. */
function wav(samples) {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const scale = peak > 0 ? PEAK / peak : 0;
  const fade = Math.round(RATE * 0.005);
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => {
    const tail = Math.min(1, (samples.length - 1 - i) / fade);
    const v = Math.round(s * scale * tail * 32767);
    data.writeInt16LE(Math.max(-32768, Math.min(32767, v)), i * 2);
  });
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [key, recipe] of Object.entries(RECIPES)) {
  const bytes = wav(recipe());
  writeFileSync(join(OUT, `${key}.wav`), bytes);
  total += bytes.length;
  console.log(`${key}.wav ${String(bytes.length)} bytes`);
}
console.log(`total ${String(total)} bytes`);
