/**
 * The phone orientation rule (backlog #79): a phone runs the game in landscape
 * only; in portrait it shows a rotate prompt instead. Tablets and desktops are
 * left alone. The decisions are pure; `currentViewport` and `lockLandscape`
 * are the thin browser reads and calls around them.
 */

/** A phone is a touch screen whose short side is under this many CSS px; a tablet's is wider. */
export const PHONE_MAX_SHORT_SIDE = 500;

/** The layout viewport in CSS px and whether the device has a touch screen. */
export interface Viewport {
  width: number;
  height: number;
  touch: boolean;
}

export function isPhone(view: Viewport): boolean {
  return view.touch && Math.min(view.width, view.height) < PHONE_MAX_SHORT_SIDE;
}

/** Whether the rotate prompt covers the game: a phone held taller than wide. */
export function isPhonePortrait(view: Viewport): boolean {
  return isPhone(view) && view.height > view.width;
}

export function currentViewport(): Viewport {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    touch: navigator.maxTouchPoints > 0,
  };
}

/** Locks the screen to landscape where the Screen Orientation API allows it (fullscreen Android); a refusal is ignored. */
export function lockLandscape(): void {
  try {
    screen.orientation.lock('landscape').catch(() => undefined);
  } catch {
    // Older Safari has no screen.orientation, or no lock on it: play on unlocked.
  }
}
