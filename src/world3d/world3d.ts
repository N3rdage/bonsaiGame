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
import type { Room } from '../world/shedRoom';
import { cameraRig } from './camera';
import type { Renderer } from './renderer';
import type { Picked } from './tap';
import type { TreeStand } from './trees';
import type { WeatherField } from './weather';

/**
 * The game canvas's clear colour: the surround, opaque, or fully clear so
 * what lies under the canvas shows. The canvas always has an alpha channel
 * (main.ts), and an opaque clear colour draws exactly as a canvas without one.
 */
export function setSurround(game: Phaser.Game, clear: boolean): void {
  // Backlog #446: a clear colour of SURROUND's rgb at alpha 0 is not a valid premultiplied colour,
  // and the browser composites it additively, washing the 3D world under it with SURROUND. The
  // style takes clear to transparent black; today's look keeps the bug so "before" is honest.
  if (clear && new URLSearchParams(window.location.search).has('style')) {
    game.config.backgroundColor.setTo(0, 0, 0, 0);
    return;
  }
  game.config.backgroundColor.setTo(
    (SURROUND >> 16) & 0xff,
    (SURROUND >> 8) & 0xff,
    SURROUND & 0xff,
    clear ? 0 : 255,
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

  /** Follows the setting: starts loading the renderer when it turns on, drops it when it turns off, and draws a frame while it is up. */
  sync(
    on: boolean,
    room: Room,
    player: { readonly x: number; readonly y: number },
    trees: readonly TreeStand[],
    season: Season,
    weather: WeatherField | undefined,
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
    this.renderer?.frame(room, player, trees, season, weather);
  }

  /** Lets the renderer and its canvas go, cancels a load in flight, and lets a failed load be tried again. */
  dispose(): void {
    this.generation += 1;
    this.loading = false;
    this.failed = false;
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
      instances: state ? { ...state.instances } : {},
      camera: state?.camera ?? {
        alpha: cameraRig.alpha,
        beta: cameraRig.beta,
        radius: cameraRig.radius,
      },
      cut: state ? [...state.cut] : [],
      facing: state?.facing ?? 0,
      playerModel: state?.model ?? null,
      clips: state ? { ...state.clips } : { idle: 0, walk: 0 },
      shadows: state?.shadows ?? false,
      shadowMap: state?.shadowMap
        ? { ...state.shadowMap, window: [...state.shadowMap.window] }
        : { fixed: false, size: 0, bias: 0, normalBias: 0, window: [0, 0, 0, 0, 0, 0] },
      artDepthOffset: state?.artDepthOffset ?? 0,
      toon: state?.toon ?? false,
      floorSheet: state?.floorSheet ?? null,
      wallSheets: state ? [...state.wallSheets] : [],
      details: state ? { ...state.details } : {},
      weather: state?.weather ?? null,
      player: this.renderer ? this.renderer.playerAt() : null,
      picked: this.picked,
      hotspots: state ? [...state.hotspots] : [],
    };
  }
}
