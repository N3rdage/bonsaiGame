/**
 * The mixer: the one gate every sound effect and music track plays through,
 * and the keys and URLs of the audio files. Pure: no Phaser or DOM. The
 * prototype had no mixer; here it is two on/off switches in the per-machine
 * settings (settings.ts), not volumes. The files are Ogg Vorbis (`.ogg`) under
 * public/assets/audio/; the sound effects land with backlog 7-b and the music
 * with 7-c, so until then the game is silent and nothing loads these URLs.
 */

import type { Settings } from './settings';

/** A sound effect or a music track; each has its own switch. */
export type AudioKind = 'sound' | 'music';

/** Whether a play call of `kind` may make a sound: `settings.sound` for effects, `settings.music` for music. */
export function audioAllowed(settings: Settings, kind: AudioKind): boolean {
  return kind === 'sound' ? settings.sound : settings.music;
}

/** The sound effects 7-b brings, by file name. */
export const SOUND_KEYS = ['water', 'snip', 'wire', 'footstep', 'click', 'door', 'coin'] as const;
export type SoundKey = (typeof SOUND_KEYS)[number];

/** The music tracks 7-c brings: one per place. */
export const MUSIC_KEYS = ['shed', 'garden', 'viewer'] as const;
export type MusicKey = (typeof MUSIC_KEYS)[number];

/** The file's URL under the app's base path (`import.meta.env.BASE_URL`, which ends in `/`). */
export function audioUrl(base: string, key: SoundKey | MusicKey): string {
  return `${base}assets/audio/${key}.ogg`;
}
