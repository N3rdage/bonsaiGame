/**
 * Per-machine settings (scr_settings), separate from the save slots: the
 * prototype's settings.json becomes one stored JSON text behind
 * SettingsStorage. Pure: no Phaser or DOM; the localStorage adapter is
 * localStorageSettingsStorage.ts. The prototype's window `scale` is not
 * ported, a browser's canvas already fits its window.
 */

import { parseTimeSpeed, type TimeSpeed } from '../sim/timeOfDay';

export interface Settings {
  fullscreen: boolean;
  weather: boolean;
  /** Sound effects on or off; every play call goes through audioAllowed (audio.ts). */
  sound: boolean;
  /** Music on or off, gated the same way. */
  music: boolean;
  /** The 3D world (preview): Babylon draws the room under the 2D HUD. Off by default; the 2D game is the game. */
  world3d: boolean;
  /** The day clock's speed (1x, 2x or 4x). Per machine: a save never carries it. */
  timeSpeed: TimeSpeed;
}

/** init_settings: windowed, weather particles on; sound and music on (the prototype had no mixer). */
export const DEFAULT_SETTINGS: Readonly<Settings> = {
  fullscreen: false,
  weather: true,
  sound: true,
  music: true,
  world3d: false,
  timeSpeed: 1,
};

/** Where the settings text lives; read gives undefined when there is none or it cannot be read. */
export interface SettingsStorage {
  read(): string | undefined;
  write(text: string): void;
}

/**
 * load_settings: the defaults with each known boolean key from storage laid
 * over them. Unknown keys, values of the wrong type, malformed JSON or an
 * unreadable store leave the defaults.
 */
export function loadSettings(storage: SettingsStorage): Settings {
  const settings = { ...DEFAULT_SETTINGS };
  const text = storage.read();
  if (text === undefined) return settings;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return settings;
  }
  if (typeof data !== 'object' || data === null) return settings;
  const stored = data as Record<string, unknown>;
  for (const key of ['fullscreen', 'weather', 'sound', 'music', 'world3d'] as const) {
    const value = stored[key];
    if (typeof value === 'boolean') settings[key] = value;
  }
  settings.timeSpeed = parseTimeSpeed(stored.timeSpeed) ?? DEFAULT_SETTINGS.timeSpeed;
  return settings;
}

/** save_settings. */
export function saveSettings(storage: SettingsStorage, settings: Settings): void {
  const { fullscreen, weather, sound, music, world3d, timeSpeed } = settings;
  storage.write(JSON.stringify({ fullscreen, weather, sound, music, world3d, timeSpeed }));
}
