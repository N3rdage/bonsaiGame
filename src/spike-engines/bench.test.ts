import { describe, expect, it } from 'vitest';
import {
  BENCH_ROUTE,
  BENCH_SECONDS,
  FrameWindow,
  benchPose,
  formatResult,
  frameStats,
  routePoint,
} from './bench';
import { clampOrbit } from './orbit';
import { buildScene, roomAt } from './scene';

describe('the benchmark', () => {
  it('runs 20 seconds', () => {
    expect(BENCH_SECONDS).toBe(20);
  });

  it('follows the route from its first point to its last', () => {
    expect(routePoint(0)).toEqual(BENCH_ROUTE[0]);
    expect(routePoint(1)).toEqual(BENCH_ROUTE[BENCH_ROUTE.length - 1]);
    expect(benchPose(0).player).toEqual(BENCH_ROUTE[0]);
  });

  it('is the same path at any duration, only faster', () => {
    expect(benchPose(5, 20)).toEqual(benchPose(1, 4));
    expect(benchPose(30, 20)).toEqual(benchPose(20, 20));
  });

  it('visits the shed and keeps the camera inside its clamps', () => {
    const scene = buildScene();
    const rooms = new Set<string>();
    for (let t = 0; t <= 20; t += 0.1) {
      const pose = benchPose(t);
      rooms.add(roomAt(scene, pose.player));
      expect(clampOrbit(pose.orbit)).toEqual({ ...pose.orbit, yaw: clampOrbit(pose.orbit).yaw });
    }
    expect(rooms).toEqual(new Set(['garden', 'shed']));
  });

  it('reports the median, 95th percentile and worst frame and the mean rate', () => {
    const deltas = [...Array.from({ length: 19 }, () => 10), 50];
    const s = frameStats(deltas);
    expect(s).toEqual({ frames: 20, fps: 1000 / 12, medianMs: 10, p95Ms: 10, worstMs: 50 });
    expect(frameStats([])).toEqual({ frames: 0, fps: 0, medianMs: 0, p95Ms: 0, worstMs: 0 });
  });

  it('keeps the last 3 s of frame times', () => {
    const w = new FrameWindow(3000);
    for (let i = 0; i < 10; i++) w.push(1000);
    expect(w.stats().frames).toBe(3);
  });

  it('formats a result as readable lines', () => {
    const text = formatResult({
      ...frameStats([16, 17, 18]),
      engine: 'three',
      seconds: 20,
      drawCallsMedian: 80,
      drawCallsMax: 90,
      renderer: 'GPU',
      viewport: '824x384 @2.8125x',
    });
    expect(text).toContain('three: 20 s camera path, 3 frames');
    expect(text).toContain('median 17.0 ms');
    expect(text).toContain('draw calls median 80, max 90');
  });
});
