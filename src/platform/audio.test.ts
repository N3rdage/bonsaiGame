import { describe, expect, it } from 'vitest';
import {
  audioAllowed,
  audioUrl,
  MUSIC_FADE_MS,
  MUSIC_KEYS,
  MUSIC_VOLUME,
  SOUND_KEYS,
  trackFor,
} from './audio';
import { DEFAULT_SETTINGS } from './settings';

describe('audio', () => {
  it('allows both kinds with the default settings', () => {
    expect(audioAllowed(DEFAULT_SETTINGS, 'sound')).toBe(true);
    expect(audioAllowed(DEFAULT_SETTINGS, 'music')).toBe(true);
  });

  it('gates each kind on its own switch, independent of the other', () => {
    for (const sound of [true, false]) {
      for (const music of [true, false]) {
        const settings = { ...DEFAULT_SETTINGS, sound, music };
        expect(audioAllowed(settings, 'sound')).toBe(sound);
        expect(audioAllowed(settings, 'music')).toBe(music);
      }
    }
  });

  it('ignores the other settings', () => {
    const settings = { fullscreen: true, weather: false, sound: true, music: false };
    expect([audioAllowed(settings, 'sound'), audioAllowed(settings, 'music')]).toEqual([
      true,
      false,
    ]);
  });

  it('puts every file under assets/audio below the base path, all .wav', () => {
    expect(audioUrl('/', 'water')).toBe('/assets/audio/water.wav');
    expect(audioUrl('/bonsai/', 'garden')).toBe('/bonsai/assets/audio/garden.wav');
    for (const key of [...SOUND_KEYS, ...MUSIC_KEYS]) {
      expect(audioUrl('/', key)).toBe(`/assets/audio/${key}.wav`);
    }
  });

  it('names seven sound effects and four music tracks, none shared', () => {
    expect(SOUND_KEYS).toEqual(['water', 'snip', 'wire', 'footstep', 'click', 'door', 'coin']);
    expect(MUSIC_KEYS).toEqual(['shed', 'garden', 'house', 'viewer']);
    expect(new Set([...SOUND_KEYS, ...MUSIC_KEYS]).size).toBe(11);
  });

  it('plays the shed, garden and viewer their own loops, the house rooms one shared loop and the greenhouse the garden', () => {
    expect(trackFor('greenhouse')).toBe('garden');
    expect(trackFor('shed')).toBe('shed');
    expect(trackFor('garden')).toBe('garden');
    expect(trackFor('lounge')).toBe('house');
    expect(trackFor('hallway')).toBe('house');
    expect(trackFor('study')).toBe('house');
    expect(trackFor('viewer')).toBe('viewer');
  });

  it('cross-fades over 1.2 s, music under the effects', () => {
    expect(MUSIC_FADE_MS).toBe(1200);
    expect(MUSIC_VOLUME).toBe(0.4);
  });
});
