// The sample scene every candidate draws: the shed as the site plan has it,
// 5.0 x 3.5 m (an interior of 10 x 7 tiles), at the proposed scale. Logical
// coordinates are relative to the shed's outer top-left corner.
//
// `structure` is the room itself (wall face, caps, floor, window, shelf and
// the doors' frames), drawn first. `objects` stand on the floor: each has a
// footprint (where it touches the floor) and a sprite rect (what it covers
// on screen), and `sorted()` orders them by the footprint's bottom edge, the
// depth sort the compositing uses.

import { SIZES } from './scale.mjs';

const rect = (x, y, w, h) => ({ x, y, w, h });
/** A furniture piece or the avatar, its sprite size taken from the scale rule. */
const at = (kind, footprint, spriteTop) => {
  const [w, h] = SIZES[kind].sprite;
  return { kind, footprint, sprite: rect(footprint.x, spriteTop, w, h) };
};

export const SHED = {
  width: 176,
  height: 168,
  backWall: rect(0, 0, 176, 48),
  leftCap: rect(0, 48, 8, 120),
  rightCap: rect(168, 48, 8, 120),
  frontCap: rect(0, 160, 176, 8),
  floor: rect(8, 48, 160, 112),
  window: rect(120, 8, 32, 24),
  shelf: rect(16, 12, 44, 16),
  doorNorth: rect(76, 8, 24, 40),
  doorEast: rect(168, 88, 8, 40),
};

/** The east door's leaf, ajar into the room: hinged at the north jamb, its free edge swung south-west. */
export const EAST_LEAF = { hinge: [168, 104], free: [154, 124], height: 40 };

export const OBJECTS = [
  { kind: 'rug', footprint: rect(70, 122, 48, 28), sprite: rect(70, 122, 48, 28) },
  at('workbench', rect(16, 48, 48, 20), 28),
  at('plantingTable', rect(104, 48, 40, 20), 28),
  at('kiosk', rect(8, 96, 40, 20), 72),
  at('pedestal', rect(120, 104, 16, 12), 84),
  at('avatar', rect(96, 108, 16, 8), 84),
  { kind: 'potStack', footprint: rect(138, 94, 12, 6), sprite: rect(138, 84, 12, 16) },
  { kind: 'wateringCan', footprint: rect(54, 116, 14, 6), sprite: rect(54, 110, 14, 12) },
  { kind: 'sack', footprint: rect(132, 134, 16, 8), sprite: rect(132, 124, 16, 18) },
  { kind: 'doorLeaf', footprint: rect(154, 104, 14, 20), sprite: rect(154, 64, 14, 60) },
];

/** The starter bonsai on the pedestal's top, centred, at hero scale. */
export const BONSAI = { cx: 128, base: 91, pot: [10, 5], height: 18 };

/** Floor decor and furniture in back-to-front order; the rug always first, as it lies on the floor. */
export function sorted() {
  const bottom = (o) => (o.kind === 'rug' ? -1 : o.footprint.y + o.footprint.h);
  return [...OBJECTS].sort((a, b) => bottom(a) - bottom(b));
}
