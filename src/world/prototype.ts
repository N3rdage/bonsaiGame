/**
 * The prototype's rooms are 960x540; the web build's logical canvas is 480x270
 * (`GAME_WIDTH`/`GAME_HEIGHT` in resolution.ts), so every prototype coordinate and
 * distance halves. `fromPrototype` is the one place that rule lives. It has a
 * module of its own so the sheets (assets.ts) and the rooms that draw them
 * (shedRoom.ts re-exports it) both import it without a cycle.
 */

/** Prototype room px per logical px. */
export const PROTOTYPE_SCALE = 2;

export function fromPrototype(px: number): number {
  return px / PROTOTYPE_SCALE;
}
