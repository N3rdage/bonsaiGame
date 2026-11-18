// The house's doors, drawn in Inked (art/inked/README.md) at the scale rule's
// heights and written to public/assets/. Sizes in logical px:
//   spr_door_side_w   a door in a west wall seen side-on, 8 x 40, cut out: the
//                     frame on the wall's 8 px cap, the doorway dark between
//                     its jambs and the leaf ajar into the room (east of it)
//   spr_door_side_e   the same in an east wall, mirrored, the room west of it;
//                     the pair are the four doors between the house rooms
//   spr_door_glass    the study's glazed double door front-on, 48 x 40, cut out:
//                     two leaves of spr_door_glazed's look in one frame, its
//                     bottom on the south band's
//
// Every other door is drawn where its room is, so this is the list of them all:
//   spr_door_glazed   one glazed leaf front-on, 24 x 40 (garden.mjs): the garden's
//                     doors to the study and the greenhouse, and the greenhouse's
//                     back to the garden
//   spr_gate          the side gate, 16 x 16 (garden.mjs), both gardens' sides
//   spr_shed_door     a plank door front-on, 24 x 40 (shed.mjs): the shed's
//                     lounge door and the garden's door into the shed
//   spr_shed_door_s   the shed's garden door in its south cap, 24 x 16 (shed.mjs)
//   spr_front_door    the front door front-on, 24 x 40 (frontGarden.mjs)
//   spr_roller_door   the garage's roller door, 77 x 40 (frontGarden.mjs)
//   spr_door          the prototype's door, packed by art/sheets.mjs: the
//                     lounge's back to the shed and the hallway's front door
//
// Every page has its own seed in SEEDS, written out, and its origin where it
// lands in a room. Everything is seeded: a rerun reproduces the PNGs byte for
// byte.

import { createPage, finishCutOut } from './index.mjs';
import { FINE, MARK, OUTLINE, SEAM, rect, seg, writeSheets } from './house.mjs';

/** One seed per page, written out so adding a page never moves another's. */
const SEEDS = {
  sideW: 0x7d00,
  sideE: 0x7d01,
  glass: 0x7d10,
};

/**
 * A door in a side wall seen side-on, 8 x 40, standing on its frame's bottom
 * edge, drawn for a west wall (the room east of it) or, `mirror`ed, an east
 * one. The painted frame on the 8 px cap: a head across the top and a jamb
 * either side, the doorway between them dark and cross-hatched, a threshold
 * at the foot. The leaf stands ajar from the room-side jamb, its free edge
 * swung out across the doorway, its top and foot dropping towards that edge
 * as it turns to the viewer, two panels and a brass knob by the free edge.
 */
function sideDoor(seed, origin, mirror) {
  const page = createPage(8, 40, { seed, origin });
  const { k } = page;
  const X = (x) => (mirror ? 8 - x : x);
  const P = (pts) => pts.map(([x, y]) => [X(x), y]);
  const box = (x, y, w, h, wash, opts) => k.shape(P(rect(x, y, w, h)), wash, opts);
  box(1.6, 4, 4.8, 34, 'shadow', { width: SEAM, hatching: 'shadow', wear: false });
  for (const x of [0.4, 6.2]) box(x, 2.6, 1.4, 35.6, 'paint', { width: SEAM });
  box(0.4, 0.6, 7.2, 3, 'paint', { width: OUTLINE });
  box(0.2, 37.6, 7.6, 2, 'stone', { width: SEAM });
  const leaf = [
    [6.6, 4.2],
    [3, 6.2],
    [3, 38.4],
    [6.6, 37.6],
  ];
  k.shape(P(leaf), 'wood', { width: SEAM, hatching: P(rect(5.4, 5, 1.2, 32.6)) });
  for (const [top, foot] of [
    [9, 20],
    [24, 34.6],
  ])
    k.shape(
      P([
        [6, top - 0.2],
        [3.8, top + 0.8],
        [3.8, foot + 0.8],
        [6, foot],
      ]),
      'wood',
      { width: MARK, wear: false },
    );
  seg(k, X(6.6), 4.2, X(6.6), 37.6, OUTLINE);
  k.blob(X(3.9), 22.4, 0.7, 0.9, 'brass', { width: MARK });
  return finishCutOut(page);
}

/**
 * One glazed leaf in the double door from `x`, 21 px across: spr_door_glazed's
 * pane split by glazing bars over a solid kick panel, its far side hatched,
 * and its brass knob on the meeting stile (`knob` its x).
 */
function glazedLeaf(k, x, knob) {
  k.box(x, 3, 21, 36.6, 'top');
  k.box(x + 2.5, 5, 16, 21, 'glass', { width: SEAM, hatching: rect(x + 11.5, 5, 7, 21) });
  seg(k, x + 10.5, 5, x + 10.5, 26);
  for (const y of [12, 19]) seg(k, x + 2.5, y, x + 18.5, y);
  seg(k, x + 4, 10, x + 7, 6.5, 1);
  k.box(x + 2.5, 29, 16, 8.5, 'wood', { width: SEAM });
  k.blob(knob, 27.6, 1.1, 1.1, 'brass', { width: MARK });
}

// The study's glazed double door, front-on: one wooden frame round two
// leaves meeting at its centre, their bottom on the frame's.
function glassDoor() {
  const page = createPage(48, 40, { seed: SEEDS.glass, origin: [208, 184] });
  const { k } = page;
  k.box(0.8, 0.8, 46.4, 39, 'wood');
  glazedLeaf(k, 3, 21.6);
  glazedLeaf(k, 24, 26.4);
  seg(k, 24, 3, 24, 39.6, OUTLINE);
  k.hatchIn(rect(3.2, 3.2, 1.6, 36.2), FINE);
  return finishCutOut(page);
}

writeSheets([
  ['spr_door_side_w', () => sideDoor(SEEDS.sideW, [184, 144], false)],
  ['spr_door_side_e', () => sideDoor(SEEDS.sideE, [288, 144], true)],
  ['spr_door_glass', glassDoor],
]);
