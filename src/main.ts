import Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';
import { currentViewport, isPhone, isPhonePortrait, lockLandscape } from './platform/orientation';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';
import { canvasSize, deviceScale } from './world/resolution';

registerSW({ immediate: true });

/** Whether the rotate prompt is up (see applyOrientation below). */
let rotatePrompt = false;

// Scenes replace the test hook on each publish; reads add the prompt's state to whatever they published last.
let published: BonsaiTestHook | undefined;
Object.defineProperty(window, '__bonsai', {
  configurable: true,
  get: () => (published ? { ...published, rotatePrompt } : undefined),
  set: (hook: BonsaiTestHook | undefined) => {
    published = hook;
  },
});

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

// A phone in portrait gets the rotate prompt (src/platform/orientation.ts) over
// a paused game: the whole Phaser loop stops, so the day clock and the world
// steps stop with it, and rotating back resumes exactly where it was.
const rotatePromptEl = document.getElementById('rotate-prompt');
function applyOrientation(): void {
  const show = isPhonePortrait(currentViewport());
  if (show === rotatePrompt) return;
  rotatePrompt = show;
  rotatePromptEl?.classList.toggle('open', show);
  // Phaser also listens on the window, so a tap on the prompt would still reach the scenes without this.
  game.input.enabled = !show;
  if (show) game.pause();
  else game.resume();
}
window.addEventListener('resize', applyOrientation);
applyOrientation();

// Any fullscreen on a phone (the first title tap, or the Settings toggle) also locks landscape where allowed.
game.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, () => {
  if (isPhone(currentViewport())) lockLandscape();
});
