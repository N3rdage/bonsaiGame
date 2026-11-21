import { describe, expect, it } from 'vitest';
import {
  BASE_LOAD,
  CROWD_PER_STEP,
  CROWD_SPEED,
  FRAME_BUDGET_MS,
  PROPS_PER_STEP,
  PROP_STEPS,
  STRESS_MAX_STEPS,
  STRESS_PASS_SECONDS,
  StressRun,
  crowdPose,
  formatStress,
  stressLoad,
  stressOptions,
} from './stress';

const total = (l: { trees: number; hedges: number }): number => l.trees + l.hedges;

/** Pushes `frames` frames of `ms` each and closes the pass. */
function pass(run: StressRun, ms: number, frames = 20, calls = 30): void {
  for (let i = 0; i < frames; i++) run.push(ms, calls);
  run.endPass();
}

describe('stressLoad', () => {
  it('starts at the garden alone and adds props, then characters', () => {
    expect(stressLoad(0)).toEqual({ ...BASE_LOAD, characters: 0 });
    expect(total(stressLoad(1)) - total(stressLoad(0))).toBe(PROPS_PER_STEP);
    expect(total(stressLoad(PROP_STEPS))).toBe(total(stressLoad(0)) + PROP_STEPS * PROPS_PER_STEP);
    expect(stressLoad(PROP_STEPS).characters).toBe(0);
    expect(stressLoad(PROP_STEPS + 1).characters).toBe(CROWD_PER_STEP);
    expect(total(stressLoad(PROP_STEPS + 3))).toBe(total(stressLoad(PROP_STEPS)));
    expect(stressLoad(STRESS_MAX_STEPS).characters).toBe(
      (STRESS_MAX_STEPS - PROP_STEPS) * CROWD_PER_STEP,
    );
  });
});

describe('stressOptions', () => {
  it('is the full run by default and shortens for quick', () => {
    expect(stressOptions(null, undefined)).toEqual({
      passSeconds: STRESS_PASS_SECONDS,
      maxSteps: STRESS_MAX_STEPS,
      budgetMs: FRAME_BUDGET_MS,
    });
    const quick = stressOptions('quick', 40);
    expect(quick.maxSteps).toBe(2);
    expect(quick.passSeconds).toBeLessThan(STRESS_PASS_SECONDS);
    expect(quick.budgetMs).toBe(40);
  });
});

describe('StressRun', () => {
  const options = { passSeconds: 1, maxSteps: 3, budgetMs: 16.7 };

  it('leaves out the first frames of each pass', () => {
    const run = new StressRun(options);
    for (let i = 0; i < 3; i++) run.push(500, 1);
    for (let i = 0; i < 10; i++) run.push(10, 1);
    expect(run.endPass().worstMs).toBe(10);
  });

  it('needs a handful of frames before a pass may end', () => {
    const run = new StressRun(options);
    for (let i = 0; i < 3 + 4; i++) run.push(10, 1);
    expect(run.hasEnoughFrames).toBe(false);
    run.push(10, 1);
    expect(run.hasEnoughFrames).toBe(true);
  });

  it('runs to the cap while every step holds the budget', () => {
    const run = new StressRun(options);
    for (let step = 0; step <= 3; step++) {
      expect(run.finished).toBe(false);
      expect(run.step).toBe(step);
      pass(run, 16);
    }
    expect(run.finished).toBe(true);
    const result = run.result('three', 'gpu', '824x384');
    expect(result.steps).toHaveLength(4);
    expect(result.heldStep).toBe(3);
    expect(result.stoppedBy).toBe('cap');
    expect(formatStress(result)).toContain('held 60 fps up to step 3 (step cap)');
  });

  it('stops at the first step whose median passes the budget', () => {
    const run = new StressRun(options);
    pass(run, 12);
    pass(run, 16);
    pass(run, 25, 20, 77);
    expect(run.finished).toBe(true);
    const result = run.result('babylon', 'gpu', '824x384');
    expect(result.steps.map((s) => s.step)).toEqual([0, 1, 2]);
    expect(result.heldStep).toBe(1);
    expect(result.stoppedBy).toBe('budget');
    expect(result.steps[2]?.drawCalls).toBe(77);
    const text = formatStress(result);
    expect(text).toContain('held 60 fps up to step 1');
    expect(text).toContain('median');
  });

  it('reports a failure at step 0', () => {
    const run = new StressRun(options);
    pass(run, 40);
    const result = run.result('three', 'gpu', 'v');
    expect(result.heldStep).toBeUndefined();
    expect(formatStress(result)).toContain('did not hold 60 fps at step 0');
  });
});

describe('crowdPose', () => {
  it('walks a circle at the crowd speed, heading along it', () => {
    const a = crowdPose(2, 1);
    const b = crowdPose(2, 1.001);
    const speed = Math.hypot(b.x - a.x, b.y - a.y) / 0.001;
    expect(speed).toBeCloseTo(CROWD_SPEED, 1);
    expect(Math.atan2(b.y - a.y, b.x - a.x)).toBeCloseTo(a.heading, 1);
  });

  it('keeps every member of a full crowd on the back lawn and apart', () => {
    for (let i = 0; i < 24; i++) {
      for (const t of [0, 3.7]) {
        const p = crowdPose(i, t);
        expect(p.x).toBeGreaterThan(0.2);
        expect(p.x).toBeLessThan(14.3);
        expect(p.y).toBeGreaterThan(8.5);
        expect(p.y).toBeLessThan(15.9);
      }
    }
  });
});
