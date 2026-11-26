/**
 * The seats in the 3D world: the lounge's sofa and armchair, where Interact
 * sits the player's body (the Sit_Chair clips, character.ts), and where the
 * body is drawn while it does. Cosmetic: the 2D player stays where it stood,
 * the furniture being solid, and nothing is saved. Pure data and arithmetic,
 * no Babylon, no Phaser.
 *
 * A seat's point is in room px, on its cushion; a heading is a plan heading in
 * radians (0 east, pi/2 south), as renderer.ts's `facing`.
 */

import { ARMCHAIR, SOFA } from '../world/loungeRoom';
import type { Furniture, Prop, RoomKey } from '../world/shedRoom';
import { metres } from './plan';

export type SeatKey = 'sofa' | 'armchair';

export interface Seat {
  readonly key: SeatKey;
  readonly room: RoomKey;
  /** Where the hips rest, room px: on the seat cushion, centred along its length. */
  readonly x: number;
  readonly y: number;
  /** The way the sitter faces: out from the seat's back. */
  readonly heading: number;
  /** The seat's piece of furniture. */
  readonly on: Furniture;
}

/** How far from the seat's front edge the hips rest, room px: a third of the way back on the sofa's 0.875 m, over half the armchair's cushion. */
const SETBACK = 10;
/** The cushions' top over the floor, metres: the foot (0.08), the seat base (0.3) and the cushion (0.13) of furnitureModels.ts, the same on both. */
export const SEAT_HEIGHT = 0.51;
/** How far the sit clips move the hips back from the body's origin, model units: `Sit_Chair_Down`'s last key of `hips` in z. */
export const SIT_HIPS_BACK = 0.397;
/** The height of the seat the sit clips were keyed for, model units: where the hips rest over the feet's floor. */
export const SIT_SEAT_UNITS = 0.38;

/** The sofa, its back on the west wall, facing east; the armchair, its back to the east, facing west. */
export const SEATS: readonly Seat[] = [
  {
    key: 'sofa',
    room: 'lounge',
    x: SOFA.x + SOFA.w - SETBACK,
    y: SOFA.y + SOFA.h / 2,
    heading: 0,
    on: SOFA,
  },
  {
    key: 'armchair',
    room: 'lounge',
    x: ARMCHAIR.x + SETBACK,
    y: ARMCHAIR.y + ARMCHAIR.h / 2,
    heading: Math.PI,
    on: ARMCHAIR,
  },
];

/** The prompt the Interact button shows at a seat. */
export const SIT_PROMPT = 'Sit';

/** A seat as an interactable at its furniture's centre, the way props are, so the usual nearest-target rule picks it. */
function seatProp({ key, on }: Seat): Prop {
  return {
    key: `seat_${key}`,
    label: key,
    prompt: SIT_PROMPT,
    x: on.x + on.w / 2,
    y: on.y + on.h / 2,
    w: on.w,
    h: on.h,
  };
}

/** The seats of `room` as targets; none unless the 3D world draws it with its body loaded (`world3d`), which is the only place a body sits. */
export function seatTargets(room: RoomKey, world3d: boolean): readonly Prop[] {
  return world3d ? SEATS.filter((seat) => seat.room === room).map(seatProp) : [];
}

/** The seat a target key names (`seatTargets`), if any. */
export function seatOf(targetKey: string): Seat | undefined {
  return SEATS.find((seat) => `seat_${seat.key}` === targetKey);
}

/** Where the body is drawn: plan metres (x east, y south, z up), and its plan heading. */
export interface BodyPlace {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly heading: number;
}

/** `to` seen from `from` as the shorter turn, radians. */
function turn(from: number, to: number): number {
  return ((((to - from) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
}

/**
 * The body `blend` (0 standing, 1 seated; `seatBlend` of character.ts) of the
 * way from where the player stands, facing `standing.heading`, to `seat`:
 * its feet slide to the seat (set forward of the hips by how far the clips
 * draw them back, so the hips land on the point), lift to the height the clips'
 * seat sits at under the cushion's top, and turn out the short way. `scale`
 * is the metres a model unit is drawn as.
 */
export function bodyPlace(
  standing: { readonly x: number; readonly y: number; readonly heading: number },
  seat: Seat,
  blend: number,
  scale: number,
): BodyPlace {
  const back = SIT_HIPS_BACK * scale;
  const seatX = metres(seat.x) + Math.cos(seat.heading) * back;
  const seatY = metres(seat.y) + Math.sin(seat.heading) * back;
  return {
    x: standing.x + (seatX - standing.x) * blend,
    y: standing.y + (seatY - standing.y) * blend,
    z: (SEAT_HEIGHT - SIT_SEAT_UNITS * scale) * blend,
    heading: standing.heading + turn(standing.heading, seat.heading) * blend,
  };
}
