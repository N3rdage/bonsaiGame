/**
 * Browser SaveStorage backed by localStorage, one key per slot
 * (`bonsai.save.<slot>`). Replaces the prototype's saveN.json files
 * (archive/gamemaker/scripts/scr_save_load). Reads are guarded: private mode
 * or blocked storage reads as "no save". A failed write (full quota, blocked
 * storage) throws, because a player must never believe a save succeeded when
 * it did not; the UI catches it and says so.
 */

import type { SaveStorage } from '../sim/save';

function key(slot: number): string {
  return `bonsai.save.${String(slot)}`;
}

export class LocalStorageSaveStorage implements SaveStorage {
  read(slot: number): string | undefined {
    try {
      return localStorage.getItem(key(slot)) ?? undefined;
    } catch {
      return undefined;
    }
  }

  write(slot: number, text: string): void {
    try {
      localStorage.setItem(key(slot), text);
    } catch (err) {
      throw new Error(`Could not write save slot ${String(slot)} to browser storage`, {
        cause: err,
      });
    }
  }

  remove(slot: number): void {
    try {
      localStorage.removeItem(key(slot));
    } catch {
      // Treated as already gone.
    }
  }
}
