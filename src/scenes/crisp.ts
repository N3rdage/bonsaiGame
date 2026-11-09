import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, cameraZoom } from '../world/resolution';

/** Device px per logical px the scene's camera renders at, horizontally. */
export function sceneZoom(scene: Phaser.Scene): number {
  return scene.cameras.main.zoomX;
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

function applyZoom(scene: Phaser.Scene): void {
  const zoom = cameraZoom(scene.scale.width, scene.scale.height);
  scene.cameras.main.setZoom(zoom.x, zoom.y).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  for (const text of texts(scene.children.list)) text.setResolution(zoom.x);
}

/**
 * Zooms the scene's camera so the logical 480x270 world fills the device-px
 * canvas (src/world/resolution.ts), and keeps it so on every resize, with
 * every Text re-rendered at the new zoom; `onResize` runs after each refit.
 */
export function fitCamera(scene: Phaser.Scene, onResize: () => void): void {
  // The camera manager's own resize listener, added at scene boot, has already
  // resized the camera's viewport to the new canvas when this one runs.
  const refit = (): void => {
    applyZoom(scene);
    onResize();
  };
  applyZoom(scene);
  scene.scale.on('resize', refit);
  scene.events.once('shutdown', () => {
    scene.scale.off('resize', refit);
  });
}

/** A Text in logical px whose texture is drawn at the camera's zoom, so its glyphs land 1:1 on device px. */
export function crispText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, style).setResolution(sceneZoom(scene));
}
