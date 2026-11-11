import Phaser from 'phaser';
import { saveSettings } from '../platform/settings';
import type { FullscreenState } from '../world/settingsPanel';
import type { SharedSceneData } from './sceneData';

/** Whether the browser offers fullscreen, and whether the page is in it now. */
export function fullscreenState(scene: Phaser.Scene): FullscreenState {
  return { available: document.fullscreenEnabled, active: scene.scale.isFullscreen };
}

/**
 * Applies a Settings panel toggle (`panel-fullscreen`, `panel-weather`,
 * `panel-sound` or `panel-music`) to
 * the shared settings and saves them. Called inside the tap, the user gesture
 * the browser requires before it enters fullscreen.
 */
export function toggleSetting(scene: Phaser.Scene, ctx: SharedSceneData, id: string): void {
  if (id === 'panel-fullscreen') {
    const enter = !scene.scale.isFullscreen;
    if (enter) scene.scale.startFullscreen();
    else scene.scale.stopFullscreen();
    ctx.settings.fullscreen = enter;
  } else if (id === 'panel-weather') {
    ctx.settings.weather = !ctx.settings.weather;
  } else if (id === 'panel-sound') {
    ctx.settings.sound = !ctx.settings.sound;
  } else if (id === 'panel-music') {
    ctx.settings.music = !ctx.settings.music;
  } else {
    return;
  }
  saveSettings(ctx.settingsStorage, ctx.settings);
}

/** Runs `onChange` whenever the page enters or leaves fullscreen (our toggle, or the browser's Escape), until shutdown. */
export function onFullscreenChange(scene: Phaser.Scene, onChange: () => void): void {
  const { ENTER_FULLSCREEN, LEAVE_FULLSCREEN } = Phaser.Scale.Events;
  scene.scale.on(ENTER_FULLSCREEN, onChange);
  scene.scale.on(LEAVE_FULLSCREEN, onChange);
  scene.events.once('shutdown', () => {
    scene.scale.off(ENTER_FULLSCREEN, onChange);
    scene.scale.off(LEAVE_FULLSCREEN, onChange);
  });
}
