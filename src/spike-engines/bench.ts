/**
 * The benchmark (backlog #378): a fixed camera path both engines fly, as a
 * pure function of time, and the frame statistics they report. The path
 * walks the player from the front door through the side gate and round to
 * the shed, into it and back out, while the camera circles, dips and zooms,
 * so every occluder fades and the tree and the shadows are seen from all
 * sides.
 */

import type { OrbitState } from './orbit';

/** The full run's length, seconds. `?bench=<s>` shortens it for tests. */
export const BENCH_SECONDS = 20;

/** The player's route, site metres: front door landing, the gate, down the passage, across the back lawn and into the shed. */
export const BENCH_ROUTE: readonly { readonly x: number; readonly y: number }[] = [
  { x: 7, y: -0.8 },
  { x: 13.5, y: -1 },
  { x: 13.6, y: 2 },
  { x: 13.6, y: 5.2 },
  { x: 12, y: 6 },
  { x: 2.5, y: 9.5 },
  { x: 2.5, y: 7.2 },
  { x: 3, y: 6.9 },
  { x: 2.5, y: 9.5 },
];

function routeLength(): number[] {
  const out = [0];
  for (let i = 1; i < BENCH_ROUTE.length; i++) {
    const a = BENCH_ROUTE[i - 1];
    const b = BENCH_ROUTE[i];
    if (a && b) out.push((out[i - 1] ?? 0) + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return out;
}
const CUMULATIVE = routeLength();

/** Where the route is a fraction `f` (0..1) of the way along it. */
export function routePoint(f: number): { x: number; y: number } {
  const total = CUMULATIVE[CUMULATIVE.length - 1] ?? 0;
  const at = Math.min(1, Math.max(0, f)) * total;
  for (let i = 1; i < BENCH_ROUTE.length; i++) {
    const end = CUMULATIVE[i] ?? 0;
    const a = BENCH_ROUTE[i - 1];
    const b = BENCH_ROUTE[i];
    if (a && b && at <= end) {
      const start = CUMULATIVE[i - 1] ?? 0;
      const t = end > start ? (at - start) / (end - start) : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  const last = BENCH_ROUTE[BENCH_ROUTE.length - 1];
  return { x: last?.x ?? 0, y: last?.y ?? 0 };
}

/** The pose at `t` seconds into a run of `duration`: the same path at any duration, only faster. */
export function benchPose(
  t: number,
  duration = BENCH_SECONDS,
): { player: { x: number; y: number }; orbit: OrbitState } {
  const f = Math.min(1, Math.max(0, t / duration));
  const wave = Math.sin(f * Math.PI * 4);
  return {
    player: routePoint(f),
    // Two full turns, the pitch between 25 and 65 degrees, the distance between 5 and 13 m.
    orbit: {
      yaw: (f * 720) % 360,
      pitch: 45 + 20 * wave,
      distance: 9 + 4 * Math.cos(f * Math.PI * 6),
    },
  };
}

export interface FrameStats {
  readonly frames: number;
  readonly fps: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly worstMs: number;
}

/** The value `q` (0..1) of the way up the sorted list, nearest rank. */
function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[i] ?? 0;
}

/** Frame times (ms) as their count, mean frame rate, median, 95th percentile and worst. */
export function frameStats(deltas: readonly number[]): FrameStats {
  const sorted = [...deltas].sort((a, b) => a - b);
  const total = deltas.reduce((a, b) => a + b, 0);
  return {
    frames: deltas.length,
    fps: total > 0 ? (1000 * deltas.length) / total : 0,
    medianMs: quantile(sorted, 0.5),
    p95Ms: quantile(sorted, 0.95),
    worstMs: sorted[sorted.length - 1] ?? 0,
  };
}

export interface BenchResult extends FrameStats {
  readonly engine: string;
  readonly seconds: number;
  /** Draw calls a frame: the median over the run, and the most in one frame. */
  readonly drawCallsMedian: number;
  readonly drawCallsMax: number;
  readonly renderer: string;
  /** CSS px and device pixel ratio the run drew at. */
  readonly viewport: string;
}

/** A frame time series, frame times kept for the last `windowMs` of them. */
export class FrameWindow {
  private readonly deltas: number[] = [];
  private total = 0;

  constructor(private readonly windowMs = 3000) {}

  push(deltaMs: number): void {
    this.deltas.push(deltaMs);
    this.total += deltaMs;
    while (this.deltas.length > 1 && this.total - (this.deltas[0] ?? 0) >= this.windowMs) {
      this.total -= this.deltas.shift() ?? 0;
    }
  }

  stats(): FrameStats {
    return frameStats(this.deltas);
  }
}

const ms = (v: number): string => v.toFixed(1);

/** The result as the overlay shows it and the report quotes it. */
export function formatResult(r: BenchResult): string {
  return [
    `${r.engine}: ${String(r.seconds)} s camera path, ${String(r.frames)} frames`,
    `fps ${r.fps.toFixed(1)} | frame median ${ms(r.medianMs)} ms, p95 ${ms(r.p95Ms)} ms, worst ${ms(r.worstMs)} ms`,
    `draw calls median ${String(r.drawCallsMedian)}, max ${String(r.drawCallsMax)}`,
    `viewport ${r.viewport}`,
    `GPU ${r.renderer}`,
  ].join('\n');
}
