/**
 * Taps in the 3D world, as pure functions: which presses that went to the
 * camera were really taps (`TapTracker`), and the walk a tap on a place or a
 * prop sets going (`routeInput`). A drag that turned the camera is never a tap.
 */

import { MOVE_SPEED, type MoveInput } from '../world/player';

/** A press that travels more than this many game px (480 wide) at any moment is a drag, not a tap. */
export const TAP_MAX_MOVE_PX = 4;
/** A press held longer than this, ms, is not a tap. */
export const TAP_MAX_MS = 350;

/** True if a press that went `travel` px furthest from where it began and lasted `ms` is a tap. */
export function isTap(travel: number, ms: number): boolean {
  return travel <= TAP_MAX_MOVE_PX && ms <= TAP_MAX_MS;
}

/** What a tap landed on: a prop, by its hotspot id, or bare floor at a room px point. */
export type Picked =
  { readonly hotspot: string } | { readonly floor: { readonly x: number; readonly y: number } };

/** A prop's middle on screen, in game px (480 x 270). */
export interface ScreenSpot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/**
 * The prop a tap at `at` (game px) acts on: the nearest prop whose middle is
 * within `radius` of it, or the `direct` one the ray hit when it is nearer
 * than the rest. A touch tap passes a radius of the UI's tap target size so a
 * near miss still acts on the prop; a mouse click passes 0, so only a direct
 * hit does. Undefined when no prop qualifies.
 */
export function nearestSpot(
  at: { readonly x: number; readonly y: number },
  spots: readonly ScreenSpot[],
  radius: number,
  direct?: string,
): string | undefined {
  let best: string | undefined;
  let bestDist = Infinity;
  for (const spot of spots) {
    const dist = Math.hypot(spot.x - at.x, spot.y - at.y);
    if ((dist <= radius || spot.id === direct) && dist < bestDist) {
      best = spot.id;
      bestDist = dist;
    }
  }
  return best;
}

interface Track {
  readonly x: number;
  readonly y: number;
  readonly at: number;
  travel: number;
  /** False once a second pointer joined: a pinch is no tap. */
  alone: boolean;
}

/** The presses the camera took, followed from down to up: `up` says whether the release closed a tap. */
export class TapTracker {
  private readonly tracks = new Map<number, Track>();

  down(id: number, x: number, y: number, at: number): void {
    const alone = this.tracks.size === 0;
    for (const track of this.tracks.values()) track.alone = false;
    this.tracks.set(id, { x, y, at, travel: 0, alone });
  }

  move(id: number, x: number, y: number): void {
    const track = this.tracks.get(id);
    if (track) track.travel = Math.max(track.travel, Math.hypot(x - track.x, y - track.y));
  }

  /** Ends the press `id` at time `at`; true if it was a tap. */
  up(id: number, at: number): boolean {
    const track = this.tracks.get(id);
    this.tracks.delete(id);
    return track !== undefined && track.alone && isTap(track.travel, at - track.at);
  }
}

/**
 * The plan-space input (not turned by the camera) that walks `from` to `to`
 * in a straight line: full speed, and the last step short enough to land on
 * it. `arrived` is true when there is nowhere left to go.
 */
export function routeInput(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): { input: MoveInput; arrived: boolean } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return { input: { x: 0, y: 0 }, arrived: true };
  const scale = Math.min(1, dist / MOVE_SPEED) / dist;
  return { input: { x: dx * scale, y: dy * scale }, arrived: false };
}
