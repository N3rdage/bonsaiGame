import { inputModeFor, type InputMode } from '../world/keyHints';

/**
 * How the player drives the game now: touch where the device has a touch
 * screen (the test Phaser's device detection uses, which the UI scale's tap
 * targets follow), keyboard otherwise. Read whenever a label is drawn, so a
 * change shows on the next draw.
 */
export function currentInputMode(): InputMode {
  return inputModeFor('ontouchstart' in window || navigator.maxTouchPoints > 0);
}
