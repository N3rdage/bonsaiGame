import { describe, expect, it } from 'vitest';
import { audioAllowed, audioUrl, MUSIC_KEYS, SOUND_KEYS } from './audio';
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

  it('puts every file under assets/audio as .ogg below the base path', () => {
    expect(audioUrl('/', 'water')).toBe('/assets/audio/water.ogg');
    expect(audioUrl('/bonsai/', 'garden')).toBe('/bonsai/assets/audio/garden.ogg');
    for (const key of [...SOUND_KEYS, ...MUSIC_KEYS]) {
      expect(audioUrl('/', key)).toBe(`/assets/audio/${key}.ogg`);
    }
  });

  it('names seven sound effects and three music tracks, none shared', () => {
    expect(SOUND_KEYS).toEqual(['water', 'snip', 'wire', 'footstep', 'click', 'door', 'coin']);
    expect(MUSIC_KEYS).toEqual(['shed', 'garden', 'viewer']);
    expect(new Set([...SOUND_KEYS, ...MUSIC_KEYS]).size).toBe(10);
  });
});
