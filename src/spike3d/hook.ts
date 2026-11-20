/**
 * The spike page's read-only test hook, `window.__spike3d`, which
 * e2e/spike3d.spec.ts reads. The game's `window.__bonsai` is not touched.
 */

export interface Spike3dHook {
  readonly ready: boolean;
  /** The camera angle shown: 'south', 'cutaway' or 'north'. */
  readonly angle: string;
  /** The player in the front garden's room px (feet position, as `__bonsai.player`) and its facing. */
  readonly player: { readonly x: number; readonly y: number; readonly facing: string };
  /** The key of the prop E would use ('door_house', 'gate'), or ''. */
  readonly near: string;
  /** Frames drawn since the page opened. */
  readonly frames: number;
  /** Mean requestAnimationFrame interval over the last 120 frames, ms; 0 until 120 have been drawn. */
  readonly frameMs: number;
  /** WebGL draw calls and triangles in the last frame. */
  readonly drawCalls: number;
  readonly triangles: number;
}

declare global {
  interface Window {
    __spike3d?: Spike3dHook;
  }
}
