import type { CloseKeyState } from '../world/closeKey';
import { currentInputMode } from './inputMode';

/** The slice of Chromium's Keyboard Lock API (`navigator.keyboard`) the page uses; absent elsewhere. */
interface KeyboardLockApi {
  lock?: (keyCodes: string[]) => Promise<void>;
  unlock?: () => void;
}

let escapeLocked = false;
const lockListeners = new Set<() => void>();

function keyboardLockApi(): KeyboardLockApi | undefined {
  return (navigator as Navigator & { keyboard?: KeyboardLockApi }).keyboard;
}

function setEscapeLocked(locked: boolean): void {
  if (locked === escapeLocked) return;
  escapeLocked = locked;
  for (const listener of lockListeners) listener();
}

/** Whether the page is fullscreen now, and whether it holds the Escape lock: what the close labels follow. */
export function closeKeyState(): CloseKeyState {
  return {
    fullscreen: document.fullscreenElement !== null,
    escapeLocked,
    touch: currentInputMode() === 'touch',
  };
}

/** Runs `listener` whenever the Escape lock is granted or released; returns the function that stops it. */
export function onEscapeLockChange(listener: () => void): () => void {
  lockListeners.add(listener);
  return () => {
    lockListeners.delete(listener);
  };
}

/**
 * Where the browser offers Keyboard Lock, asks for Escape each time the page
 * enters fullscreen, so Escape reaches the game and a long press leaves
 * fullscreen. Labels name Escape only once the browser has granted the lock; a
 * refusal or a browser without the API leaves Q as the key they name. Fullscreen
 * ending releases the lock. Called once at boot.
 */
export function watchEscapeLock(): void {
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === null) {
      keyboardLockApi()?.unlock?.();
      setEscapeLocked(false);
      return;
    }
    const request = keyboardLockApi()?.lock?.(['Escape']);
    if (!request) {
      setEscapeLocked(false);
      return;
    }
    request
      .then(() => {
        setEscapeLocked(document.fullscreenElement !== null);
      })
      .catch(() => {
        setEscapeLocked(false);
      });
  });
}
