/**
 * Which prop the player can use, ported from archive/gamemaker/objects/obj_player_2d
 * (Step_0: `instance_nearest` over obj_interactable, dropped when further than
 * `interact_range`; E calls its `on_interact`). Pure; WorldScene draws the prompt.
 */

import { fromPrototype, type Prop, type Room } from './shedRoom';

/** obj_player_2d/Create_0.gml line 5: interact_range = 40 prototype px. */
export const INTERACT_RANGE = fromPrototype(40);

/**
 * The prop nearest the player within `INTERACT_RANGE`, or undefined. Distance
 * is the prototype's own measure, `point_distance` between the two instance
 * origins: here the player's position (its feet) to the prop's centre.
 */
export function nearestInteractable(
  player: { readonly x: number; readonly y: number },
  room: Room,
): Prop | undefined {
  let best: Prop | undefined;
  let bestDist = Infinity;
  for (const prop of room.props) {
    const dist = Math.hypot(prop.x - player.x, prop.y - player.y);
    if (dist < bestDist) {
      best = prop;
      bestDist = dist;
    }
  }
  return bestDist <= INTERACT_RANGE ? best : undefined;
}

/** The text shown over the player: the key and the prop's prototype `prompt`, e.g. `E: Make Pot`. */
export function promptFor(prop: Prop): string {
  return `E: ${prop.prompt}`;
}
