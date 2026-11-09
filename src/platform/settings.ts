/**
 * Per-machine settings (scr_settings), separate from the save slots: the
 * prototype's settings.json becomes one stored JSON text behind
 * SettingsStorage. Pure: no Phaser or DOM; the localStorage adapter is
 * localStorageSettingsStorage.ts. The prototype's window `scale` is not
 * ported, a browser's canvas already fits its window.
 */

export interface Settings {
  fullscreen: boolean;
  weather: boolean;
}

/** init_settings: windowed, weather particles on. */
export const DEFAULT_SETTINGS: Readonly<Settings> = { fullscreen: false, weather: true };

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
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const value = stored[key];
    if (typeof value === 'boolean') settings[key] = value;
  }
  return settings;
}

/** save_settings. */
export function saveSettings(storage: SettingsStorage, settings: Settings): void {
  storage.write(JSON.stringify({ fullscreen: settings.fullscreen, weather: settings.weather }));
}
