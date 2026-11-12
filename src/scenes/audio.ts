import {
  MUSIC_FADE_MS,
  MUSIC_VOLUME,
  audioAllowed,
  type MusicKey,
  type SoundKey,
} from '../platform/audio';
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

/** What `MusicPlayer` needs of one Phaser sound; every sound `scene.sound.add` returns satisfies it. */
export interface MusicSound {
  play(): boolean;
  stop(): boolean;
  pause(): boolean;
  resume(): boolean;
  setVolume(value: number): unknown;
  destroy(): void;
}

/** What `MusicPlayer` needs of Phaser's sound manager; `scene.sound` satisfies it. */
export interface MusicManager {
  add(key: string, config: { loop: boolean; volume: number }): MusicSound;
}

/** A loop sounding: its volume ramps from `from` to `to` over MUSIC_FADE_MS, and it ends once faded to 0. */
interface Voice {
  readonly sound: MusicSound;
  readonly from: number;
  readonly to: number;
  elapsedMs: number;
}

function volumeOf(voice: Voice): number {
  const k = Math.min(1, voice.elapsedMs / MUSIC_FADE_MS);
  return voice.from + (voice.to - voice.from) * k;
}

/** Calls into the sound manager, staying silent if the browser refuses audio or a file failed to decode. */
function quietly(action: () => void): void {
  try {
    action();
  } catch {
    // Silence, never an error out of a room change or a tap.
  }
}

/**
 * The world's ambient music: one loop at a time through the mixer's gate
 * (`audioAllowed(settings, 'music')`), read live. `play(key)` names the
 * place's loop and cross-fades to it over MUSIC_FADE_MS; with Music off it
 * only remembers the key, and `refresh()` after the switch flips stops the
 * loop at once or starts the remembered one. The fades advance in `update`,
 * from the scene's frame loop, so they freeze with the game; `pause` and
 * `resume` hold the sounds themselves.
 */
export class MusicPlayer {
  /** The loop playing after the gate, or '' (the hook's `track`). */
  track: MusicKey | '' = '';
  private wanted: MusicKey | undefined;
  /** The loops sounding: the one fading in or playing last, any fading out before it. */
  private voices: Voice[] = [];

  constructor(
    private readonly manager: MusicManager,
    private readonly settings: () => Settings,
  ) {}

  /** Makes `key` the place's loop and cross-fades to it if Music is on; a no-op if it already plays. */
  play(key: MusicKey): void {
    this.wanted = key;
    this.refresh();
  }

  /** Applies the Music switch: off stops the loop at once, on starts the place's loop. */
  refresh(): void {
    const next = this.wanted && audioAllowed(this.settings(), 'music') ? this.wanted : '';
    if (next === this.track) return;
    if (next === '') {
      this.silence();
      return;
    }
    this.voices = this.voices.map((v) => ({
      sound: v.sound,
      from: volumeOf(v),
      to: 0,
      elapsedMs: 0,
    }));
    this.track = next;
    quietly(() => {
      const sound = this.manager.add(next, { loop: true, volume: 0 });
      this.voices.push({ sound, from: 0, to: MUSIC_VOLUME, elapsedMs: 0 });
      sound.play();
    });
  }

  /** Stops every loop at once and forgets the place's (the world shutting down). */
  stop(): void {
    this.wanted = undefined;
    this.silence();
  }

  /** Holds every loop where it is (the game paused under the rotate prompt). */
  pause(): void {
    for (const v of this.voices) quietly(() => v.sound.pause());
  }

  resume(): void {
    for (const v of this.voices) quietly(() => v.sound.resume());
  }

  /** Advances the fades by `deltaMs`; a loop faded out is stopped and destroyed. */
  update(deltaMs: number): void {
    for (const v of this.voices) {
      v.elapsedMs += deltaMs;
      const volume = volumeOf(v);
      quietly(() => v.sound.setVolume(volume));
    }
    const done = this.voices.filter((v) => v.to === 0 && v.elapsedMs >= MUSIC_FADE_MS);
    for (const v of done) this.end(v);
    this.voices = this.voices.filter((v) => !done.includes(v));
  }

  private silence(): void {
    for (const v of this.voices) this.end(v);
    this.voices = [];
    this.track = '';
  }

  private end(voice: Voice): void {
    quietly(() => {
      voice.sound.stop();
      voice.sound.destroy();
    });
  }
}
