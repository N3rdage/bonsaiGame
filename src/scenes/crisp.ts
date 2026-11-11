import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, cameraZoom } from '../world/resolution';
import { cssPerLogical, hitRect, uiMetrics, type UiMetrics } from '../world/uiScale';

/** Device px per logical px the scene's main camera renders at, horizontally. */
export function sceneZoom(scene: Phaser.Scene): number {
  return scene.cameras.main.zoomX;
}

/**
 * The resolution a Text needs for its glyphs to land 1:1 on device px: the
 * largest zoom of the scene's cameras that draw it (a camera's `ignore` sets
 * its id in the object's `cameraFilter`), or the main camera's.
 */
export function textZoom(scene: Phaser.Scene, text: Phaser.GameObjects.Text): number {
  const zooms = scene.cameras.cameras
    .filter((camera) => (text.cameraFilter & camera.id) === 0)
    .map((camera) => camera.zoomX);
  return zooms.length > 0 ? Math.max(...zooms) : sceneZoom(scene);
}

function texts(objects: readonly Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Text[] {
  return objects.flatMap((o) =>
    o instanceof Phaser.GameObjects.Text
      ? [o]
      : o instanceof Phaser.GameObjects.Container
        ? texts(o.list)
        : [],
  );
}

/** Device px per logical px of a fitted camera, per axis. */
export type DeviceZoom = Readonly<{ x: number; y: number }>;

function applyZoom(scene: Phaser.Scene, fitOthers: (zoom: DeviceZoom) => void): void {
  const zoom = cameraZoom(scene.scale.width, scene.scale.height);
  scene.cameras.main.setZoom(zoom.x, zoom.y).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  fitOthers(zoom);
  for (const text of texts(scene.children.list)) text.setResolution(textZoom(scene, text));
}

/**
 * Zooms the scene's main camera so the logical 480x270 world fills the
 * device-px canvas (src/world/resolution.ts), and keeps it so on every resize;
 * `fitOthers` then fits any other camera from the same device zoom, and every
 * Text is re-rendered at the zoom of the cameras that draw it. `onResize` runs
 * after each refit.
 */
export function fitCamera(
  scene: Phaser.Scene,
  onResize: () => void,
  fitOthers: (zoom: DeviceZoom) => void = () => undefined,
): void {
  // The camera manager's own resize listener, added at scene boot, has already
  // resized the camera's viewport to the new canvas when this one runs.
  const refit = (): void => {
    applyZoom(scene, fitOthers);
    onResize();
  };
  applyZoom(scene, fitOthers);
  scene.scale.on('resize', refit);
  scene.events.once('shutdown', () => {
    scene.scale.off('resize', refit);
  });
}

/**
 * The screen's UI metrics (src/world/uiScale.ts): the fitted canvas's CSS
 * size (`scale.displaySize`) and whether the device has a touch screen.
 * `zoom` is the camera's own zoom over the canvas, 1 for the HUD's.
 */
export function sceneUi(scene: Phaser.Scene, zoom = 1): UiMetrics {
  const { width, height } = scene.scale.displaySize;
  return uiMetrics(cssPerLogical(width, height) * zoom, scene.sys.game.device.input.touch);
}

/**
 * Makes `text` a control whose tappable area is `hitRect` of its bounds:
 * at least `hit` square round its centre and inside the canvas. The area is
 * given in the Text's local space (0..width, 0..height whatever its origin),
 * so it must be applied after the origin is set; applying it again (on a
 * resize) replaces it.
 */
export function setHitArea(text: Phaser.GameObjects.Text, hit: number): Phaser.GameObjects.Text {
  const topLeft = text.getTopLeft();
  const r = hitRect({ x: topLeft.x, y: topLeft.y, w: text.width, h: text.height }, hit);
  const local = new Phaser.Geom.Rectangle(r.x - topLeft.x, r.y - topLeft.y, r.w, r.h);
  if (text.input) {
    text.input.hitArea = local;
    return text;
  }
  return text.setInteractive({
    hitArea: local,
    hitAreaCallback: (area: Phaser.Geom.Rectangle, x: number, y: number) =>
      Phaser.Geom.Rectangle.Contains(area, x, y),
    useHandCursor: true,
  });
}

/** The tappable area `setHitArea` gave `text`, in logical px (top-left and size), for the test hook. */
export function hitArea(text: Phaser.GameObjects.Text): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const topLeft = text.getTopLeft();
  const area = text.input?.hitArea as Phaser.Geom.Rectangle | undefined;
  return area
    ? { x: topLeft.x + area.x, y: topLeft.y + area.y, w: area.width, h: area.height }
    : { x: topLeft.x, y: topLeft.y, w: text.width, h: text.height };
}

/** A Text in logical px whose texture is drawn at the main camera's zoom, so its glyphs land 1:1 on device px. */
export function crispText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, style).setResolution(sceneZoom(scene));
}
