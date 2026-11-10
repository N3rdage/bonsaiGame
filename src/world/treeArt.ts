/**
 * obj_tree_sprite's Draw event as pure data: the bonsai silhouette the room
 * draws for a tree (shadow, pot in its tier's `pot_palette` colours, trunk,
 * three leaf circles with a darker outline pass), in logical px. The
 * prototype drew it 48 px tall round a centre origin for every tree; here it
 * is scaled with `spriteSize(heightCm)` (src/world/treeSprites.ts), so the 25
 * cm starter is the prototype's sprite halved, and anchored on the pot's base.
 */

import { speciesSeasonalColor, getSpecies } from '../sim/species';
import type { Season } from '../sim/seasons';
import type { BonsaiTree } from '../sim/types';
import { potPalette, type Rgb } from '../viewer/potPalette';
import { treeShadow, type Shadow } from './roomArt';
import type { Rect } from './shedRoom';

/** The prototype's sprite height in prototype px. */
const PROTOTYPE_SPRITE_PX = 48;
/** Draw_0's offsets from the centre origin, prototype px: the pot's base and the canopy's top. */
const POT_BASE = 18;
const CANOPY_TOP = 14 + 8;
/** Draw_0: the trunk colour rgb(75, 50, 30). */
const TRUNK_COLOUR = 0x4b321e;
/** Draw_0: the outline pass is the leaf colour less 50 a channel. */
const OUTLINE_DARKEN = 50;

export interface Circle {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A horizontal slice of the pot body: a quad (top-left, top-right, bottom-right, bottom-left) in one colour. */
export interface BodyRow {
  readonly points: readonly [Point, Point, Point, Point];
  readonly colour: number;
}

export interface TreeArt {
  /** Logical px per prototype px. */
  readonly scale: number;
  readonly shadow: Shadow;
  /** The fancy pot's two feet, drawn first so the body overlaps their tops; none for the standard pot. */
  readonly feet: readonly Rect[];
  readonly feetColour: number;
  /** The tapered body, one row per prototype px, shading from the body colour at the rim to the outline colour at the base. */
  readonly body: readonly BodyRow[];
  /** The fancy pot's glaze sheen down the body's left. */
  readonly sheen: { readonly rect: Rect; readonly colour: number } | undefined;
  /** The body's trapezoid outline, a closed loop. */
  readonly outline: { readonly points: readonly Point[]; readonly colour: number };
  readonly rim: { readonly rect: Rect; readonly fill: number; readonly line: number };
  readonly trunk: { readonly rect: Rect; readonly colour: number };
  /** The three leaf circles and their darker outline; none while the species drops its leaves (a maple's winter). */
  readonly canopy:
    | { readonly circles: readonly Circle[]; readonly fill: number; readonly line: number }
    | undefined;
  /** Where the label's bottom sits, the canopy's top. */
  readonly labelY: number;
}

const hex = (c: Rgb): number => (c.r << 16) | (c.g << 8) | c.b;

/** The channel-wise mix of `a` and `b` at `t`, rounded. */
function mix(a: Rgb, b: Rgb, t: number): number {
  const ch = (x: number, y: number): number => Math.round(x + (y - x) * t);
  return hex({ r: ch(a.r, b.r), g: ch(a.g, b.g), b: ch(a.b, b.b) });
}

function darker(colour: number): number {
  const ch = (shift: number): number => Math.max(0, ((colour >> shift) & 0xff) - OUTLINE_DARKEN);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * The tree drawn `size` px tall with its pot's base centred on (x, baseY), in
 * `season`'s leaf colour (the species' seasonal colour, as the 3D foliage).
 */
export function treeArt(
  tree: BonsaiTree,
  season: Season,
  x: number,
  baseY: number,
  size: number,
): TreeArt {
  const k = size / PROTOTYPE_SPRITE_PX;
  const cy = baseY - POT_BASE * k;
  const at = (dx: number, dy: number): Point => ({ x: x + dx * k, y: cy + dy * k });
  /** draw_rectangle(x + x0, y + y0, x + x1, y + y1), prototype px from the centre. */
  const rect = (x0: number, y0: number, x1: number, y1: number): Rect => ({
    x: x + x0 * k,
    y: cy + y0 * k,
    w: (x1 - x0) * k,
    h: (y1 - y0) * k,
  });
  const pot = potPalette(tree.potTier);
  const fancy = pot.highlight !== undefined;
  // The body tapers from half-width 10 at its rim (y + 8) to 8 at its base (y + 18).
  const halfW = (dy: number): number => 10 - ((dy - 8) / (POT_BASE - 8)) * 2;
  const rows = POT_BASE - 8;
  const body = Array.from({ length: rows }, (_, i): BodyRow => {
    const top = 8 + i;
    return {
      points: [
        at(-halfW(top), top),
        at(halfW(top), top),
        at(halfW(top + 1), top + 1),
        at(-halfW(top + 1), top + 1),
      ],
      colour: mix(pot.body, pot.bodyLine, (i + 0.5) / rows),
    };
  });
  const leaf = speciesSeasonalColor(getSpecies(tree.speciesKey), season);
  const fill = leaf === undefined ? undefined : Number.parseInt(leaf.slice(1), 16);
  return {
    scale: k,
    shadow: treeShadow(x, cy, k),
    feet: fancy ? [rect(-8, 17, -4, 21), rect(4, 17, 8, 21)] : [],
    feetColour: hex(pot.bodyLine),
    body,
    sheen: pot.highlight && { rect: rect(-8, 10, -6, 17), colour: hex(pot.highlight) },
    outline: {
      points: [at(-10, 8), at(10, 8), at(8, POT_BASE), at(-8, POT_BASE)],
      colour: hex(pot.bodyLine),
    },
    rim: { rect: rect(-11, 7, 11, 10), fill: hex(pot.rim), line: hex(pot.rimLine) },
    trunk: { rect: rect(-2, -8, 2, 8), colour: TRUNK_COLOUR },
    canopy:
      fill === undefined
        ? undefined
        : {
            circles: [
              { ...at(-7, -8), r: 8 * k },
              { ...at(6, -6), r: 8 * k },
              { ...at(0, -14), r: 8 * k },
            ],
            fill,
            line: darker(fill),
          },
    labelY: cy - CANOPY_TOP * k,
  };
}
