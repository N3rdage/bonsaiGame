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

/** Snapshot of the 3D viewer: camera pose, pot and tree mesh shown, and frames drawn so far. */
interface BonsaiViewerHook {
  readonly open: boolean;
  readonly yaw: number;
  readonly pitch: number;
  readonly distance: number;
  readonly targetZ: number;
  readonly potTier: number;
  readonly renders: number;
  /** `tree.revision` the current tree mesh was built from, or -1 when closed. */
  readonly revision: number;
  /** Vertex count of the tree (trunk and branch) mesh, or 0 when closed. */
  readonly meshVertices: number;
  /** Season the foliage is drawn for (passed in by the caller), or '' when closed. */
  readonly season: string;
  /** Vertex count of the foliage mesh, or 0 when closed or the species is bare this season. */
  readonly foliageVertices: number;
  /** True once the foliage sprite has loaded and is bound to the foliage material. */
  readonly foliageReady: boolean;
  /** Interaction mode: 'view', 'wire', 'clip' or 'prune'. Reset to 'view' on open. */
  readonly mode: string;
  /** What a wire-mode click does: 'bend' or 'remove'. */
  readonly wireAction: string;
  /** Screen-relative bend direction: 'up', 'left', 'down' or 'right'. */
  readonly bendDir: string;
  /** Wire + bend: hotspots shown on branches that already carry wire. */
  readonly showWired: boolean;
  /** Wire + bend: hotspots shown on branches without wire. */
  readonly showUnwired: boolean;
  /** Hotspots on screen after the last frame, one per `.hotspot` button; empty when closed. */
  readonly hotspots: readonly BonsaiViewerHotspot[];
  /** `inventory.wire` of the game state the viewer was opened with, or 0 when closed. */
  readonly wireStock: number;
  /** `day` of the game state the viewer was opened with, or -1 when closed (day 0 is a real day). */
  readonly day: number;
  /** Branch the wire-removal confirmation (`#viewer-modal`) is open for, or -1 when none. */
  readonly modal: number;
  /** `paused` of the game state the viewer was opened with (true while open), or false when closed. */
  readonly paused: boolean;
  /** Branches on the tree shown, or 0 when closed. */
  readonly branchCount: number;
  /** Each branch's length in cm, by index; empty when closed. */
  readonly lengths: readonly number[];
  /** Each branch's horizontal and vertical bend in degrees and whether it carries wire, by index; empty when closed. */
  readonly bends: readonly {
    readonly bend: number;
    readonly bendV: number;
    readonly wired: boolean;
  }[];
  /** Trunk bend events (`tree.trunk.movement.length`), or 0 when closed. */
  readonly trunkEvents: number;
  /** The tree's vitality, or 0 when closed. */
  readonly vitality: number;
}

/** One on-screen hotspot, positioned in CSS px from the viewport's top left. */
interface BonsaiViewerHotspot {
  readonly kind: 'branch' | 'trunk';
  /** Branch index, or the trunk slot 0..3 from the base up. */
  readonly id: number;
  /** Text drawn on it: the branch index, or the trunk height in whole cm. */
  readonly label: string;
  readonly x: number;
  readonly y: number;
  /** Wire mode, wired branch: the wire's age, e.g. '0d (early)'; '' otherwise. */
  readonly caption: string;
}

interface Window {
  __bonsai?: BonsaiTestHook;
}
