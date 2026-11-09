/**
 * Which prop or tree the player can use, ported from archive/gamemaker/objects/obj_player_2d
 * (Step_0: `instance_nearest` over obj_interactable, dropped when further than
 * `interact_range`; E calls its `on_interact`). Pure; WorldScene draws the prompt.
 */

import { fromPrototype } from './shedRoom';

/** obj_player_2d/Create_0.gml line 5: interact_range = 40 prototype px. */
export const INTERACT_RANGE = fromPrototype(40);

/** Anything E can use: a prop, or a tree on the floor. */
export interface Interactable {
  readonly key: string;
  /** The prototype object's `prompt`: what E does here. */
  readonly prompt: string;
  /** The instance origin, logical px. */
  readonly x: number;
  readonly y: number;
}

/**
 * The target nearest the player within `INTERACT_RANGE`, or undefined.
 * Distance is the prototype's own measure, `point_distance` between the two
 * instance origins: here the player's position (its feet) to the target's
 * origin (a prop's centre, a floor tree's pot base).
 */
export function nearestInteractable<T extends Interactable>(
  player: { readonly x: number; readonly y: number },
  targets: readonly T[],
): T | undefined {
  let best: T | undefined;
  let bestDist = Infinity;
  for (const target of targets) {
    const dist = Math.hypot(target.x - player.x, target.y - player.y);
    if (dist < bestDist) {
      best = target;
      bestDist = dist;
    }
  }
  return bestDist <= INTERACT_RANGE ? best : undefined;
}

/** The text shown over the player: the key and the target's prototype `prompt`, e.g. `E: Make Pot`. */
export function promptFor(target: Interactable): string {
  return `E: ${target.prompt}`;
}
