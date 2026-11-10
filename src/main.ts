import Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';
import { canvasSize, deviceScale } from './world/resolution';

registerSW({ immediate: true });

/** The canvas backing that covers the fitted display in device px (src/world/resolution.ts). */
function targetSize(): { width: number; height: number } {
  return canvasSize(deviceScale(window.innerWidth, window.innerHeight, window.devicePixelRatio));
}

const initial = targetSize();
const game = new Phaser.Game({
  // WebGL explicitly: the room's baked quad is a Shader (WorldScene) and the 3D viewer is Three.js.
  type: Phaser.WEBGL,
  parent: 'game',
  width: initial.width,
  height: initial.height,
  backgroundColor: '#1d2a1c',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // The viewer and the rename input are siblings of #game, so the whole document goes fullscreen, not a wrapper around the canvas.
    fullscreenTarget: document.documentElement,
  },
  scene: [BootScene, TitleScene, WorldScene],
});

// A window resize or rotation refits the display and emits resize; the backing
// follows it to the new device px. Our own setGameSize emits resize again, and
// that pass finds the size already right, which ends the loop.
game.scale.on('resize', () => {
  const { width, height } = targetSize();
  if (width !== game.scale.width || height !== game.scale.height) {
    game.scale.setGameSize(width, height);
  }
});
