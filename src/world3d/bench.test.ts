import { describe, expect, it } from 'vitest';
import {
  Bench,
  RUN_S,
  WARMUP_S,
  benchCamera,
  benchResult,
  percentile,
  type BenchEnv,
} from './bench';
import { benchLines } from './benchPanel';

const ENV: BenchEnv = {
  width: 824,
  height: 384,
  dpr: 2.625,
  userAgent: 'test agent',
  room: 'shed',
};

describe('the benchmark path', () => {
  it('warms up for 2 s and counts 12 s', () => {
    expect(WARMUP_S).toBe(2);
    expect(RUN_S).toBe(12);
  });

  it('starts and ends at the rig-like pose, and swings between', () => {
    const start = benchCamera(0);
    expect(start.alpha).toBeCloseTo(-Math.PI / 2, 10);
    expect(start.beta).toBeCloseTo((55 * Math.PI) / 180, 10);
    expect(start.radius).toBe(9);
    const end = benchCamera(RUN_S);
    expect(end.alpha).toBeCloseTo(start.alpha, 10);
    expect(end.beta).toBeCloseTo(start.beta, 10);
    expect(end.radius).toBeCloseTo(start.radius, 10);
    expect(benchCamera(RUN_S / 4).radius).toBeCloseTo(12, 10);
    expect(benchCamera((3 * RUN_S) / 4).radius).toBeCloseTo(6, 10);
  });
});

describe('percentile', () => {
  it('is 0 of nothing and the one value of one', () => {
    expect(percentile([], 0.5)).toBe(0);
    expect(percentile([7], 0)).toBe(7);
    expect(percentile([7], 0.95)).toBe(7);
  });

  it('takes the nearest rank, clamped to the ends', () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(v, 0.5)).toBe(5);
    expect(percentile(v, 0.95)).toBe(10);
    expect(percentile(v, 0.1)).toBe(1);
    expect(percentile(v, 0)).toBe(1);
    expect(percentile(v, 1)).toBe(10);
    expect(percentile(v, 2)).toBe(10);
    expect(percentile(v, -1)).toBe(1);
  });
});

describe('benchResult', () => {
  it('reduces frames and draw calls to fps, median, p95, worst and draw calls', () => {
    const frames = [10, 20, 10, 20, 100];
    const result = benchResult(frames, [100, 110, 120, 130, 140], ENV);
    expect(result).toEqual({
      ...ENV,
      frames: 5,
      fps: 31.3,
      medianMs: 20,
      p95Ms: 100,
      worstMs: 100,
      drawCalls: 120,
      drawCallsMax: 140,
    });
    expect(frames).toEqual([10, 20, 10, 20, 100]);
  });

  it('rounds to one decimal and copes with no frames', () => {
    expect(benchResult([16.67, 16.67, 16.67], [3, 4, 4], ENV)).toMatchObject({
      fps: 60,
      medianMs: 16.7,
      drawCalls: 4,
    });
    expect(benchResult([], [], ENV)).toMatchObject({
      frames: 0,
      fps: 0,
      worstMs: 0,
      drawCalls: 0,
      drawCallsMax: 0,
    });
  });

  it('shows every figure and the environment as text', () => {
    const text = benchLines(benchResult([20, 20], [5, 7], ENV)).join('\n');
    expect(text).toContain('fps 50  (2 frames)');
    expect(text).toContain('median 20 ms  p95 20 ms');
    expect(text).toContain('worst 20 ms');
    expect(text).toContain('draw calls 6 (max 7)');
    expect(text).toContain('render 824x384 @2.625x');
    expect(text).toContain('test agent');
    expect(text).toContain('shed');
  });
});

describe('Bench', () => {
  it('holds the path start through the warm-up and counts no frame', () => {
    const bench = new Bench();
    expect(bench.running).toBe(true);
    expect(bench.camera(1000)).toEqual(benchCamera(0));
    expect(bench.camera(1000 + (WARMUP_S * 1000) / 2)).toEqual(benchCamera(0));
    expect(bench.record(1000 + 1000, 16, 5, ENV)).toBe(false);
    expect(bench.result).toBeUndefined();
  });

  it('moves along the path once the warm-up is over', () => {
    const bench = new Bench();
    bench.camera(0);
    expect(bench.camera((WARMUP_S + 3) * 1000)).toEqual(benchCamera(3));
    expect(bench.camera((WARMUP_S + RUN_S + 5) * 1000)).toEqual(benchCamera(RUN_S));
  });

  it('counts frames from the end of the warm-up and finishes after RUN_S', () => {
    const bench = new Bench();
    bench.camera(0);
    let finished = 0;
    let frames = 0;
    for (let ms = 0; ms <= (WARMUP_S + RUN_S) * 1000; ms += 100) {
      if (ms >= WARMUP_S * 1000) frames += 1;
      if (bench.record(ms, 100, 8, ENV)) finished += 1;
    }
    expect(finished).toBe(1);
    expect(bench.running).toBe(false);
    expect(bench.result).toMatchObject({
      frames,
      fps: 10,
      medianMs: 100,
      drawCalls: 8,
      room: 'shed',
    });
  });

  it('has no camera and records nothing once the result is in', () => {
    const bench = new Bench();
    bench.camera(0);
    expect(bench.record((WARMUP_S + RUN_S) * 1000, 20, 3, ENV)).toBe(true);
    const result = bench.result;
    expect(bench.camera((WARMUP_S + RUN_S) * 1000 + 1)).toBeUndefined();
    expect(bench.record((WARMUP_S + RUN_S) * 1000 + 100, 500, 99, ENV)).toBe(false);
    expect(bench.result).toBe(result);
  });

  it('records nothing before the camera has asked for the path', () => {
    const bench = new Bench();
    expect(bench.record(50_000, 16, 5, ENV)).toBe(false);
    expect(bench.result).toBeUndefined();
  });
});
