/**
 * The 3D world's adapter for the Phaser world scene: the one place game code
 * touches it. While the `world3d` setting is on, `sync` loads the Babylon
 * renderer (a dynamic import, its own chunk) and draws the room it is given
 * every frame, with the season's weather where the scene has one; when the setting goes off it lets the renderer go. Movement,
 * collision and the HUD stay in the scene.
 */

import type Phaser from 'phaser';
import { SURROUND } from '../scenes/textStyle';
import type { Season } from '../sim/seasons';
import type { Room, RoomKey } from '../world/shedRoom';
import { cameraRig } from './camera';
import type { OneShotKind } from './character';
import type { Seat, SeatKey } from './seats';
import { showBench, showPanel } from './benchPanel';
import { roomTimeLines } from './roomTimes';
import type { Renderer } from './renderer';
import type { Picked } from './tap';
import type { SpotMat, TreeStand } from './trees';
import type { WeatherField } from './weather';

/**
 * The game canvas's clear colour: the surround, opaque, or transparent black so
 * the 3D world under the canvas shows untouched. The canvas always has an alpha
 * channel (main.ts), and an opaque clear colour draws exactly as a canvas
 * without one. The canvas is composited premultiplied, so any non-zero rgb at
 * alpha 0 would be added over the 3D world as haze.
 */
export function setSurround(game: Phaser.Game, clear: boolean): void {
  if (clear) {
    game.config.backgroundColor.setTo(0, 0, 0, 0);
    return;
  }
  game.config.backgroundColor.setTo(
    (SURROUND >> 16) & 0xff,
    (SURROUND >> 8) & 0xff,
    SURROUND & 0xff,
    255,
  );
}

export class World3d {
  private renderer: Renderer | undefined;
  private loading = false;
  private failed = false;
  /** Bumped by `dispose`; a load that finishes under an older number is discarded. */
  private generation = 0;

  /** The last hotspot a tap picked, for the test hook. */
  private picked: string | null = null;
  /** The benchmark result whose panel has been shown, so each result is shown once. */
  private benchShown: unknown;
  private benchPanel: HTMLElement | undefined;
  private timesPanel: HTMLElement | undefined;

  constructor(private readonly host: HTMLCanvasElement) {}

  /** What a tap at (`u`, `v`), fractions of the game canvas, lands on, a prop reaching `radius` game px; a prop is also remembered as the last picked. */
  pick(u: number, v: number, radius = 0): Picked | undefined {
    const hit = this.renderer?.pick(u, v, radius);
    if (hit && 'hotspot' in hit) this.picked = hit.hotspot;
    return hit;
  }

  /** True once the renderer is up, which is when the 2D world stops drawing. */
  get active(): boolean {
    return this.renderer !== undefined;
  }

  /** True once the player's body has loaded, which is when it can play a clip or sit; false while off. */
  get bodyLoaded(): boolean {
    return this.renderer?.hasBody() ?? false;
  }

  /** Follows the setting (`roomOf` gives a room's live data, which the rooms behind the doors are built ahead from): starts loading the renderer when it turns on, drops it when it turns off, and draws a frame while it is up. */
  sync(
    on: boolean,
    room: Room,
    player: { readonly x: number; readonly y: number },
    trees: readonly TreeStand[],
    mats: readonly SpotMat[],
    season: Season,
    weather: WeatherField | undefined,
    roomOf: (key: RoomKey) => Room,
    gameSeconds = 0,
    carrying = false,
  ): void {
    if (on && !this.renderer && !this.loading && !this.failed) {
      this.loading = true;
      const generation = this.generation;
      void import('./renderer')
        .then(({ Renderer: Created }) => {
          if (generation === this.generation) this.renderer = new Created(this.host);
        })
        .catch((error: unknown) => {
          if (generation !== this.generation) return;
          this.failed = true;
          console.warn('3D world failed to load', error);
        })
        .finally(() => {
          if (generation === this.generation) this.loading = false;
        });
    }
    if (!on) this.dispose();
    this.renderer?.setCarrying(carrying);
    this.renderer?.frame(room, player, trees, mats, season, weather, roomOf, gameSeconds);
    const bench = this.renderer?.benchState().result;
    if (bench && bench !== this.benchShown) {
      this.benchShown = bench;
      this.benchPanel = showBench(bench);
    }
  }

  /** The player's body plays a one-shot (character.ts): an Interact, a pick-up or a sleep; nothing while the renderer or the body is not up. */
  play(kind: OneShotKind): void {
    this.renderer?.play(kind);
  }

  /** The player's body sits at `seat`; nothing while the renderer or the body is not up. */
  sit(seat: Seat): void {
    this.renderer?.sit(seat);
  }

  /** The player's body gets up from its seat. */
  standUp(): void {
    this.renderer?.standUp();
  }

  /** The seat the body is at, from sitting down to the end of standing up; null otherwise, and while off. */
  get seated(): SeatKey | null {
    return this.renderer?.seated() ?? null;
  }

  /** True while the body is sat and not yet told to stand: the moment the Stand prompt is offered, and no longer once the stand-up is under way. */
  get standable(): boolean {
    return this.renderer?.standable() ?? false;
  }

  /** Starts a benchmark run in the room shown, taking down the last result's panel; nothing while the renderer is not up. */
  startBench(): void {
    this.benchPanel?.remove();
    this.renderer?.startBench();
  }

  /** Shows the latest room-change and build-ahead times, replacing any readout open; empty lists while the renderer is not up. */
  showTimes(): void {
    this.timesPanel?.remove();
    const snap = this.renderer?.snapshot();
    this.timesPanel = showPanel(
      'times',
      roomTimeLines(snap?.roomChanges ?? [], snap?.aheadBuilds ?? [], navigator.userAgent),
    );
  }

  /** Lets the renderer and its canvas go, cancels a load in flight, and lets a failed load be tried again. */
  dispose(): void {
    this.generation += 1;
    this.loading = false;
    this.failed = false;
    this.benchPanel?.remove();
    this.timesPanel?.remove();
    this.benchShown = undefined;
    this.renderer?.dispose();
    this.renderer = undefined;
  }

  /** The test hook's `world3d`. */
  snapshot(): NonNullable<BonsaiTestHook['world3d']> {
    const state = this.renderer?.snapshot();
    return {
      on: this.renderer !== undefined,
      room: state?.room ?? null,
      meshes: state?.meshes ?? 0,
      trees: state?.trees ?? 0,
      spotMats: state?.spotMats ?? 0,
      instances: state ? { ...state.instances } : {},
      camera: state?.camera ?? {
        alpha: cameraRig.alpha,
        beta: cameraRig.beta,
        radius: cameraRig.radius,
      },
      cut: state ? [...state.cut] : [],
      facing: state?.facing ?? 0,
      playerModel: state?.model ?? null,
      bodyLoaded: state?.bodyLoaded ?? false,
      clips: state ? { ...state.clips } : { idle: 0, walk: 0, run: 0 },
      carry: state?.carry ?? 0,
      shot: state?.shot ?? null,
      seated: state?.seated ?? null,
      shadows: state?.shadows ?? false,
      shadowMap: state?.shadowMap
        ? { ...state.shadowMap, window: [...state.shadowMap.window] }
        : { fixed: false, size: 0, bias: 0, normalBias: 0, window: [0, 0, 0, 0, 0, 0] },
      artDepthOffset: state?.artDepthOffset ?? 0,
      inked: state?.inked ?? false,
      floorSheet: state?.floorSheet ?? null,
      wallSheets: state ? [...state.wallSheets] : [],
      painted: state?.painted ?? 0,
      paintMs: state?.paintMs ?? 0,
      details: state ? { ...state.details } : {},
      weather: state?.weather ?? null,
      built: state ? [...state.built] : [],
      player: this.renderer ? this.renderer.playerAt() : null,
      picked: this.picked,
      hotspots: state ? [...state.hotspots] : [],
      roomChanges: state ? state.roomChanges.map((change) => ({ ...change })) : [],
      aheadBuilds: state ? state.aheadBuilds.map((build) => ({ ...build })) : [],
      aheadPending: state?.aheadPending ?? 0,
      bench: state ? { ...state.bench } : { running: false, result: null },
    };
  }
}
