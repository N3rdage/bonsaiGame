/**
 * The one place that words key hints. A keyboard player sees `Notebook (J)`
 * and `Press E on ...`; a player driving the game by touch has no keys, so the
 * same labels drop their bracketed key and the prompts say what to tap.
 * Pure: the input mode comes from src/platform/inputMode.ts.
 */

export type InputMode = 'keyboard' | 'touch';

/** The mode for a device that has a touch screen or not. */
export function inputModeFor(touch: boolean): InputMode {
  return touch ? 'touch' : 'keyboard';
}

/** A trailing bracketed key: a letter, F5, Esc or Enter. */
const TRAILING_KEY = / \((?:[A-Z]|F\d{1,2}|Esc|Enter)\)$/;

/** `label` as the input names it: `Notebook (J)` with a keyboard, `Notebook` by touch. */
export function keyLabel(label: string, mode: InputMode): string {
  return mode === 'touch' ? label.replace(TRAILING_KEY, '') : label;
}

/**
 * Prose with a key in it as the input names it. By touch, `press E on the
 * workbench` becomes `walk to the workbench and tap Interact` (the Interact
 * button appears beside whatever is in reach), `pressing E` becomes `tapping
 * Interact` and `click` becomes `tap`. A keyboard keeps the text as written.
 */
export function keyProse(text: string, mode: InputMode): string {
  if (mode === 'keyboard') return text;
  return text
    .replace(/\b([Pp])ress E on (.+?)(?= to |,|\.| and )/g, (_, p: string, target: string) =>
      p === 'P' ? `Walk to ${target} and tap Interact` : `walk to ${target} and tap Interact`,
    )
    .replace(/\bpressing E\b/g, 'tapping Interact')
    .replace(/\bclick\b/g, 'tap')
    .replace(/\bClick\b/g, 'Tap');
}

/** The tutorial panel's notebook hint. */
export function notebookHint(mode: InputMode): string {
  return mode === 'touch' ? 'Tap Notebook for notes' : 'Press J for notebook';
}
