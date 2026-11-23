/**
 * Backlog #446 (style frames, throwaway): the phone benchmark behind
 * `&bench=1`, after the spike's (src/spike3d: a fixed camera, frame times,
 * draw calls). Once the room has settled it flies the camera along a fixed
 * path for `RUN_S` seconds (two sweeps round the room, in close and out
 * wide, up and down), records every frame's time and draw calls, and then
 * shows fps, median, p95 and worst frame ms and draw calls on screen. Pure
 * apart from `show`.
 */

export const WARMUP_S = 2;
export const RUN_S = 12;

export interface BenchResult {
  readonly done: boolean;
  readonly frames: number;
  readonly fps: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly worstMs: number;
  readonly drawCalls: number;
  readonly drawCallsMax: number;
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  readonly userAgent: string;
}

/** The camera on the fixed path at `t` seconds in: alpha, beta and radius about the rig's default. */
export function benchCamera(t: number): { alpha: number; beta: number; radius: number } {
  const k = (t / RUN_S) * Math.PI * 2;
  return {
    alpha: -Math.PI / 2 + Math.sin(k * 2) * 0.75,
    beta: (55 * Math.PI) / 180 + Math.sin(k * 3) * 0.15,
    radius: 9 + Math.sin(k) * 3,
  };
}

/** The percentile `p` (0..1) of `sorted`. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i] ?? 0;
}

export class Bench {
  private start: number | undefined;
  private readonly frames: number[] = [];
  private readonly calls: number[] = [];
  result: BenchResult | undefined;

  /** The camera the path asks for now, or undefined before and after the run. `now` in ms. */
  camera(now: number): { alpha: number; beta: number; radius: number } | undefined {
    this.start ??= now;
    const t = (now - this.start) / 1000 - WARMUP_S;
    if (this.result || t < 0) return t < 0 ? benchCamera(0) : undefined;
    return benchCamera(Math.min(t, RUN_S));
  }

  /** Records a frame of `ms` and `drawCalls`; returns true when the run just finished. */
  record(
    now: number,
    ms: number,
    drawCalls: number,
    size: { width: number; height: number },
  ): boolean {
    if (this.start === undefined || this.result) return false;
    const t = (now - this.start) / 1000 - WARMUP_S;
    if (t < 0) return false;
    this.frames.push(ms);
    this.calls.push(drawCalls);
    if (t < RUN_S) return false;
    const sorted = [...this.frames].sort((a, b) => a - b);
    const total = this.frames.reduce((a, b) => a + b, 0);
    this.result = {
      done: true,
      frames: this.frames.length,
      fps: Math.round((this.frames.length / total) * 1000 * 10) / 10,
      medianMs: round(percentile(sorted, 0.5)),
      p95Ms: round(percentile(sorted, 0.95)),
      worstMs: round(sorted[sorted.length - 1] ?? 0),
      drawCalls: Math.round(this.calls.reduce((a, b) => a + b, 0) / this.calls.length),
      drawCallsMax: Math.max(...this.calls),
      width: size.width,
      height: size.height,
      dpr: window.devicePixelRatio,
      userAgent: navigator.userAgent,
    };
    return true;
  }
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Shows `result` over the game in a panel a phone screenshot can carry. */
export function showBench(label: string, result: BenchResult): void {
  const panel = document.createElement('pre');
  panel.id = 'bench446';
  Object.assign(panel.style, {
    position: 'fixed',
    left: '8px',
    top: '8px',
    zIndex: '10',
    margin: '0',
    padding: '8px 10px',
    background: 'rgba(20,14,18,0.82)',
    color: '#f4ecd8',
    font: '12px/1.35 monospace',
    borderRadius: '6px',
    pointerEvents: 'none',
  });
  panel.textContent = [
    `bench #446  ${label}`,
    `fps ${String(result.fps)}  (${String(result.frames)} frames)`,
    `median ${String(result.medianMs)} ms  p95 ${String(result.p95Ms)} ms`,
    `worst ${String(result.worstMs)} ms`,
    `draw calls ${String(result.drawCalls)} (max ${String(result.drawCallsMax)})`,
    `${String(result.width)}x${String(result.height)} @${String(result.dpr)}x`,
  ].join('\n');
  document.body.appendChild(panel);
}
