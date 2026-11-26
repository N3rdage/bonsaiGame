import Phaser from 'phaser';
import { onEscapeLockChange } from '../platform/fullscreen';
import { nextTimeSpeed } from '../sim/timeOfDay';
import { nextAvatarScale } from '../world3d/character';
import { saveSettings } from '../platform/settings';
import type { FullscreenState } from '../world/settingsPanel';
import type { SharedSceneData } from './sceneData';

/** Whether the browser offers fullscreen, and whether the page is in it now. */
export function fullscreenState(scene: Phaser.Scene): FullscreenState {
  return { available: document.fullscreenEnabled, active: scene.scale.isFullscreen };
}

/**
 * Applies a Settings panel toggle (`panel-fullscreen`, `panel-weather`,
 * `panel-sound`, `panel-music`, `panel-world3d`, `panel-timespeed` or `panel-avatarsize`) to
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
  } else if (id === 'panel-world3d') {
    ctx.settings.world3d = !ctx.settings.world3d;
  } else if (id === 'panel-timespeed') {
    ctx.settings.timeSpeed = nextTimeSpeed(ctx.settings.timeSpeed);
  } else if (id === 'panel-avatarsize') {
    ctx.settings.avatarScale = nextAvatarScale(ctx.settings.avatarScale);
  } else if (id === 'panel-music') {
    ctx.settings.music = !ctx.settings.music;
  } else {
    return;
  }
  saveSettings(ctx.settingsStorage, ctx.settings);
}

/** Runs `onChange` whenever the page enters or leaves fullscreen (our toggle, or the browser's Escape) or the Escape lock is granted or released, until shutdown. */
export function onFullscreenChange(scene: Phaser.Scene, onChange: () => void): void {
  const { ENTER_FULLSCREEN, LEAVE_FULLSCREEN } = Phaser.Scale.Events;
  scene.scale.on(ENTER_FULLSCREEN, onChange);
  scene.scale.on(LEAVE_FULLSCREEN, onChange);
  const stopLock = onEscapeLockChange(onChange);
  scene.events.once('shutdown', () => {
    stopLock();
    scene.scale.off(ENTER_FULLSCREEN, onChange);
    scene.scale.off(LEAVE_FULLSCREEN, onChange);
  });
}
