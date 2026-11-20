/**
 * The engine pages' read-only test hook, `window.__spikeEngine`, which
 * e2e/spikeEngines.spec.ts reads; `session.ts` publishes it every frame, so
 * every engine page publishes the same shape. The game's `window.__bonsai`
 * is not touched.
 */

import type { BenchResult } from './bench';
import type { OrbitState } from './orbit';
import type { OccluderKey, RoomKey } from './scene';

export interface SpikeEngineHook {
  /** 'three' or 'babylon'. */
  readonly engine: string;
  /** True once the scene's textures and the tree are in and a frame has been drawn with them. */
  readonly ready: boolean;
  /** The player's feet, site metres (x east, y south). */
  readonly player: { readonly x: number; readonly y: number };
  readonly camera: OrbitState;
  readonly room: RoomKey;
  /** The occluders drawn faded this frame, sorted. */
  readonly faded: readonly OccluderKey[];
  /** Frames drawn since the page opened. */
  readonly frames: number;
  /** Draw calls in the last frame, as the engine counts them. */
  readonly drawCalls: number;
  /** Whether a benchmark run is under way. */
  readonly benchRunning: boolean;
  /** The last finished run, if any. */
  readonly lastBenchmark: BenchResult | undefined;
}

declare global {
  interface Window {
    __spikeEngine?: SpikeEngineHook;
  }
}
