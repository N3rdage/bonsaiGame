/**
 * The on-screen benchmark behind the menu's Benchmark row (Settings, 3D world
 * on): once the room has settled it flies the camera along a fixed path for
 * `RUN_S` seconds (two sweeps round the room, in close and out wide, up and
 * down), records every frame's time and draw calls, and reduces them to fps,
 * median, p95 and worst frame ms and draw calls. Pure: the page's size, pixel
 * ratio and user agent are passed in, and the panel that shows the result is
 * src/world3d/benchPanel.ts.
 */

/** Seconds the camera holds the path's start before frames are counted, so the room's first draws are not. */
export const WARMUP_S = 2;
/** Seconds of frames counted. */
export const RUN_S = 12;

/** What the page contributes to a result: the canvas's render size, pixel ratio, user agent and the room the run ended in. */
export interface BenchEnv {
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  readonly userAgent: string;
  readonly room: string;
}

export interface BenchResult extends BenchEnv {
  readonly frames: number;
  readonly fps: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly worstMs: number;
  /** Mean and largest draw calls a frame. */
  readonly drawCalls: number;
  readonly drawCallsMax: number;
}

export interface BenchPose {
  readonly alpha: number;
  readonly beta: number;
  readonly radius: number;
}

/** The camera on the fixed path at `t` seconds in: alpha, beta and radius about the rig's default. */
export function benchCamera(t: number): BenchPose {
  const k = (t / RUN_S) * Math.PI * 2;
  return {
    alpha: -Math.PI / 2 + Math.sin(k * 2) * 0.75,
    beta: (55 * Math.PI) / 180 + Math.sin(k * 3) * 0.15,
    radius: 9 + Math.sin(k) * 3,
  };
}

/** The percentile `p` (0..1) of `sorted`, ascending; 0 of none. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i] ?? 0;
}

/** One decimal place. */
function round(v: number): number {
  return Math.round(v * 10) / 10;
}

/** The result of `frames` (ms each) and `calls` (draw calls each, as many), measured in `env`. */
export function benchResult(
  frames: readonly number[],
  calls: readonly number[],
  env: BenchEnv,
): BenchResult {
  const sorted = [...frames].sort((a, b) => a - b);
  const total = frames.reduce((a, b) => a + b, 0);
  return {
    ...env,
    frames: frames.length,
    fps: total > 0 ? round((frames.length / total) * 1000) : 0,
    medianMs: round(percentile(sorted, 0.5)),
    p95Ms: round(percentile(sorted, 0.95)),
    worstMs: round(sorted[sorted.length - 1] ?? 0),
    drawCalls: calls.length > 0 ? Math.round(calls.reduce((a, b) => a + b, 0) / calls.length) : 0,
    drawCallsMax: calls.reduce((a, b) => Math.max(a, b), 0),
  };
}

/** One run: warm-up, then `RUN_S` seconds of recorded frames, then a result. */
export class Bench {
  private start: number | undefined;
  private readonly frames: number[] = [];
  private readonly calls: number[] = [];
  result: BenchResult | undefined;

  /** True until the result is in. */
  get running(): boolean {
    return this.result === undefined;
  }

  /** The camera the path asks for now, or undefined once the result is in. `now` in ms. */
  camera(now: number): BenchPose | undefined {
    if (this.result) return undefined;
    this.start ??= now;
    return benchCamera(Math.min(Math.max((now - this.start) / 1000 - WARMUP_S, 0), RUN_S));
  }

  /** Records a frame of `ms` and `drawCalls` drawn at `now`; returns true when the run just finished. */
  record(now: number, ms: number, drawCalls: number, env: BenchEnv): boolean {
    if (this.start === undefined || this.result) return false;
    const t = (now - this.start) / 1000 - WARMUP_S;
    if (t < 0) return false;
    this.frames.push(ms);
    this.calls.push(drawCalls);
    if (t < RUN_S) return false;
    this.result = benchResult(this.frames, this.calls, env);
    return true;
  }
}
