import Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';

// Logical resolution of the pixel-art world. Phaser scales this to fit the window.
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

registerSW({ immediate: true });

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1d2a1c',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, WorldScene],
});
