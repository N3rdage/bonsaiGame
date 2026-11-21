/**
 * The 3D world's adapter for the Phaser world scene: the one place game code
 * touches it. While the `world3d` setting is on, `sync` loads the Babylon
 * renderer (a dynamic import, its own chunk) and draws the room it is given
 * every frame; when the setting goes off it lets the renderer go. Movement,
 * collision and the HUD stay in the scene.
 */

import type Phaser from 'phaser';
import { SURROUND } from '../scenes/textStyle';
import type { Room } from '../world/shedRoom';
import { cameraRig } from './camera';
import type { Renderer } from './renderer';

/**
 * The game canvas's clear colour: the surround, opaque, or fully clear so
 * what lies under the canvas shows. The canvas always has an alpha channel
 * (main.ts), and an opaque clear colour draws exactly as a canvas without one.
 */
export function setSurround(game: Phaser.Game, clear: boolean): void {
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

  constructor(private readonly host: HTMLCanvasElement) {}

  /** True once the renderer is up, which is when the 2D world stops drawing. */
  get active(): boolean {
    return this.renderer !== undefined;
  }

  /** Follows the setting: starts loading the renderer when it turns on, drops it when it turns off, and draws a frame while it is up. */
  sync(on: boolean, room: Room, player: { readonly x: number; readonly y: number }): void {
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
    this.renderer?.frame(room, player);
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
      camera: state?.camera ?? {
        alpha: cameraRig.alpha,
        beta: cameraRig.beta,
        radius: cameraRig.radius,
      },
      cut: state ? [...state.cut] : [],
      facing: state?.facing ?? 0,
      player: this.renderer ? this.renderer.playerAt() : null,
    };
  }
}
