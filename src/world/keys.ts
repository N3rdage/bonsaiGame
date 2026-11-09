/**
 * Keydown handlers that run once per key event. Phaser 4.2.1 queues every DOM
 * key event until the next frame and re-emits the whole queue on each new one,
 * skipping only the event it handled last, so a quick press can deliver an
 * older keydown again with the same event object.
 */

/** The part of Phaser's keyboard plugin a handler is registered on. */
export interface KeyEmitter {
  on(event: string, fn: (event: KeyboardEvent) => void): unknown;
}

/** Runs `handler` on `keydown-<key>`, once for each distinct event object. */
export function onKeyDown(
  keyboard: KeyEmitter,
  key: string,
  handler: (event: KeyboardEvent) => void,
): void {
  const seen = new WeakSet<KeyboardEvent>();
  keyboard.on(`keydown-${key}`, (event) => {
    if (seen.has(event)) return;
    seen.add(event);
    handler(event);
  });
}
