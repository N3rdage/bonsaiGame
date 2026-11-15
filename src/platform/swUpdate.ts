/**
 * Save before a service-worker update reloads the page (backlog BG-009, #169).
 *
 * vite.config.ts keeps `registerType: 'autoUpdate'`: an updated worker
 * activates and takes control on its own, then vite-plugin-pwa's client calls
 * our `onNeedReload` (src/main.ts) instead of reloading. By then the page is
 * running stale code against the new worker, so the reload is not deferred;
 * the running world, if any, saves its active slot first and then the page
 * reloads. The decision is pure (`planReload`); `handleNeedReload` applies it.
 */

export type ReloadPlan = 'save-then-reload' | 'reload';

/** The running world's save, or undefined with no world running (the title). */
let saver: (() => void) | undefined;

/** With a world running, save its active slot first; otherwise reload at once. */
export function planReload(hasSaver: boolean): ReloadPlan {
  return hasSaver ? 'save-then-reload' : 'reload';
}

/**
 * Registers the save to run before an update reload. There is at most one: a
 * later registration replaces the earlier. The returned function unregisters
 * it, and does nothing once another save has replaced it.
 */
export function registerSaveBeforeReload(save: () => void): () => void {
  saver = save;
  return () => {
    if (saver === save) saver = undefined;
  };
}

/** `onNeedReload`: runs the plan. A failing save never blocks the reload. */
export function handleNeedReload(reload: () => void): void {
  const save = saver;
  if (planReload(save !== undefined) === 'save-then-reload') {
    try {
      save?.();
    } catch {
      // The reload must still happen: this page no longer matches its worker.
    }
  }
  reload();
}
