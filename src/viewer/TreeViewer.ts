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
import type { BonsaiTree, PotTier } from '../sim/types';
import {
  FAR,
  FOV_DEGREES,
  NEAR,
  createOrbitCamera,
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
  HOTSPOT_RADIUS,
  HOTSPOT_RADIUS_HOVER,
  createViewerUiState,
  hotspotWorldPoints,
  uiStripHeight,
  type BendDir,
  type ViewerMode,
  type ViewerUiState,
  type WireAction,
} from './hotspots';
import type { MeshArrays } from './meshArrays';
import { buildPotGeometry } from './potGeometry';
import type { Rgb } from './potPalette';
import { projectToScreen } from './projection';
import { buildTreeMesh } from './treeMesh';
import { placeCamera } from './threeCamera';

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
 * does nothing yet.
 */
export class TreeViewer {
  onClose?: () => void;
  /** Called after every frame is drawn. */
  onRender?: () => void;

  private readonly canvas: HTMLCanvasElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly hotspotLayer: HTMLDivElement;
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
  private drag: { pointerId: number; x: number; y: number } | undefined;
  private opened = false;
  private destroyed = false;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'viewer';
    this.closeButton = document.createElement('button');
    this.closeButton.id = 'viewer-close';
    this.closeButton.type = 'button';
    this.closeButton.textContent = 'Close';
    this.hotspotLayer = document.createElement('div');
    this.hotspotLayer.id = 'viewer-hotspots';
    this.hotspotLayer.style.setProperty('--hotspot-size', `${String(2 * HOTSPOT_RADIUS)}px`);
    this.hotspotLayer.style.setProperty(
      '--hotspot-size-hover',
      `${String(2 * HOTSPOT_RADIUS_HOVER)}px`,
    );
    parent.append(this.canvas, this.hotspotLayer, this.closeButton);

    this.camera.up.set(0, 0, 1);
    this.world.scale.set(1, -1, 1);
    this.scene.add(this.world);

    this.closeButton.addEventListener('click', () => {
      this.close();
    });
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
   * Shows the tree with its foliage as it looks in `season`. Returns false
   * (and stays hidden) if WebGL is unavailable.
   */
  open(tree: BonsaiTree, season: Season): boolean {
    if (!this.ensureRenderer()) return false;
    this.opened = true;
    this.potTier = tree.potTier;
    this.cam = {
      ...createOrbitCamera(),
      target: { x: 0, y: 0, z: targetZForTree(tree.trunk.heightCm) },
    };
    this.ui = createViewerUiState();
    this.disposeMeshes();
    this.pot = new Mesh(toGeometry(buildPotGeometry(tree.potTier)), this.material);
    this.world.add(this.pot);
    this.tree = tree;
    this.season = season;
    this.rebuildTreeMesh(tree);
    this.rebuildFoliageMesh(tree, season);
    this.canvas.classList.add('open');
    this.hotspotLayer.classList.add('open');
    this.closeButton.classList.add('open');
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

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.drag = undefined;
    this.clearHotspots();
    this.canvas.classList.remove('open');
    this.hotspotLayer.classList.remove('open');
    this.closeButton.classList.remove('open');
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
    this.closeButton.remove();
  }

  snapshot(): BonsaiViewerHook {
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
  private layoutHotspots(tree: BonsaiTree): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const hotspots: BonsaiViewerHotspot[] = [];
    const buttons: HTMLButtonElement[] = [];
    for (const { kind, id, label, world, color } of hotspotWorldPoints(tree, this.ui)) {
      const screen = projectToScreen(this.camera, world, width, height);
      if (!screen) continue;
      hotspots.push({ kind, id, label, x: screen.x, y: screen.y });
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hotspot';
      button.dataset.kind = kind;
      button.dataset.id = String(id);
      button.textContent = label;
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
      if (this.tree) this.layoutHotspots(this.tree);
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

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 || !e.isPrimary) return;
    // The top strip is the toolbar's: a press there never starts a drag (Step_0).
    if (e.clientY <= uiStripHeight(this.ui.mode)) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.drag = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.drag?.pointerId) return;
    const dx = e.clientX - this.drag.x;
    const dy = e.clientY - this.drag.y;
    this.drag = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    this.setCamera(rotateCamera(this.cam, dx, dy));
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.drag?.pointerId) return;
    this.drag = undefined;
  };

  // The prototype applied at most one zoom step per frame; so does this.
  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (e.deltaY === 0 || this.wheelHandled) return;
    this.wheelHandled = true;
    this.setCamera(zoomCamera(this.cam, e.deltaY > 0 ? 1 : -1));
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.opened) return;
    const key = e.key.toLowerCase();
    const mode = MODE_KEYS[key];
    if (mode) this.setMode(mode);
    else if (key === 'r') this.setCamera(resetCamera(this.cam));
    else if (e.key === 'Escape') this.close();
  };
}
