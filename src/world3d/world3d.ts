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
  private wanted = false;

  constructor(private readonly host: HTMLCanvasElement) {}

  /** True once the renderer is up, which is when the 2D world stops drawing. */
  get active(): boolean {
    return this.renderer !== undefined;
  }

  /** Follows the setting: starts loading the renderer when it turns on, drops it when it turns off, and draws a frame while it is up. */
  sync(on: boolean, room: Room, player: { readonly x: number; readonly y: number }): void {
    this.wanted = on;
    if (on && !this.renderer && !this.loading) {
      this.loading = true;
      void import('./renderer')
        .then(({ Renderer: Created }) => {
          if (this.wanted) this.renderer = new Created(this.host);
        })
        .finally(() => {
          this.loading = false;
        });
    }
    if (!on) this.dispose();
    this.renderer?.frame(room, player);
  }

  /** Lets the renderer and its canvas go. */
  dispose(): void {
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
      player: this.renderer ? this.renderer.playerAt() : null,
    };
  }
}
