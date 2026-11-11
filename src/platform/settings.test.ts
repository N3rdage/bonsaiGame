import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type SettingsStorage } from './settings';

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
  it('defaults to windowed with weather, sound and music on, as init_settings', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      fullscreen: false,
      weather: true,
      sound: true,
      music: true,
    });
    expect(loadSettings(new MemorySettingsStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips all four keys through save and load', () => {
    const storage = new MemorySettingsStorage();
    const settings = { fullscreen: true, weather: false, sound: false, music: true };
    saveSettings(storage, settings);
    expect(JSON.parse(storage.text ?? '')).toEqual(settings);
    expect(loadSettings(storage)).toEqual(settings);
    const quiet = { fullscreen: false, weather: true, sound: true, music: false };
    saveSettings(storage, quiet);
    expect(loadSettings(storage)).toEqual(quiet);
  });

  it('loads settings saved before the audio switches with sound and music on', () => {
    expect(loadSettings(new MemorySettingsStorage('{"fullscreen":false,"weather":true}'))).toEqual({
      fullscreen: false,
      weather: true,
      sound: true,
      music: true,
    });
  });

  it('lays known keys over the defaults and ignores unknown ones and wrong types', () => {
    expect(loadSettings(new MemorySettingsStorage('{"weather":false}'))).toEqual({
      ...DEFAULT_SETTINGS,
      weather: false,
    });
    const odd = new MemorySettingsStorage(
      '{"scale":3,"fullscreen":"yes","weather":0,"sound":"yes","music":null,"x":true}',
    );
    const loaded = loadSettings(odd);
    expect(loaded).toEqual(DEFAULT_SETTINGS);
    expect(Object.keys(loaded).sort()).toEqual(['fullscreen', 'music', 'sound', 'weather']);
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
});
