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
}

interface Window {
  __bonsai?: BonsaiTestHook;
}
