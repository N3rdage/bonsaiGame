// Generates the game's ambient music (backlog 7-c): one short seamless loop
// per key of MUSIC_KEYS in src/platform/audio.ts, mono 16-bit PCM WAVs at
// 11025 Hz, written to public/assets/audio/<key>.wav.
//
// No dependency and no encoder: each loop is a slow pad of sine chords under a
// soft LFO, with a little on top (chirps in the garden, a music box in the
// house). Seamless by construction: every frequency and LFO rate is snapped to
// a whole number of cycles per loop, chords cross-fade round the wrap, every
// note's tail wraps to the start, and the garden's breeze (noise, which has no
// period) is baked with a crossfade from the end into the start. Noise and
// note picks come from a seeded PRNG, so a rerun writes byte-identical files.
// Every loop is peak-normalised to the same level.
//
// Run with `npm run art:music`; the output is committed.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'assets', 'audio');

const RATE = 11025;
/** Every loop's length in seconds: 8 s at 11025 Hz is a whole 88200 samples. */
const LOOP_S = 8;
const N = RATE * LOOP_S;
/** Every loop's peak, as a fraction of full scale (the game turns music down further). */
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

/** The frequency of MIDI note `m`, snapped to a whole number of cycles per loop. */
function note(m) {
  return snap(440 * 2 ** ((m - 69) / 12));
}

/** `hz` rounded to a whole number of cycles per loop, so the waveform meets itself at the wrap. */
function snap(hz) {
  return Math.max(1, Math.round(hz * LOOP_S)) / LOOP_S;
}

function smooth(x) {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

/**
 * The weight of a segment `len` s long from `start`, round the loop: 1 inside,
 * with a smooth `xf` s crossfade centred on each edge (neighbours sum to 1).
 */
function segment(t, start, len, xf) {
  let d = (((t - start) % LOOP_S) + LOOP_S) % LOOP_S;
  if (d > LOOP_S - xf / 2) d -= LOOP_S;
  return Math.min(smooth((d + xf / 2) / xf), smooth((len - d + xf / 2) / xf));
}

/**
 * A pad: `chords` (lists of MIDI notes) share the loop equally and cross-fade
 * over `xf` s. Each note is a sine with `harmonics` (relative gains of 2f, 3f,
 * ...) and a chorus voice one cycle per loop sharp, under an LFO of `lfo`
 * cycles per loop.
 */
function pad(out, { chords, harmonics = [], gain = 1, lfo = 2, xf = 1.5 }) {
  const len = LOOP_S / chords.length;
  chords.forEach((chord, k) => {
    for (const m of chord) {
      const f = note(m);
      for (let i = 0; i < N; i += 1) {
        const t = i / RATE;
        const w = segment(t, k * len, len, xf);
        if (w === 0) continue;
        let v = Math.sin(TAU * f * t) + Math.sin(TAU * (f + 1 / LOOP_S) * t);
        harmonics.forEach((h, j) => {
          v += h * Math.sin(TAU * f * (j + 2) * t);
        });
        const swell = 1 + 0.2 * Math.sin((TAU * lfo * t) / LOOP_S + m);
        out[i] += (gain * w * swell * v) / chord.length;
      }
    }
  });
}

/** Adds a decaying note at `at` s whose tail wraps round to the loop's start. */
function pluck(out, { at, hz, decay, gain = 1, partials = [1], attackMs = 4, ms = 3000 }) {
  const start = Math.round(at * RATE);
  const n = Math.min(N, Math.round((RATE * ms) / 1000));
  for (let i = 0; i < n; i += 1) {
    const t = i / RATE;
    const f = typeof hz === 'function' ? hz(t) : hz;
    let v = 0;
    partials.forEach((p, j) => {
      v += p * Math.sin(TAU * f * (j === 0 ? 1 : j * 2 + 1) * t);
    });
    const env = Math.min(1, (t * 1000) / attackMs) * Math.exp(-t * decay);
    out[(start + i) % N] += gain * v * env;
  }
}

/** Low-passed noise for the loop, its end cross-faded into its start over `xfS` s. */
function breeze(out, { seed, hz, gain, xfS = 1 }) {
  const rand = prng(seed);
  const k = 1 - Math.exp((-TAU * hz) / RATE);
  const x = new Float64Array(N + Math.round(xfS * RATE));
  let y = 0;
  for (let i = 0; i < x.length; i += 1) {
    y += k * (rand() * 2 - 1 - y);
    x[i] = y;
  }
  const xf = x.length - N;
  for (let i = 0; i < N; i += 1) {
    const gust = 1 + 0.5 * Math.sin((TAU * i) / N);
    const v = i < xf ? (i / xf) * x[i] + (1 - i / xf) * x[N + i] : x[i];
    out[i] += gain * gust * v;
  }
}

/** The recipes, by key. */
const RECIPES = {
  // Warm and low: Fmaj7 to Dm9, rich in harmonics.
  shed: () => {
    const out = new Float64Array(N);
    pad(out, {
      chords: [
        [41, 53, 57, 60, 64],
        [38, 50, 53, 57, 64],
      ],
      harmonics: [0.35, 0.15, 0.06],
      lfo: 3,
    });
    return out;
  },
  // Airy: open sus2 chords up high over a breeze, with a few birdlike chirps.
  garden: () => {
    const out = new Float64Array(N);
    pad(out, {
      chords: [
        [62, 69, 76],
        [60, 67, 74],
        [65, 72, 79],
        [62, 69, 74],
      ],
      gain: 0.7,
      lfo: 4,
      xf: 1,
    });
    breeze(out, { seed: 31, hz: 500, gain: 1 });
    const rand = prng(47);
    for (const at of [0.9, 1.05, 3.3, 5.6, 5.72, 5.84]) {
      const base = 2600 + rand() * 900;
      pluck(out, {
        at,
        hz: (t) => base + 9000 * t - 120000 * t * t,
        decay: 40,
        gain: 0.4,
        ms: 90,
        attackMs: 8,
      });
    }
    return out;
  },
  // A quiet music box: bell notes on an A minor pentatonic over a soft pad.
  house: () => {
    const out = new Float64Array(N);
    pad(out, {
      chords: [
        [45, 57, 60, 64],
        [41, 53, 57, 60],
      ],
      gain: 0.5,
    });
    const tune = [81, 76, 79, 72, 74, 76, 69, 72, 76, 74, 72, 69];
    tune.forEach((m, i) => {
      pluck(out, { at: (i * LOOP_S) / tune.length, hz: note(m), decay: 2.2, gain: 0.35, partials: [1, 0.2] });
    });
    return out;
  },
  // Calm: a slow, pure Cmaj9 to Am9 with no harmonics.
  viewer: () => {
    const out = new Float64Array(N);
    pad(out, {
      chords: [
        [48, 55, 62, 64, 71],
        [45, 52, 60, 62, 67],
      ],
      lfo: 1,
      xf: 3,
    });
    return out;
  },
};

/** The samples peak-normalised to PEAK as 16-bit little-endian PCM in a WAV; no fades, so the loop stays seamless. */
function wav(samples) {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const scale = peak > 0 ? PEAK / peak : 0;
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => {
    const v = Math.round(s * scale * 32767);
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
