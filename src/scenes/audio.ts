import { audioAllowed, type SoundKey } from '../platform/audio';
import type { Settings } from '../platform/settings';

/** What `SoundPlayer` needs of Phaser's sound manager; `scene.sound` satisfies it. */
export interface SoundManager {
  play(key: string): unknown;
}

/**
 * The scenes' one way to play a sound effect: through the mixer's gate
 * (`audioAllowed(settings, 'sound')`, src/platform/audio.ts), read live on
 * every call so the Settings switch takes effect at once. Phaser's Web Audio
 * manager unlocks itself on the first pointer event; until then, or if the
 * browser refuses audio, a play does nothing and never throws out of a tap.
 */
export class SoundPlayer {
  /** The last key handed to the sound manager after the gate, or '' (the hook's `lastSound`). */
  lastSound = '';
  /** How many plays passed the gate, so a caller can tell whether an action made a sound. */
  plays = 0;

  constructor(
    private readonly manager: SoundManager,
    private readonly settings: () => Settings,
  ) {}

  play(key: SoundKey): void {
    if (!audioAllowed(this.settings(), 'sound')) return;
    this.lastSound = key;
    this.plays += 1;
    try {
      this.manager.play(key);
    } catch {
      // A browser that refuses audio, or a file that failed to decode: stay silent.
    }
  }

  /** Runs a tap's action, then a `click` unless the action played its own sound. */
  tap(action: () => void): void {
    const before = this.plays;
    action();
    if (this.plays === before) this.play('click');
  }
}
