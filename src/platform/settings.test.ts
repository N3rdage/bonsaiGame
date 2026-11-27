import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
  type SettingsStorage,
} from './settings';

class MemorySettingsStorage implements SettingsStorage {
  constructor(public text?: string) {}
  read(): string | undefined {
    return this.text;
  }
  write(text: string): void {
    this.text = text;
  }
}

describe('settings', () => {
  it('defaults to windowed with weather, sound and music on and the 3D world off', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      fullscreen: false,
      weather: true,
      sound: true,
      music: true,
      world3d: false,
      timeSpeed: 1,
    });
    expect(loadSettings(new MemorySettingsStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips every key through save and load', () => {
    const storage = new MemorySettingsStorage();
    const settings: Settings = {
      fullscreen: true,
      weather: false,
      sound: false,
      music: true,
      world3d: true,
      timeSpeed: 4,
    };
    saveSettings(storage, settings);
    expect(JSON.parse(storage.text ?? '')).toEqual(settings);
    expect(loadSettings(storage)).toEqual(settings);
    const quiet: Settings = {
      fullscreen: false,
      weather: true,
      sound: true,
      music: false,
      world3d: false,
      timeSpeed: 1,
    };
    saveSettings(storage, quiet);
    expect(loadSettings(storage)).toEqual(quiet);
  });

  it('loads settings saved before the audio and 3D switches with the defaults', () => {
    expect(loadSettings(new MemorySettingsStorage('{"fullscreen":false,"weather":true}'))).toEqual({
      fullscreen: false,
      weather: true,
      sound: true,
      music: true,
      world3d: false,
      timeSpeed: 1,
    });
  });

  it('lays known keys over the defaults and ignores unknown ones and wrong types', () => {
    expect(loadSettings(new MemorySettingsStorage('{"weather":false}'))).toEqual({
      ...DEFAULT_SETTINGS,
      weather: false,
    });
    const odd = new MemorySettingsStorage(
      '{"scale":3,"fullscreen":"yes","weather":0,"sound":"yes","music":null,"world3d":1,"timeSpeed":3,"x":true}',
    );
    const loaded = loadSettings(odd);
    expect(loaded).toEqual(DEFAULT_SETTINGS);
    expect(Object.keys(loaded).sort()).toEqual([
      'fullscreen',
      'music',
      'sound',
      'timeSpeed',
      'weather',
      'world3d',
    ]);
  });

  it('gives the defaults for malformed or non-object text', () => {
    for (const text of ['{', 'null', '[]', '42', '"on"', '']) {
      expect(loadSettings(new MemorySettingsStorage(text))).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('returns a fresh object each load, never the shared defaults', () => {
    const settings = loadSettings(new MemorySettingsStorage());
    settings.weather = false;
    expect(DEFAULT_SETTINGS.weather).toBe(true);
  });

  it('saves and loads the time speeds 1, 2 and 4 and rejects anything else', () => {
    for (const timeSpeed of [1, 2, 4] as const) {
      const storage = new MemorySettingsStorage();
      saveSettings(storage, { ...DEFAULT_SETTINGS, timeSpeed });
      expect(loadSettings(storage).timeSpeed).toBe(timeSpeed);
    }
    for (const bad of ['2', 3, 0, 8, null]) {
      const text = JSON.stringify({ timeSpeed: bad });
      expect(loadSettings(new MemorySettingsStorage(text)).timeSpeed).toBe(1);
    }
  });

  it('ignores an avatarScale stored by an older version and does not write one', () => {
    const stored = new MemorySettingsStorage(JSON.stringify({ weather: false, avatarScale: 0.9 }));
    const loaded = loadSettings(stored);
    expect(loaded).toEqual({ ...DEFAULT_SETTINGS, weather: false });
    expect(loaded).not.toHaveProperty('avatarScale');
    saveSettings(stored, loaded);
    expect(JSON.parse(stored.text ?? '')).not.toHaveProperty('avatarScale');
  });
});
