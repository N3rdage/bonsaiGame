import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
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
import type { MeshArrays } from './meshArrays';
import { buildPotGeometry } from './potGeometry';
import { placeCamera } from './threeCamera';

function toGeometry({ positions, colors }: MeshArrays): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

/**
 * The 3D tree viewer: a WebGL canvas fixed over the Phaser canvas, shown only
 * while open. It owns rendering and input; camera maths and meshes come from
 * the pure modules beside it. Renders on demand (one frame per change), never
 * in a loop, so a still view is a stable image.
 */
export class TreeViewer {
  onClose?: () => void;
  /** Called after every frame is drawn. */
  onRender?: () => void;

  private readonly canvas: HTMLCanvasElement;
  private readonly closeButton: HTMLButtonElement;
  private renderer: WebGLRenderer | undefined;
  private rendererFailed = false;
  private readonly scene = new Scene();
  /** Every mesh lives here; y is mirrored to match the prototype (see `toViewerSpace`). */
  private readonly world = new Group();
  private readonly camera = new PerspectiveCamera(FOV_DEGREES, 1, NEAR, FAR);
  // Unlit vertex colours with no culling: what the prototype drew.
  private readonly material = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  private pot: Mesh | undefined;
  private cam: OrbitCamera = createOrbitCamera();
  private potTier: PotTier = 0;
  private renders = 0;
  private frame: number | undefined;
  private wheelHandled = false;
  private drag: { pointerId: number; x: number; y: number } | undefined;
  private opened = false;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'viewer';
    this.closeButton = document.createElement('button');
    this.closeButton.id = 'viewer-close';
    this.closeButton.type = 'button';
    this.closeButton.textContent = 'Close';
    parent.append(this.canvas, this.closeButton);

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
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** Shows the tree. Returns false (and stays hidden) if WebGL is unavailable. */
  open(tree: BonsaiTree): boolean {
    if (!this.ensureRenderer()) return false;
    this.opened = true;
    this.potTier = tree.potTier;
    this.cam = {
      ...createOrbitCamera(),
      target: { x: 0, y: 0, z: targetZForTree(tree.trunk.heightCm) },
    };
    this.disposePot();
    this.pot = new Mesh(toGeometry(buildPotGeometry(tree.potTier)), this.material);
    this.world.add(this.pot);
    this.canvas.classList.add('open');
    this.closeButton.classList.add('open');
    this.resize();
    this.requestRender();
    return true;
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.drag = undefined;
    this.canvas.classList.remove('open');
    this.closeButton.classList.remove('open');
    this.disposePot();
    this.onClose?.();
  }

  destroy(): void {
    this.close();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.renderer?.dispose();
    this.material.dispose();
    this.canvas.remove();
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

  private disposePot(): void {
    if (!this.pot) return;
    this.world.remove(this.pot);
    this.pot.geometry.dispose();
    this.pot = undefined;
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
      placeCamera(this.camera, this.cam);
      this.renderer.render(this.scene, this.camera);
      this.renders += 1;
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
    if (e.key === 'r' || e.key === 'R') this.setCamera(resetCamera(this.cam));
    else if (e.key === 'Escape') this.close();
  };
}
