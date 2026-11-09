/**
 * Browser SettingsStorage backed by one localStorage key, `bonsai.settings`
 * (the prototype's settings.json). Reads are guarded like the save storage's:
 * blocked storage reads as "nothing stored". Unlike a save, a failed write is
 * swallowed: a settings toggle must not throw out of a tap, and the game keeps
 * the in-memory value for the session.
 */

import type { SettingsStorage } from './settings';

export const SETTINGS_KEY = 'bonsai.settings';

export class LocalStorageSettingsStorage implements SettingsStorage {
  read(): string | undefined {
    try {
      return localStorage.getItem(SETTINGS_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  }

  write(text: string): void {
    try {
      localStorage.setItem(SETTINGS_KEY, text);
    } catch {
      // Kept in memory only for this session.
    }
  }
}
