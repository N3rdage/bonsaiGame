/**
 * The world camera, as pure math (backlog #85). Rooms stay in logical room
 * units (480x270, the prototype's halved px); on a phone the world camera
 * zooms in and follows the player, while the HUD and panels keep the
 * unzoomed logical canvas through their own camera.
 */

import { PHONE_MAX_SHORT_SIDE } from '../platform/orientation';
import { clamp } from '../sim/vec3';
import { GAME_HEIGHT, GAME_WIDTH } from './resolution';
import type { Rect } from './shedRoom';

/** How much nearer the world is drawn on a phone-sized viewport. */
export const PHONE_WORLD_ZOOM = 2;

/**
 * The world zoom for a `cssWidth` x `cssHeight` viewport: `PHONE_WORLD_ZOOM`
 * when its short side is a phone's (the orientation rule's threshold), else 1.
 */
export function worldZoom(cssWidth: number, cssHeight: number): number {
  return Math.min(cssWidth, cssHeight) < PHONE_MAX_SHORT_SIDE ? PHONE_WORLD_ZOOM : 1;
}

/** The part of the room the world camera shows: its zoom, and its top-left in room units. */
export interface WorldView {
  readonly zoom: number;
  readonly scrollX: number;
  readonly scrollY: number;
}

/** The view's size in room units at a world zoom. */
export function viewSize(zoom: number): { w: number; h: number } {
  return { w: GAME_WIDTH / zoom, h: GAME_HEIGHT / zoom };
}

/**
 * One axis of the view's start: centred on `focus` and clamped so the view
 * stays inside the extent; where the extent is shorter than the view, centred
 * on the extent and then kept inside the canvas while the canvas can hold it.
 */
function axisStart(
  focus: number,
  size: number,
  start: number,
  length: number,
  canvas: number,
): number {
  if (length >= size) return clamp(focus - size / 2, start, start + length - size);
  const centred = start + (length - size) / 2;
  return canvas >= size ? clamp(centred, 0, canvas - size) : (canvas - size) / 2;
}

/**
 * The view for a player at `focus` in a room whose drawn extent is `extent`
 * (the shed's inset ring, the garden's whole canvas), at world zoom `zoom`:
 * centred on the player, never showing anything outside the extent.
 */
export function worldView(
  focus: { readonly x: number; readonly y: number },
  extent: Rect,
  zoom: number,
): WorldView {
  const { w, h } = viewSize(zoom);
  return {
    zoom,
    scrollX: axisStart(focus.x, w, extent.x, extent.w, GAME_WIDTH),
    scrollY: axisStart(focus.y, h, extent.y, extent.h, GAME_HEIGHT),
  };
}
