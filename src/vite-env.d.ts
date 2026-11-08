/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Injected at build time from package.json (see vite.config.ts). */
declare const __APP_VERSION__: string;

/**
 * Test hook. The game publishes a small read-only snapshot of its state here so
 * browser tests (and the autonomous dev agent) can assert on what the canvas is
 * showing without scraping pixels. Keep it minimal and additive.
 */
interface BonsaiTestHook {
  readonly ready: boolean;
  readonly version: string;
  readonly scene: string;
  readonly season: string;
  readonly day: number;
  readonly trees: number;
  /** Score of the starter tree in a fresh game, or -1 if there is none. */
  readonly starterScore: number;
  /** Trunk height of the starter tree in cm, or -1 if there is none. */
  readonly starterHeightCm: number;
  /** The 3D tree viewer, once the scene has created it. */
  readonly viewer?: BonsaiViewerHook;
}

/** Snapshot of the 3D viewer: camera pose, pot shown, and frames drawn so far. */
interface BonsaiViewerHook {
  readonly open: boolean;
  readonly yaw: number;
  readonly pitch: number;
  readonly distance: number;
  readonly targetZ: number;
  readonly potTier: number;
  readonly renders: number;
}

interface Window {
  __bonsai?: BonsaiTestHook;
}
