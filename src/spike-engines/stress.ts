/**
 * The stress test (backlog #391), engine-neutral: the benchmark's camera path
 * flown again and again while the load steps up, and the statistics each pass
 * reports. Steps 0 to 6 add `PROPS_PER_STEP` instanced trees and hedges to the
 * garden's own; steps 7 and on add `CROWD_PER_STEP` animated characters,
 * each with its own animation state, walking a loop on the back lawn. The run
 * stops at the first step whose median frame time passes the budget (a 60 fps
 * frame, 16.7 ms), or at the step cap. `SpikeSession` drives it frame by
 * frame; the engine pages only draw the load a frame asks for.
 */

import { frameStats, type FrameStats } from './bench';
import { GARDEN_PROPS, splitProps } from './props';

/** One pass's length, seconds. `?stress=quick` shortens it for tests. */
export const STRESS_PASS_SECONDS = 6;
export const STRESS_QUICK_PASS_SECONDS = 1.5;
/** The last step a run reaches if every step holds the budget; `?stress=quick` stops at its own. */
export const STRESS_MAX_STEPS = 12;
export const STRESS_QUICK_STEPS = 2;
/** A 60 fps frame, milliseconds. `?budget=<ms>` moves it for runs on slow software GL. */
export const FRAME_BUDGET_MS = 16.7;
/** Steps that add props; every later step adds characters. */
export const PROP_STEPS = 6;
export const PROPS_PER_STEP = 40;
export const CROWD_PER_STEP = 4;
/** Frames at the start of a pass left out: the step's new instances are still uploading. */
const WARMUP_FRAMES = 3;

/** What a step draws on top of the player. */
export interface StressLoad {
  readonly trees: number;
  readonly hedges: number;
  readonly characters: number;
}

/** The load at step `step`: step 0 is the garden as it stands with no crowd. */
export function stressLoad(step: number): StressLoad {
  const props = GARDEN_PROPS + Math.min(step, PROP_STEPS) * PROPS_PER_STEP;
  return { ...splitProps(props), characters: Math.max(0, step - PROP_STEPS) * CROWD_PER_STEP };
}

/** The most crowd characters any run draws. */
export const MAX_CROWD = stressLoad(STRESS_MAX_STEPS).characters;

/** The load when no stress run is under way: the garden's trees and hedges, no crowd. */
export const BASE_LOAD: StressLoad = stressLoad(0);

export interface StressOptions {
  readonly passSeconds: number;
  readonly maxSteps: number;
  readonly budgetMs: number;
}

/** The options for a `?stress=` value: anything but `quick` is the full run; `budget` moves the threshold. */
export function stressOptions(mode: string | null, budgetMs: number | undefined): StressOptions {
  const quick = mode === 'quick';
  return {
    passSeconds: quick ? STRESS_QUICK_PASS_SECONDS : STRESS_PASS_SECONDS,
    maxSteps: quick ? STRESS_QUICK_STEPS : STRESS_MAX_STEPS,
    budgetMs: budgetMs ?? FRAME_BUDGET_MS,
  };
}

export interface StressStep extends FrameStats {
  readonly step: number;
  readonly load: StressLoad;
  /** Draw calls a frame: the median over the pass. */
  readonly drawCalls: number;
}

export interface StressResult {
  readonly engine: string;
  readonly steps: readonly StressStep[];
  readonly budgetMs: number;
  readonly passSeconds: number;
  /** The last step that held the budget, before the first that did not; undefined if step 0 failed. */
  readonly heldStep: number | undefined;
  /** Why the run stopped. */
  readonly stoppedBy: 'budget' | 'cap';
  readonly renderer: string;
  readonly viewport: string;
}

/** The statistics of the passes so far, and which pass is under way. */
export class StressRun {
  private readonly done: StressStep[] = [];
  private deltas: number[] = [];
  private calls: number[] = [];
  private skipped = 0;
  private stopped: 'budget' | 'cap' | undefined;

  constructor(readonly options: StressOptions) {}

  /** The step under way. */
  get step(): number {
    return this.done.length;
  }

  get load(): StressLoad {
    return stressLoad(this.step);
  }

  get finished(): boolean {
    return this.stopped !== undefined;
  }

  /** One frame of the pass: its time in milliseconds and the draw calls it took. */
  push(deltaMs: number, drawCalls: number): void {
    if (this.skipped < WARMUP_FRAMES) {
      this.skipped++;
      return;
    }
    this.deltas.push(deltaMs);
    this.calls.push(drawCalls);
  }

  /** Closes the pass under way; the next step's pass begins unless the run is over. Returns the step just closed. */
  endPass(): StressStep {
    const calls = [...this.calls].sort((a, b) => a - b);
    const closed: StressStep = {
      ...frameStats(this.deltas),
      step: this.step,
      load: this.load,
      drawCalls: calls[Math.floor(calls.length / 2)] ?? 0,
    };
    this.done.push(closed);
    this.deltas = [];
    this.calls = [];
    this.skipped = 0;
    if (closed.medianMs > this.options.budgetMs) this.stopped = 'budget';
    else if (closed.step >= this.options.maxSteps) this.stopped = 'cap';
    return closed;
  }

  /** The finished run, with the page's details. */
  result(engine: string, renderer: string, viewport: string): StressResult {
    const failed = this.done.findIndex((s) => s.medianMs > this.options.budgetMs);
    const held = failed === -1 ? this.done.length - 1 : failed - 1;
    return {
      engine,
      steps: this.done,
      budgetMs: this.options.budgetMs,
      passSeconds: this.options.passSeconds,
      heldStep: held >= 0 ? held : undefined,
      stoppedBy: this.stopped ?? 'cap',
      renderer,
      viewport,
    };
  }
}

const ms = (v: number): string => v.toFixed(1);

/** The result as the overlay shows it and the report quotes it. */
export function formatStress(r: StressResult): string {
  const held =
    r.heldStep === undefined
      ? `did not hold 60 fps at step 0 (budget ${ms(r.budgetMs)} ms)`
      : `held 60 fps up to step ${String(r.heldStep)}${r.stoppedBy === 'cap' ? ' (step cap)' : ''}`;
  return [
    `${r.engine}: stress, ${String(r.passSeconds)} s a step, budget ${ms(r.budgetMs)} ms`,
    'step  trees hedges chars | median  p95  worst ms | calls',
    ...r.steps.map(
      (s) =>
        `${String(s.step).padStart(4)}  ${String(s.load.trees).padStart(5)} ${String(s.load.hedges).padStart(6)} ${String(s.load.characters).padStart(5)} | ${ms(s.medianMs).padStart(6)} ${ms(s.p95Ms).padStart(5)} ${ms(s.worstMs).padStart(6)} | ${String(s.drawCalls).padStart(5)}`,
    ),
    held,
    `viewport ${r.viewport}`,
    `GPU ${r.renderer}`,
  ].join('\n');
}

/** Where a crowd member walks: site metres, heading as `Walker.heading`. */
export interface CrowdPose {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
}

const CROWD_COLUMNS = 6;
const CROWD_RADIUS = 0.8;
/** Crowd members' walking speed, metres a second. */
export const CROWD_SPEED = 1.4;

/** Crowd member `i` at `seconds`: a circle on the back lawn, a grid of them, each started at its own angle. */
export function crowdPose(i: number, seconds: number): CrowdPose {
  const cx = 1.7 + (i % CROWD_COLUMNS) * 2.3;
  const cy = 9.3 + Math.floor(i / CROWD_COLUMNS) * 1.6;
  const angle = (CROWD_SPEED / CROWD_RADIUS) * seconds + i * 1.3;
  return {
    x: cx + CROWD_RADIUS * Math.cos(angle),
    y: cy + CROWD_RADIUS * Math.sin(angle),
    heading: Math.atan2(Math.cos(angle), -Math.sin(angle)),
  };
}
