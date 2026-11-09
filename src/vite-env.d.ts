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
  /** Device pixels per logical pixel the scene's camera renders at (canvas width / 480); 1 would mean the camera is not fitted. */
  readonly zoom: number;
  /** World: the season of the game day at the last publish. Title: ''. */
  readonly season: string;
  /** World: the game day at the last publish (the day clock moves it). Title: -1. */
  readonly day: number;
  readonly trees: number;
  /** Score of the first tree in the state played, or -1 if there is none (always on the title). */
  readonly starterScore: number;
  /** Trunk height of the starter tree in cm, or -1 if there is none. */
  readonly starterHeightCm: number;
  /** The game state's own `paused` flag at the last publish: true only while the 3D viewer is open. */
  readonly paused: boolean;
  /** The 3D tree viewer, once the scene has created it. */
  readonly viewer?: BonsaiViewerHook;
  /** Key of the room the world is showing, 'shed' or 'garden'; '' on the title. */
  readonly room: string;
  /** The 2D player in logical px (feet position) and its facing: 'right', 'left', 'down' or 'up'. */
  readonly player: { readonly x: number; readonly y: number; readonly facing: string };
  /** The world HUD badge text (it is drawn only while the viewer is closed). */
  readonly hud: string;
  /** Fixed 60 Hz world steps run so far; the world does not step while the viewer is open. */
  readonly frames: number;
  /** Save slot the world saves to (F5) and loads from (F9); 0 on the title. */
  readonly activeSlot: number;
  /** Readable saves (empty and corrupt slots left out), read when the title shows and after each save. */
  readonly slots: readonly {
    readonly slot: number;
    readonly day: number;
    readonly money: number;
    readonly savedAt: string;
  }[];
  /** World: the save toast (e.g. 'Saved to slot 1') while shown. Title: its message line. '' when none. */
  readonly toast: string;
  /** Title only: the open panel, 'new' or 'load' (slot picker) or 'confirm' (overwrite); '' otherwise. */
  readonly picker: string;
  /** World only: the open panel, 'menu' (HUD menu), 'slots' (load picker), 'tree:<id>' (a tree's inspector), its sub-panels 'repot:<id>', 'rename:<id>', 'style:<id>' and 'sell:<id>', 'pedestal:<pedestalKey>' (an empty pedestal), 'shop', 'plant' (Plant a Cutting), 'notebook' or 'tutorial-skip' (the Skip confirmation); '' otherwise (always on the title). */
  readonly panel: string;
  /** World only: key of the prop within interact range of the player, 'tree:<id>' for a tree on the floor, or '' (always on the title). */
  readonly near: string;
  /** World only: label (name, or species display name) of the tree carried (location 'inventory'), or '' (always on the title). */
  readonly carrying: string;
  /** World only: every tree in the state, in order, with its label and `location` ('shed', 'garden', 'inventory', 'sold', 'displayed:<pedestalKey>'); empty on the title. */
  readonly treeLocations: readonly {
    readonly id: number;
    readonly name: string;
    readonly location: string;
  }[];
  /** World: the game state's inventory counts by InventoryKey ('fertilizer', 'wire', ...). Title: every count 0. */
  readonly inventory: Readonly<Record<string, number>>;
  /** World: `state.tutorialStep` (0 Water, 1 Skip a week, ..., -1 done). Title: -1. */
  readonly tutorialStep: number;
  /** World only: the step label the tutorial corner panel shows, '' while it is not shown (tutorial done, or under the viewer). */
  readonly tutorialLabel?: string;
  /** World only: the open notebook page's indicator ('Page 1 / 5'), title and badge ('done', 'in progress', 'not yet', '' on the finale); undefined while the notebook is closed. */
  readonly notebook?:
    { readonly indicator: string; readonly title: string; readonly badge: string } | undefined;
  /** World only: the tree whose inspector (panel 'tree:<id>') is open, or undefined. */
  readonly inspected:
    | {
        readonly id: number;
        readonly waterLevel: number;
        readonly fertilizedUntilDay: number;
        readonly ageDays: number;
        readonly vitality: number;
        readonly vigor: number;
        readonly heightCm: number;
        readonly revision: number;
        /** `tree.name` ('' when unnamed). */
        readonly name: string;
        /** The style key the score measures against, or ''. */
        readonly targetStyle: string;
        readonly potTier: number;
        readonly soilTier: number;
        /** `scoreTree(tree).total`, derived at publish. */
        readonly score: number;
      }
    | undefined;
  /** World: `state.money`. Title: 0. */
  readonly money: number;
  /**
   * Every tappable Phaser control on screen, by id, with its centre in logical px (480x270); empty under the viewer.
   * Includes the tree inspector's enabled buttons 'panel-water', 'panel-fertilise', 'panel-skip', 'panel-pickup'
   * and 'panel-view', and its second row's 'panel-rename', 'panel-style', 'panel-sell' and 'panel-repot' (a greyed one is
   * not listed); the sub-panels' 'panel-soil', 'panel-repot-standard', 'panel-repot-fancy' (each only with a pot in stock),
   * 'panel-rename-save', 'panel-style-<key>', 'panel-style-none' and 'panel-sell'; 'panel-place' (an empty pedestal's
   * panel while carrying) and 'menu-putdown' (the HUD menu while carrying); 'notebook' (the HUD's Notebook (J)) and
   * 'tutorial-skip' (the tutorial corner panel's Skip, with no modal open); the notebook's 'panel-prev' and 'panel-next'
   * (enabled ones) and the Skip confirmation's 'panel-cancel' and 'panel-skip'; Plant a Cutting's
   * 'panel-select-<species>' (unselected cuttings), 'panel-fancy' and 'panel-soil' (while shown) and 'panel-plant' (while enabled).
   */
  readonly controls: readonly { readonly id: string; readonly x: number; readonly y: number }[];
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
