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
  it('defaults to windowed with weather on, as init_settings', () => {
    expect(DEFAULT_SETTINGS).toEqual({ fullscreen: false, weather: true });
    expect(loadSettings(new MemorySettingsStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips through save and load', () => {
    const storage = new MemorySettingsStorage();
    saveSettings(storage, { fullscreen: true, weather: false });
    expect(JSON.parse(storage.text ?? '')).toEqual({ fullscreen: true, weather: false });
    expect(loadSettings(storage)).toEqual({ fullscreen: true, weather: false });
  });

  it('lays known keys over the defaults and ignores unknown ones and wrong types', () => {
    expect(loadSettings(new MemorySettingsStorage('{"weather":false}'))).toEqual({
      fullscreen: false,
      weather: false,
    });
    const odd = new MemorySettingsStorage('{"scale":3,"fullscreen":"yes","weather":0,"x":true}');
    const loaded = loadSettings(odd);
    expect(loaded).toEqual(DEFAULT_SETTINGS);
    expect(Object.keys(loaded).sort()).toEqual(['fullscreen', 'weather']);
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
