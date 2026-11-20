/**
 * Which key a close label names. The browser takes Escape to leave fullscreen
 * and the page never sees that press, so in fullscreen Q is the key that closes
 * things; Escape is named again outside fullscreen, or inside it where the
 * page holds an Escape keyboard lock. Q always works too.
 */

export interface CloseKeyState {
  /** `document.fullscreenElement` is set. */
  readonly fullscreen: boolean;
  /** The page holds the Escape keyboard lock (src/platform/fullscreen.ts). */
  readonly escapeLocked: boolean;
}

export type CloseKey = 'Esc' | 'Q';

/** Whether a press of Escape reaches the game. */
export function escapeReachesPage(state: CloseKeyState): boolean {
  return !state.fullscreen || state.escapeLocked;
}

/**
 * The key a close label names, or undefined when none can be named: while the
 * player is typing, Q is a letter, so only Escape can be named and not in
 * fullscreen without the lock.
 */
export function closeKeyName(state: CloseKeyState, typing = false): CloseKey | undefined {
  if (escapeReachesPage(state)) return 'Esc';
  return typing ? undefined : 'Q';
}

/** `label` with the key in brackets, or bare when there is no key to name. */
export function withCloseKey(label: string, key: CloseKey | undefined): string {
  return key === undefined ? label : `${label} (${key})`;
}

/** Whether `key` (a KeyboardEvent's `key`) is the Q close key. */
export function isCloseKey(key: string): boolean {
  return key === 'q' || key === 'Q';
}
