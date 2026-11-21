/**
 * Everything an engine page does that is not drawing (backlog #378): the
 * keys, the touch stick and the canvas's drag, pinch and wheel; the player's
 * fixed-step walk; the orbit camera; which occluders fade; the room; the
 * benchmark run; the overlay's numbers and the test hook. An engine page
 * builds its scene from `scene.ts` and `meshData.ts`, then each frame calls
 * `update(now)`, draws what it returns, and calls `rendered()`.
 *
 * Query parameters: `spawn` (scene.ts `SpawnKey`), `yaw`, `pitch`,
 * `distance` (the starting camera), `bench` (the benchmark's seconds, so
 * tests can run a short one), `stress` (`quick` for a short two-step stress
 * run) and `budget` (the stress run's frame budget, ms).
 */

import {
  BENCH_SECONDS,
  FrameWindow,
  benchPose,
  formatResult,
  frameStats,
  type BenchResult,
} from './bench';
import { walkRate, walkWeight } from './character';
import './hook';
import type { CharacterHook, ShadowHook } from './hook';
import { MOVE_KEYS, combineInput, stepWalker, type HeldKeys, type Walker } from './movement';
import { blockingOccluders } from './occlusion';
import {
  DEFAULT_ORBIT,
  clampOrbit,
  dragOrbit,
  eyeOf,
  keyTurnOrbit,
  pinchOrbit,
  targetOf,
  wheelOrbit,
  type OrbitState,
} from './orbit';
import { Overlay, statsText } from './overlay';
import {
  roomAt,
  type OccluderKey,
  type RoomKey,
  type SiteVec,
  type SpawnKey,
  type SpikeScene,
} from './scene';
import {
  BASE_LOAD,
  StressRun,
  crowdPose,
  formatStress,
  stressOptions,
  type CrowdPose,
  type StressLoad,
  type StressOptions,
  type StressResult,
} from './stress';

/** What an engine reports of its own scene, read from its own objects. */
export interface EngineDetails {
  /** The loaded character's clips and joints; undefined until the glTF is in. */
  readonly character: Omit<CharacterHook, 'weights'> | undefined;
  readonly shadows: ShadowHook;
}

/** What the page supplies: its name, its canvas and what only it can read. */
export interface EngineAdapter {
  readonly engine: string;
  readonly canvas: HTMLCanvasElement;
  /** Draw calls the last frame took. */
  drawCalls(): number;
  /** The GPU's name (overlay.ts `webglRendererName` on the engine's context). */
  rendererName(): string;
  details(): EngineDetails;
}

export interface SessionOptions {
  readonly spawn: SpawnKey;
  readonly orbit: OrbitState;
  readonly benchSeconds: number;
  readonly stress: StressOptions;
}

const SPAWNS: readonly SpawnKey[] = ['frontDoor', 'shedDoor', 'shed'];

/** The page's query string as options, anything missing or malformed left at its default. */
export function parseOptions(search: string): SessionOptions {
  const q = new URLSearchParams(search);
  const num = (key: string, fallback: number): number => {
    const raw = q.get(key);
    const v = raw === null ? NaN : Number(raw);
    return Number.isFinite(v) ? v : fallback;
  };
  const spawn = q.get('spawn');
  const bench = num('bench', BENCH_SECONDS);
  const budget = num('budget', NaN);
  return {
    stress: stressOptions(q.get('stress'), budget > 0 ? budget : undefined),
    spawn: SPAWNS.find((s) => s === spawn) ?? 'frontDoor',
    orbit: clampOrbit({
      yaw: num('yaw', DEFAULT_ORBIT.yaw),
      pitch: num('pitch', DEFAULT_ORBIT.pitch),
      distance: num('distance', DEFAULT_ORBIT.distance),
    }),
    benchSeconds: bench > 0 ? bench : BENCH_SECONDS,
  };
}

/** What to draw this frame, site frame. */
export interface FrameView {
  readonly player: Walker;
  /** Seconds since the last frame. */
  readonly delta: number;
  /** The player's weight on the walk clip (the idle clip takes the rest) and the walk clip's playback rate. */
  readonly walk: { readonly weight: number; readonly rate: number };
  /** What the page draws besides the player, and the crowd's walkers (site frame) among it. */
  readonly load: StressLoad;
  readonly crowd: readonly CrowdPose[];
  readonly orbit: OrbitState;
  readonly target: SiteVec;
  readonly eye: SiteVec;
  readonly faded: ReadonlySet<OccluderKey>;
  readonly room: RoomKey;
}

const STEP_S = 1 / 60;
const MAX_STEPS = 5;

interface BenchRun {
  readonly start: number;
  readonly deltas: number[];
  readonly drawCalls: number[];
}

interface StressState {
  readonly run: StressRun;
  /** When the pass under way began (requestAnimationFrame's time); undefined until the next frame. */
  passStart: number | undefined;
}

export class SpikeSession {
  readonly options: SessionOptions;
  private player: Walker;
  private walk = 0;
  private stress: StressState | undefined;
  private lastStress: StressResult | undefined;
  private now = 0;
  private delta = 0;
  private orbit: OrbitState;
  private readonly held = { left: false, right: false, up: false, down: false };
  private turn = { q: false, e: false };
  private readonly overlay: Overlay;
  private readonly window = new FrameWindow();
  private last: number | undefined;
  private accumulator = 0;
  private frames = 0;
  private ready = false;
  private bench: BenchRun | undefined;
  private lastBench: BenchResult | undefined;
  private view: FrameView | undefined;
  private renderer = '';

  constructor(
    private readonly scene: SpikeScene,
    private readonly adapter: EngineAdapter,
    search = location.search,
  ) {
    this.options = parseOptions(search);
    const spawn = scene.spawns[this.options.spawn];
    this.player = { x: spawn.x, y: spawn.y, heading: -Math.PI / 2 };
    this.orbit = this.options.orbit;
    this.overlay = new Overlay(adapter.engine, this.options.benchSeconds);
    this.overlay.onBench = () => {
      this.startBench();
    };
    this.overlay.onStress = () => {
      this.startStress();
    };
    this.attachKeys();
    this.attachGestures(adapter.canvas);
  }

  /** Marks the page ready once its scene, textures and tree are in. */
  setReady(): void {
    this.ready = true;
  }

  /** Starts a benchmark run unless one is under way. */
  startBench(): void {
    if (this.bench || this.stress) return;
    this.bench = { start: performance.now(), deltas: [], drawCalls: [] };
  }

  /** Starts a stress run unless a run is under way. */
  startStress(): void {
    if (this.bench || this.stress) return;
    this.stress = { run: new StressRun(this.options.stress), passStart: undefined };
  }

  /** The camera path's pose for the run under way, if one is. */
  private scriptedPose(now: number): ReturnType<typeof benchPose> | undefined {
    if (this.bench) {
      return benchPose((now - this.bench.start) / 1000, this.options.benchSeconds);
    }
    if (this.stress) {
      this.stress.passStart ??= now;
      return benchPose((now - this.stress.passStart) / 1000, this.options.stress.passSeconds);
    }
    return undefined;
  }

  /** Advances the walk, the camera and any benchmark to `now` (requestAnimationFrame's time) and says what to draw. */
  update(now: number): FrameView {
    const delta = this.last === undefined ? 0 : now - this.last;
    this.last = now;
    this.now = now;
    this.delta = delta;
    if (this.frames > 0) this.window.push(delta);
    this.bench?.deltas.push(delta);

    const before = this.player;
    const pose = this.scriptedPose(now);
    if (pose) {
      const dx = pose.player.x - before.x;
      const dy = pose.player.y - before.y;
      const heading = Math.hypot(dx, dy) > 1e-4 ? Math.atan2(dy, dx) : before.heading;
      this.player = { x: pose.player.x, y: pose.player.y, heading };
      this.orbit = clampOrbit(pose.orbit);
    } else {
      this.accumulator = Math.min(this.accumulator + delta / 1000, MAX_STEPS * STEP_S);
      const input = combineInput(this.held, this.overlay.stick);
      const turn = Number(this.turn.e) - Number(this.turn.q);
      while (this.accumulator >= STEP_S) {
        this.accumulator -= STEP_S;
        if (turn !== 0) this.orbit = keyTurnOrbit(this.orbit, turn, STEP_S);
        this.player = stepWalker(this.player, input, this.orbit.yaw, STEP_S, this.scene.colliders);
      }
    }

    const seconds = delta / 1000;
    const speed =
      seconds > 0 ? Math.hypot(this.player.x - before.x, this.player.y - before.y) / seconds : 0;
    this.walk = walkWeight(this.walk, speed, seconds);
    const load = this.stress?.run.load ?? BASE_LOAD;

    const target = targetOf(this.player);
    const eye = eyeOf(this.orbit, target);
    this.view = {
      player: this.player,
      delta: seconds,
      walk: { weight: this.walk, rate: walkRate(speed) },
      load,
      crowd: Array.from({ length: load.characters }, (_, i) => crowdPose(i, now / 1000)),
      orbit: this.orbit,
      target,
      eye,
      faded: new Set(blockingOccluders(eye, this.player, this.scene.occluders)),
      room: roomAt(this.scene, this.player),
    };
    return this.view;
  }

  /** After the frame is drawn: counts it, feeds the benchmark, the overlay and the hook. */
  rendered(): void {
    const view = this.view;
    if (!view) return;
    this.frames++;
    const drawCalls = this.adapter.drawCalls();
    if (this.renderer === '') this.renderer = this.adapter.rendererName();
    if (this.bench) {
      this.bench.drawCalls.push(drawCalls);
      const elapsed = (performance.now() - this.bench.start) / 1000;
      if (elapsed >= this.options.benchSeconds) this.finishBench(this.bench);
      else this.overlay.setBenchRunning(this.options.benchSeconds - elapsed);
    }
    if (this.stress?.passStart !== undefined)
      this.advanceStress(this.stress, this.stress.passStart, drawCalls);
    this.overlay.showStats(
      statsText(this.adapter.engine, this.window.stats(), drawCalls, this.renderer),
    );
    const details = this.adapter.details();
    window.__spikeEngine = {
      engine: this.adapter.engine,
      ready: this.ready,
      player: { x: view.player.x, y: view.player.y },
      camera: view.orbit,
      room: view.room,
      faded: [...view.faded],
      frames: this.frames,
      drawCalls,
      benchRunning: this.bench !== undefined,
      lastBenchmark: this.lastBench,
      stressRunning: this.stress !== undefined,
      lastStress: this.lastStress,
      load: view.load,
      character: details.character && {
        ...details.character,
        weights: { idle: 1 - view.walk.weight, walk: view.walk.weight },
      },
      shadows: details.shadows,
    };
  }

  /** One frame of a stress pass: counts it, and at the pass's end starts the next step or finishes the run. */
  private advanceStress(state: StressState, passStart: number, drawCalls: number): void {
    state.run.push(this.delta, drawCalls);
    const { passSeconds } = this.options.stress;
    if ((this.now - passStart) / 1000 < passSeconds) {
      this.overlay.setStressRunning(
        `Stress step ${String(state.run.step)}/${String(this.options.stress.maxSteps)}`,
      );
      return;
    }
    state.run.endPass();
    if (!state.run.finished) {
      state.passStart = undefined;
      return;
    }
    this.stress = undefined;
    this.lastStress = state.run.result(
      this.adapter.engine,
      this.renderer,
      `${String(window.innerWidth)}x${String(window.innerHeight)} @${String(window.devicePixelRatio)}x`,
    );
    this.overlay.setStressRunning(undefined);
    this.overlay.showResult(formatStress(this.lastStress));
  }

  private finishBench(run: BenchRun): void {
    this.bench = undefined;
    // The first delta spans the press, not a frame of the run.
    const stats = frameStats(run.deltas.slice(1));
    const calls = [...run.drawCalls].sort((a, b) => a - b);
    this.lastBench = {
      ...stats,
      engine: this.adapter.engine,
      seconds: this.options.benchSeconds,
      drawCallsMedian: calls[Math.floor(calls.length / 2)] ?? 0,
      drawCallsMax: calls[calls.length - 1] ?? 0,
      renderer: this.renderer,
      viewport: `${String(window.innerWidth)}x${String(window.innerHeight)} @${String(window.devicePixelRatio)}x`,
    };
    this.overlay.setBenchRunning(undefined);
    this.overlay.showResult(formatResult(this.lastBench));
  }

  private attachKeys(): void {
    const set = (e: KeyboardEvent, down: boolean): void => {
      const dir: keyof HeldKeys | undefined = MOVE_KEYS[e.code];
      if (dir) {
        this.held[dir] = down;
        e.preventDefault();
      } else if (e.code === 'KeyQ') this.turn = { ...this.turn, q: down };
      else if (e.code === 'KeyE') this.turn = { ...this.turn, e: down };
    };
    window.addEventListener('keydown', (e) => {
      set(e, true);
    });
    window.addEventListener('keyup', (e) => {
      set(e, false);
    });
    window.addEventListener('blur', () => {
      Object.assign(this.held, { left: false, right: false, up: false, down: false });
      this.turn = { q: false, e: false };
    });
  }

  /** One pointer drags the camera round; two pinch it in and out; the wheel zooms. */
  private attachGestures(canvas: HTMLCanvasElement): void {
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { startPx: number; start: OrbitState } | undefined;
    const spread = (): number => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) pinch = { startPx: spread(), start: this.orbit };
    });
    canvas.addEventListener('pointermove', (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev || this.bench || this.stress) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size >= 2)
        this.orbit = pinchOrbit(pinch.start, pinch.startPx, spread());
      else if (pointers.size === 1)
        this.orbit = dragOrbit(this.orbit, e.clientX - prev.x, e.clientY - prev.y);
    });
    const end = (e: PointerEvent): void => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = undefined;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (!this.bench && !this.stress) this.orbit = wheelOrbit(this.orbit, e.deltaY);
      },
      { passive: false },
    );
  }
}
