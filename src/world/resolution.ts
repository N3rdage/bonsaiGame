/**
 * The resolution model, as pure math. Every layout number, room distance and
 * hook coordinate is in logical px on a 480x270 canvas. The canvas backing is
 * sized to the device pixels the fitted 16:9 display covers, and the scene
 * camera is zoomed by that factor, so pixel art scales with hard edges while
 * text renders at the device's own resolution.
 */

/** Logical width of the game in px. */
export const GAME_WIDTH = 480;
/** Logical height of the game in px. */
export const GAME_HEIGHT = 270;

/**
 * Device pixels per logical pixel when the 16:9 canvas is fitted into a
 * `cssWidth` x `cssHeight` window at device pixel ratio `dpr`; never below 1.
 */
export function deviceScale(cssWidth: number, cssHeight: number, dpr: number): number {
  return Math.max(1, Math.min((cssWidth * dpr) / GAME_WIDTH, (cssHeight * dpr) / GAME_HEIGHT));
}

/** The canvas backing size, in whole device px, for a device scale. */
export function canvasSize(scale: number): { width: number; height: number } {
  return { width: Math.round(GAME_WIDTH * scale), height: Math.round(GAME_HEIGHT * scale) };
}

/**
 * The camera zoom that fills a canvas of that backing size with the logical
 * world, per axis, so rounding the backing never stretches it by more than a
 * sub-pixel.
 */
export function cameraZoom(canvasWidth: number, canvasHeight: number): { x: number; y: number } {
  return { x: canvasWidth / GAME_WIDTH, y: canvasHeight / GAME_HEIGHT };
}
