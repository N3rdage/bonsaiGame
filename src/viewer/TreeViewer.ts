import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  NoColorSpace,
  PerspectiveCamera,
  Scene,
  TextureLoader,
  WebGLRenderer,
  type Texture,
} from 'three';
import type { Season } from '../sim/seasons';
import { applyWire, clipBranch, pruneBranch, removeWire, wireTrunk } from '../sim/training';
import type { BonsaiTree, GameState, PotTier, Vec3 } from '../sim/types';
import {
  FAR,
  FOV_DEGREES,
  NEAR,
  createOrbitCamera,
  pinchZoom,
  resetCamera,
  rotateCamera,
  targetZForTree,
  zoomCamera,
  type OrbitCamera,
} from './camera';
import foliageUrl from './foliage.png';
import { buildFoliageMesh } from './foliageMesh';
import {
  HOTSPOT_ALPHA,
  HOTSPOT_ALPHA_HOVER,
  HOTSPOT_HIT_RADIUS,
  HOTSPOT_RADIUS,
  HOTSPOT_RADIUS_HOVER,
  bendAxis,
  branchBendSign,
  branchBendTarget,
  createViewerUiState,
  hotspotWorldPoints,
  trunkBendWorldAngle,
  uiStripHeight,
  type BendDir,
  type ScreenPoint,
  type ViewerMode,
  type ViewerUiState,
  type WireAction,
  type WorldHotspot,
} from './hotspots';
import type { MeshArrays } from './meshArrays';
import { wireRemovalModel } from './modal';
import { buildPotGeometry } from './potGeometry';
import type { Rgb } from './potPalette';
import { projectToScreen } from './projection';
import { CAPTION_GAP, buildToolbarModel, type ToolbarModel, type ToolbarToggle } from './toolbar';
import { buildTreeMesh } from './treeMesh';
import { placeCamera } from './threeCamera';
import { ViewerModal } from './ViewerModal';
import { ViewerToolbar } from './ViewerToolbar';

function toGeometry({ positions, colors, uvs }: MeshArrays): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  return geometry;
}

function rgba({ r, g, b }: Rgb, alpha: number): string {
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
}

/** The prototype's mode shortcuts (Step_0). */
const MODE_KEYS: Partial<Record<string, ViewerMode>> = {
  v: 'view',
  w: 'wire',
  c: 'clip',
  p: 'prune',
};

/**
 * The 3D tree viewer: a WebGL canvas fixed over the Phaser canvas, shown only
 * while open. It owns rendering and input; camera maths and meshes come from
 * the pure modules beside it. Renders on demand (one frame per change), never
 * in a loop, so a still view is a stable image.
 *
 * Hotspots are DOM buttons in an overlay above the canvas, laid out after
 * every frame from the pure `hotspots.ts` and `projectToScreen`. Clicking one
 * clips, prunes, wires or bends through `src/sim/training.ts`, or opens the
 * wire-removal confirmation (`ViewerModal`). The toolbar, wire sub-row and
 * help lines are DOM too (`ViewerToolbar`), drawn after every frame from the
 * pure `toolbar.ts`.
 *
 * The viewer's only write to the game state passed to `open` is
 * `state.paused`: true while open, false again on close, so the simulation
 * stands still while the player trains (the prototype's `global.game_paused`).
 * Everything else, tree included, is written by the training functions (they
 * consume wire and bump `tree.revision`).
 */
export class TreeViewer {
  onClose?: () => void;
  /** Called after every frame is drawn. */
  onRender?: () => void;

  private readonly canvas: HTMLCanvasElement;
  private readonly hotspotLayer: HTMLDivElement;
  private readonly toolbar: ViewerToolbar;
  private readonly modal: ViewerModal;
  /** Branch the wire-removal confirmation is open for, -1 when none. */
  private pendingWireRemoval = -1;
  private state: GameState | undefined;
  private renderer: WebGLRenderer | undefined;
  private rendererFailed = false;
  private readonly scene = new Scene();
  /** Every mesh lives here; y is mirrored to match the prototype (see `toViewerSpace`). */
  private readonly world = new Group();
  private readonly camera = new PerspectiveCamera(FOV_DEGREES, 1, NEAR, FAR);
  // Unlit vertex colours with no culling: what the prototype drew.
  private readonly material = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  // The prototype's foliage pass: alpha test at 128 of 255, no culling, and
  // the vertex colour tinting the neutral sprite into each species' seasonal
  // colour. The map is assigned once the sprite has loaded.
  private readonly foliageMaterial = new MeshBasicMaterial({
    vertexColors: true,
    side: DoubleSide,
    alphaTest: 0.5,
  });
  private foliageTexture: Texture | undefined;
  private pot: Mesh | undefined;
  private tree: BonsaiTree | undefined;
  private treeMesh: Mesh | undefined;
  private foliageMesh: Mesh | undefined;
  /** `tree.revision` the current tree mesh was built from, -1 when none. */
  private builtRevision = -1;
  /** Season shown: an input from the caller, never derived from the tree or a day counter. */
  private season: Season | undefined;
  /** `tree.revision` and season the current foliage mesh was built from. */
  private foliageBuilt: { revision: number; season: Season } | undefined;
  private cam: OrbitCamera = createOrbitCamera();
  private ui: ViewerUiState = createViewerUiState();
  /** Hotspots on screen now, in CSS px, matching the overlay's buttons. */
  private hotspots: BonsaiViewerHotspot[] = [];
  private potTier: PotTier = 0;
  private renders = 0;
  private frame: number | undefined;
  private wheelHandled = false;
  /** Pointers taking part in the gesture under way, by id: their last client position. */
  private readonly pointers = new Map<number, ScreenPoint>();
  /** One pointer drags (orbits); two pinch (zoom from the camera as it was when the second landed). */
  private gesture:
    | { kind: 'drag'; pointerId: number }
    | { kind: 'pinch'; ids: readonly [number, number]; startPx: number; cam: OrbitCamera }
    | undefined;
  private opened = false;
  private destroyed = false;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'viewer';
    this.hotspotLayer = document.createElement('div');
    this.hotspotLayer.id = 'viewer-hotspots';
    this.hotspotLayer.style.setProperty('--hotspot-size', `${String(2 * HOTSPOT_RADIUS)}px`);
    this.hotspotLayer.style.setProperty(
      '--hotspot-size-hover',
      `${String(2 * HOTSPOT_RADIUS_HOVER)}px`,
    );
    this.hotspotLayer.style.setProperty(
      '--hotspot-hit-size',
      `${String(2 * HOTSPOT_HIT_RADIUS)}px`,
    );
    this.hotspotLayer.style.setProperty('--hotspot-caption-gap', `${String(CAPTION_GAP)}px`);
    parent.append(this.canvas, this.hotspotLayer);
    this.toolbar = new ViewerToolbar(parent);
    this.toolbar.onMode = (mode) => {
      this.setMode(mode);
    };
    this.toolbar.onToggle = this.onToggle;
    this.toolbar.onExit = () => {
      this.close();
    };
    this.toolbar.onCamera = (action) => {
      if (action === 'reset') this.setCamera(resetCamera(this.cam));
      else this.setCamera(zoomCamera(this.cam, action === 'in' ? -1 : 1));
    };
    this.modal = new ViewerModal(parent);
    this.modal.onCancel = () => {
      this.setPendingWireRemoval(-1);
    };
    this.modal.onRemove = (branchId) => {
      if (this.tree && this.state) removeWire(this.tree, this.state, branchId);
      this.setPendingWireRemoval(-1);
    };

    this.camera.up.set(0, 0, 1);
    this.world.scale.set(1, -1, 1);
    this.scene.add(this.world);

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);

    new TextureLoader().load(foliageUrl, this.onFoliageLoaded);
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /**
   * Shows the tree with its foliage as it looks in `season`, reading the wire
   * stock and day from `state` and pausing it (`state.paused = true`, the
   * viewer's only write to it) until `close`. Returns false, stays hidden and
   * leaves the state unpaused if WebGL is unavailable.
   */
  open(tree: BonsaiTree, season: Season, state: GameState): boolean {
    if (!this.ensureRenderer()) return false;
    this.opened = true;
    if (this.state) this.state.paused = false;
    this.state = state;
    state.paused = true;
    this.potTier = tree.potTier;
    this.cam = {
      ...createOrbitCamera(),
      target: { x: 0, y: 0, z: targetZForTree(tree.trunk.heightCm) },
    };
    this.ui = createViewerUiState();
    this.pendingWireRemoval = -1;
    this.disposeMeshes();
    this.pot = new Mesh(toGeometry(buildPotGeometry(tree.potTier)), this.material);
    this.world.add(this.pot);
    this.tree = tree;
    this.season = season;
    this.rebuildTreeMesh(tree);
    this.rebuildFoliageMesh(tree, season);
    this.canvas.classList.add('open');
    this.hotspotLayer.classList.add('open');
    this.resize();
    this.requestRender();
    return true;
  }

  /** Changes the season shown; while open, the foliage is rebuilt before the next frame. */
  setSeason(season: Season): void {
    if (!this.opened || season === this.season) return;
    this.season = season;
    this.requestRender();
  }

  setMode(mode: ViewerMode): void {
    this.updateUi({ mode });
  }

  setWireAction(wireAction: WireAction): void {
    this.updateUi({ wireAction });
  }

  setBendDir(bendDir: BendDir): void {
    this.updateUi({ bendDir });
  }

  setShowWired(showWired: boolean): void {
    this.updateUi({ showWired });
  }

  setShowUnwired(showUnwired: boolean): void {
    this.updateUi({ showUnwired });
  }

  /** Hides the viewer and unpauses the state it was opened with. */
  close(): void {
    if (!this.opened) return;
    this.opened = false;
    if (this.state) this.state.paused = false;
    this.state = undefined;
    this.endGesture();
    this.pendingWireRemoval = -1;
    this.clearHotspots();
    this.canvas.classList.remove('open');
    this.hotspotLayer.classList.remove('open');
    this.toolbar.hide();
    this.modal.render(undefined);
    this.disposeMeshes();
    this.onClose?.();
  }

  destroy(): void {
    this.close();
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.renderer?.dispose();
    this.material.dispose();
    this.foliageMaterial.dispose();
    this.foliageTexture?.dispose();
    this.canvas.remove();
    this.hotspotLayer.remove();
    this.toolbar.destroy();
    this.modal.destroy();
  }

  snapshot(): BonsaiViewerHook {
    const branches = this.tree?.branches ?? [];
    return {
      open: this.opened,
      yaw: this.cam.yaw,
      pitch: this.cam.pitch,
      distance: this.cam.distance,
      targetZ: this.cam.target.z,
      potTier: this.potTier,
      renders: this.renders,
      revision: this.builtRevision,
      meshVertices: this.treeMesh ? this.treeMesh.geometry.getAttribute('position').count : 0,
      season: this.season ?? '',
      foliageVertices: this.foliageMesh
        ? this.foliageMesh.geometry.getAttribute('position').count
        : 0,
      foliageReady: this.foliageTexture !== undefined,
      mode: this.ui.mode,
      wireAction: this.ui.wireAction,
      bendDir: this.ui.bendDir,
      showWired: this.ui.showWired,
      showUnwired: this.ui.showUnwired,
      hotspots: this.hotspots,
      wireStock: this.state?.inventory.wire ?? 0,
      day: this.state?.day ?? -1,
      modal: this.pendingWireRemoval,
      paused: this.state?.paused ?? false,
      branchCount: branches.length,
      lengths: branches.map((b) => b.length),
      bends: branches.map(({ bend, bendV, wired }) => ({ bend, bendV, wired })),
      trunkEvents: this.tree?.trunk.movement.length ?? 0,
      vitality: this.tree?.vitality ?? 0,
    };
  }

  private ensureRenderer(): boolean {
    if (this.renderer) return true;
    if (this.rendererFailed) return false;
    try {
      // No MSAA: the prototype drew without it, and it is the main cross-machine pixel variation.
      this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: false });
    } catch (err) {
      this.rendererFailed = true;
      console.warn('3D viewer unavailable: could not create a WebGL renderer.', err);
      return false;
    }
    // Palette values are already display sRGB; pass them through untouched.
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    // The prototype's viewer room (rm_viewer_3d) clears to black.
    this.renderer.setClearColor(0x000000);
    return true;
  }

  private disposeMesh(mesh: Mesh | undefined): void {
    if (!mesh) return;
    this.world.remove(mesh);
    mesh.geometry.dispose();
  }

  private disposeMeshes(): void {
    this.disposeMesh(this.pot);
    this.disposeMesh(this.treeMesh);
    this.disposeMesh(this.foliageMesh);
    this.pot = undefined;
    this.treeMesh = undefined;
    this.foliageMesh = undefined;
    this.tree = undefined;
    this.season = undefined;
    this.builtRevision = -1;
    this.foliageBuilt = undefined;
  }

  /** Replaces the tree mesh with one built from the tree as it is now. */
  private rebuildTreeMesh(tree: BonsaiTree): void {
    this.disposeMesh(this.treeMesh);
    this.treeMesh = new Mesh(toGeometry(buildTreeMesh(tree)), this.material);
    this.world.add(this.treeMesh);
    this.builtRevision = tree.revision;
  }

  /** Replaces the foliage mesh with one built from the tree as it is now, in `season`. */
  private rebuildFoliageMesh(tree: BonsaiTree, season: Season): void {
    this.disposeMesh(this.foliageMesh);
    this.foliageMesh = new Mesh(toGeometry(buildFoliageMesh(tree, season)), this.foliageMaterial);
    this.world.add(this.foliageMesh);
    this.foliageBuilt = { revision: tree.revision, season };
  }

  private readonly onFoliageLoaded = (texture: Texture): void => {
    if (this.destroyed) {
      texture.dispose();
      return;
    }
    // Sprite bytes pass through untouched, like the palette colours, and stay crisp.
    texture.colorSpace = NoColorSpace;
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    this.foliageTexture = texture;
    this.foliageMaterial.map = texture;
    this.foliageMaterial.needsUpdate = true;
    if (this.opened) this.requestRender();
  };

  private updateUi(change: Partial<ViewerUiState>): void {
    const next = { ...this.ui, ...change };
    const keys = Object.keys(next) as (keyof ViewerUiState)[];
    if (keys.every((key) => next[key] === this.ui[key])) return;
    this.ui = next;
    this.requestRender();
  }

  private clearHotspots(): void {
    this.hotspots = [];
    this.hotspotLayer.replaceChildren();
  }

  /** Rebuilds the overlay for the camera as just placed and rendered. */
  private layoutHotspots(tree: BonsaiTree, model: ToolbarModel): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const hotspots: BonsaiViewerHotspot[] = [];
    const buttons: HTMLButtonElement[] = [];
    for (const hotspot of hotspotWorldPoints(tree, this.ui)) {
      const { kind, id, label, world, color } = hotspot;
      const screen = projectToScreen(this.camera, world, width, height);
      if (!screen) continue;
      const caption = kind === 'branch' ? (model.branchCaptions[id] ?? '') : '';
      hotspots.push({ kind, id, label, x: screen.x, y: screen.y, caption });
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hotspot';
      button.addEventListener('click', () => {
        this.onHotspot(hotspot);
      });
      button.dataset.kind = kind;
      button.dataset.id = String(id);
      button.textContent = label;
      if (caption !== '') {
        const span = document.createElement('span');
        span.className = 'caption';
        span.textContent = caption;
        button.append(span);
      }
      button.style.left = `${String(screen.x)}px`;
      button.style.top = `${String(screen.y)}px`;
      button.style.setProperty('--hotspot-fill', rgba(color, HOTSPOT_ALPHA));
      button.style.setProperty('--hotspot-fill-hover', rgba(color, HOTSPOT_ALPHA_HOVER));
      buttons.push(button);
    }
    this.hotspots = hotspots;
    this.hotspotLayer.replaceChildren(...buttons);
  }

  private setCamera(cam: OrbitCamera): void {
    this.cam = cam;
    this.requestRender();
  }

  private requestRender(): void {
    if (this.frame !== undefined) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      this.wheelHandled = false;
      if (!this.opened || !this.renderer) return;
      if (this.tree && this.tree.revision !== this.builtRevision) this.rebuildTreeMesh(this.tree);
      const built = this.foliageBuilt;
      if (
        this.tree &&
        this.season &&
        (this.tree.revision !== built?.revision || this.season !== built.season)
      ) {
        this.rebuildFoliageMesh(this.tree, this.season);
      }
      placeCamera(this.camera, this.cam);
      this.renderer.render(this.scene, this.camera);
      this.renders += 1;
      if (this.tree && this.state) {
        const model = buildToolbarModel(
          this.tree,
          this.ui,
          this.state.inventory.wire,
          this.state.day,
        );
        this.layoutHotspots(this.tree, model);
        this.toolbar.render(model, window.innerWidth);
        const modalOpen = this.pendingWireRemoval >= 0;
        this.hotspotLayer.inert = modalOpen;
        this.toolbar.setInert(modalOpen);
        this.modal.render(
          modalOpen
            ? wireRemovalModel(this.tree, this.pendingWireRemoval, this.state.day)
            : undefined,
        );
      }
      this.onRender?.();
    });
  }

  private resize(): void {
    if (!this.renderer) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private readonly onResize = (): void => {
    if (!this.opened) return;
    this.resize();
    this.requestRender();
  };

  private endGesture(): void {
    this.gesture = undefined;
    this.pointers.clear();
  }

  private pinchDistance([a, b]: readonly [number, number]): number {
    const p = this.pointers.get(a);
    const q = this.pointers.get(b);
    return p && q ? Math.hypot(p.x - q.x, p.y - q.y) : 0;
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const { gesture } = this;
    if (gesture?.kind === 'pinch') return;
    const point = { x: e.clientX, y: e.clientY };
    if (gesture?.kind === 'drag') {
      // A second finger turns the drag into a pinch.
      this.canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, point);
      const ids = [gesture.pointerId, e.pointerId] as const;
      this.gesture = { kind: 'pinch', ids, startPx: this.pinchDistance(ids), cam: this.cam };
      return;
    }
    // The top strip is the toolbar's: a press there never starts a drag (Step_0).
    if (e.clientY <= uiStripHeight(this.ui.mode)) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, point);
    this.gesture = { kind: 'drag', pointerId: e.pointerId };
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const last = this.pointers.get(e.pointerId);
    const { gesture } = this;
    if (!last || !gesture) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture.kind === 'drag') {
      this.setCamera(rotateCamera(this.cam, e.clientX - last.x, e.clientY - last.y));
    } else {
      this.setCamera(pinchZoom(gesture.cam, gesture.startPx, this.pinchDistance(gesture.ids)));
    }
  };

  // Lifting either pinch finger ends the pinch; the one left down needs a new press to drag.
  private readonly onPointerUp = (e: PointerEvent): void => {
    if (this.pointers.has(e.pointerId)) this.endGesture();
  };

  // The prototype applied at most one zoom step per frame; so does this.
  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (e.deltaY === 0 || this.wheelHandled) return;
    this.wheelHandled = true;
    this.setCamera(zoomCamera(this.cam, e.deltaY > 0 ? 1 : -1));
  };

  private readonly onToggle = (toggle: ToolbarToggle): void => {
    switch (toggle.kind) {
      case 'action':
        this.setWireAction(toggle.value);
        break;
      case 'dir':
        this.setBendDir(toggle.value);
        break;
      case 'show':
        if (toggle.value === 'wired') this.setShowWired(!this.ui.showWired);
        else this.setShowUnwired(!this.ui.showUnwired);
        break;
    }
  };

  private setPendingWireRemoval(branchId: number): void {
    // A drag or pinch cannot outlive the modal opening (Step_0).
    this.endGesture();
    this.pendingWireRemoval = branchId;
    this.requestRender();
  }

  /** The screen projection the hotspots were laid out with, for `branchBendSign`. */
  private readonly project = (p: Vec3): ScreenPoint | undefined =>
    projectToScreen(this.camera, p, window.innerWidth, window.innerHeight);

  /**
   * A hotspot click (Draw_64 `_draw_branch_hotspots`, `_draw_trunk_hotspots`).
   * The training functions refuse without wire; a successful one bumps
   * `tree.revision`, so the next frame rebuilds the mesh and the toolbar.
   */
  private onHotspot({ kind, id, t }: WorldHotspot): void {
    const { tree, state, ui } = this;
    if (!tree || !state || this.pendingWireRemoval >= 0) return;
    // A pending frame means the buttons may be stale (a prune renumbers branches): wait for it.
    if (this.frame !== undefined) return;
    if (kind === 'trunk') {
      wireTrunk(
        tree,
        state,
        t * tree.trunk.heightCm,
        trunkBendWorldAngle(ui.bendDir, this.cam.yaw),
      );
    } else if (ui.mode === 'clip') {
      clipBranch(tree, state, id, 1);
    } else if (ui.mode === 'prune') {
      pruneBranch(tree, state, id);
    } else if (ui.mode === 'wire') {
      const branch = tree.branches[id];
      if (!branch) return;
      if (ui.wireAction === 'remove') {
        if (branch.wired) this.setPendingWireRemoval(id);
        return;
      }
      const sign = branchBendSign(tree, branch, ui.bendDir, bendAxis(ui.bendDir), this.project);
      const { bend, bendV } = branchBendTarget(branch, ui.bendDir, sign);
      applyWire(tree, state, id, bend, bendV);
    }
    this.requestRender();
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.opened) return;
    // The confirmation takes the keyboard: Escape closes it, nothing else acts (Step_0).
    if (this.pendingWireRemoval >= 0) {
      if (e.key === 'Escape') this.setPendingWireRemoval(-1);
      return;
    }
    if (e.key === 'Escape') {
      this.close();
      return;
    }
    // Leave browser and OS shortcuts (Ctrl+R, Cmd+W, ...) alone.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    const mode = MODE_KEYS[key];
    if (mode) this.setMode(mode);
    else if (key === 'r') this.setCamera(resetCamera(this.cam));
  };
}
