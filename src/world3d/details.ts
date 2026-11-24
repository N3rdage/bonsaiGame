/**
 * The 3D rooms' modelled details, as pure data derived from the 2D room data
 * and never authored beside it: a door where the plan cuts a door opening, a
 * window where it cuts a window opening (and the windows, roller door and door
 * props hung from a building's face), a box hedge on each flat bed
 * (`spr_bed`) and a shrub of its species on each source plant. Each is a handful of
 * boxes in plan metres with a palette wash. A door or window goes with the
 * wall piece it hangs from, so the camera's cut-away takes it along.
 */

import type { ModelPart } from './furnitureModels';
import type { Box, Opening, RoomPlan3d, WallBox } from './plan';
import type { SpeciesKey } from '../sim/types';
import { SHEETS } from '../world/assets';
import type { Furniture, Prop, Rect, Room } from '../world/shedRoom';
import {
  DOOR_HEIGHT,
  DOOR_WIDTH,
  FACE_RELIEF,
  ROLLER_DOOR_SHEET,
  WINDOW_HEAD,
  WINDOW_SILL,
  furnitureBox,
  heightMetres,
  isFaceFixture,
  metres,
} from './plan';

export type DetailKind = 'door' | 'window' | 'hedge' | 'planting';

/** One detail: its boxes in plan metres, and the wall piece it hangs from (none for a hedge or a planting, which stand on the floor). */
export interface Detail {
  readonly name: string;
  readonly kind: DetailKind;
  readonly host?: string;
  readonly parts: readonly ModelPart[];
}

/** The depth of a frame's bars along the opening, metres. */
const BAR = 0.08;
/** The thickness of a door leaf and of a window's glass across the wall, metres. */
const LEAF = 0.05;
const GLASS = 0.03;
/** Windows wider than this get a mullion down the middle, metres. */
const MULLION_OVER = 1;
/**
 * A hedge is a low planted border, this tall (metres), so the player, who walks
 * over the bed in the 2D plan, steps over it. It is inset from the bed's edge by `HEDGE_INSET`.
 */
const HEDGE_HEIGHT = 0.25;
const HEDGE_INSET = 0.04;
/** A source plant's stem is this wide (metres); its crown is a stack of tiers over the prop's footprint. */
const STEM_WIDTH = 0.08;
/**
 * Each species' crown: a wash and its tiers from the ground up, each a width
 * as a fraction of the prop's footprint (the widest is 1) and a span in z
 * (metres). The juniper is a dense cone, the maple a broad round crown, the
 * pine layers with air between.
 */
const CROWNS: Record<
  SpeciesKey,
  { wash: ModelPart['wash']; tiers: readonly (readonly [number, number, number])[] }
> = {
  juniper: {
    wash: 'foliage',
    tiers: [
      [1, 0.15, 0.4],
      [0.7, 0.4, 0.65],
      [0.4, 0.65, 0.9],
    ],
  },
  maple: {
    wash: 'mapleSummer',
    tiers: [
      [0.7, 0.3, 0.5],
      [1, 0.5, 0.75],
      [0.6, 0.75, 0.9],
    ],
  },
  pine: {
    wash: 'pineSummer',
    tiers: [
      [1, 0.3, 0.4],
      [0.75, 0.5, 0.6],
      [0.5, 0.7, 0.8],
      [0.25, 0.9, 1],
    ],
  },
};

/** The sheet whose flat runs are the garden's beds. */
const BED_SHEET = 'spr_bed';

const EPSILON = 1e-6;

/** A box over `[a0, a1]` along the opening and `[z0, z1]` up, filling `across` of the wall's depth around its middle. */
function bar(
  o: Opening,
  wash: ModelPart['wash'],
  a0: number,
  a1: number,
  z0: number,
  z1: number,
  across = 1,
): ModelPart {
  const alongX = o.x1 - o.x0 >= o.y1 - o.y0;
  const [t0, t1] = alongX ? [o.y0, o.y1] : [o.x0, o.x1];
  const mid = (t0 + t1) / 2;
  const half = ((t1 - t0) * across) / 2;
  const [u0, u1] = [mid - half, mid + half];
  return alongX
    ? { wash, x0: a0, x1: a1, y0: u0, y1: u1, z0, z1 }
    : { wash, x0: u0, x1: u1, y0: a0, y1: a1, z0, z1 };
}

/**
 * A door in `o`: a frame of jambs and a head round a leaf. A door in a fence
 * lower than the opening is a gate, as tall as its fence (`top`).
 */
function doorParts(o: Opening, top: number): ModelPart[] {
  const alongX = o.x1 - o.x0 >= o.y1 - o.y0;
  const [a0, a1] = alongX ? [o.x0, o.x1] : [o.y0, o.y1];
  const depth = alongX ? o.y1 - o.y0 : o.x1 - o.x0;
  const leaf = Math.min(1, LEAF / depth);
  return [
    bar(o, 'wood', a0, a0 + BAR, o.z0, top),
    bar(o, 'wood', a1 - BAR, a1, o.z0, top),
    bar(o, 'wood', a0 + BAR, a1 - BAR, top - BAR, top),
    bar(o, 'floor', a0 + BAR, a1 - BAR, o.z0, top - BAR, leaf),
  ];
}

/** A window in `o`: a frame of sill, head and jambs round a pane of glass, with a mullion when it is wide. */
function windowParts(o: Opening): ModelPart[] {
  const alongX = o.x1 - o.x0 >= o.y1 - o.y0;
  const [a0, a1] = alongX ? [o.x0, o.x1] : [o.y0, o.y1];
  const depth = alongX ? o.y1 - o.y0 : o.x1 - o.x0;
  const glass = Math.min(1, GLASS / depth);
  const parts = [
    bar(o, 'paint', a0, a0 + BAR, o.z0, o.z1),
    bar(o, 'paint', a1 - BAR, a1, o.z0, o.z1),
    bar(o, 'paint', a0 + BAR, a1 - BAR, o.z0, o.z0 + BAR),
    bar(o, 'paint', a0 + BAR, a1 - BAR, o.z1 - BAR, o.z1),
    bar(o, 'studyPaper', a0 + BAR, a1 - BAR, o.z0 + BAR, o.z1 - BAR, glass),
  ];
  if (a1 - a0 > MULLION_OVER) {
    const mid = (a0 + a1) / 2;
    parts.push(bar(o, 'paint', mid - BAR / 4, mid + BAR / 4, o.z0 + BAR, o.z1 - BAR, glass * 1.5));
  }
  return parts;
}

/** Whether two boxes touch or overlap in plan. */
function touches(a: WallBox, o: Opening): boolean {
  return (
    a.x0 <= o.x1 + EPSILON &&
    a.x1 >= o.x0 - EPSILON &&
    a.y0 <= o.y1 + EPSILON &&
    a.y1 >= o.y0 - EPSILON
  );
}

/**
 * The wall piece an opening's detail hangs from: the lintel over it, which the
 * camera's cut takes away whole, else its sill, else any piece it touches.
 */
function hostOf(o: Opening, walls: readonly WallBox[]): WallBox | undefined {
  const named = (kind: string): WallBox | undefined =>
    walls.find((wall) => wall.name.endsWith(`.${kind}.${o.name}`));
  return named('lintel') ?? named('sill') ?? walls.find((wall) => touches(wall, o));
}

/**
 * The fixtures set in a building's face: each `spr_house_window` over its span
 * along the face, from `WINDOW_SILL` to `WINDOW_HEAD`, and the garage's roller
 * door, a slab `heightMetres` of its frame tall. Each stands `FACE_RELIEF`
 * proud of the face on either side and hangs from the face's box (the
 * `spr_*_face` piece whose rect holds the fixture's), so the camera's cut
 * takes it away with the face.
 */
function faceFixtures(room: Room, plan: RoomPlan3d): Detail[] {
  const faces = room.furniture
    .map((f, index) => ({ f, index }))
    .filter(({ f }) => f.sheet.key.endsWith('_face'));
  const faceOf = (r: Rect): { f: Furniture; index: number } | undefined =>
    faces.find(
      ({ f: face }) =>
        face.x <= r.x &&
        face.x + face.w >= r.x + r.w &&
        face.y <= r.y &&
        face.y + face.h >= r.y + r.h,
    );
  const doors = room.props
    .filter((prop) => prop.wall !== undefined && !plan.openings.some((o) => o.name === prop.key))
    .flatMap((prop): Detail[] => {
      const host = faceOf({ x: prop.x - prop.w / 2, y: prop.y - prop.h / 2, w: prop.w, h: prop.h });
      return host === undefined ? [] : [faceDoor(prop, furnitureBox(host.f, host.index, room.key))];
    });
  const fixtures = room.furniture.flatMap((f, index): Detail[] => {
    if (!isFaceFixture(f)) return [];
    const host = faceOf(f);
    if (host === undefined) return [];
    const face = furnitureBox(host.f, host.index, room.key);
    const name = `furniture.${String(index)}.${f.sheet.key}`;
    const span = {
      x0: metres(f.x),
      x1: metres(f.x + f.w),
      y0: face.y0 - FACE_RELIEF,
      y1: face.y1 + FACE_RELIEF,
    };
    if (f.sheet.key === ROLLER_DOOR_SHEET) {
      const door: ModelPart = { wash: 'paint', ...span, z0: 0, z1: heightMetres(f.h) };
      return [{ name, kind: 'door', host: face.name, parts: [door] }];
    }
    const opening: Opening = { name, kind: 'window', ...span, z0: WINDOW_SILL, z1: WINDOW_HEAD };
    return [{ name, kind: 'window', host: face.name, parts: windowParts(opening) }];
  });
  return [...doors, ...fixtures];
}

/**
 * A door prop against a building's face: a wood frame standing `FACE_RELIEF`
 * proud of the face on either side, its leaf set back to half that. It is as
 * wide and tall as a door the plan cuts (`DOOR_WIDTH` at least, `DOOR_HEIGHT`)
 * and centred on the prop, whose own extent is only its 0.5 m interact box.
 * A glazed door's leaf is glass, any other's planks.
 */
function faceDoor(prop: Prop, face: Box): Detail {
  const half = Math.max(DOOR_WIDTH, metres(prop.w)) / 2;
  const span: Opening = {
    name: prop.key,
    kind: 'door',
    x0: metres(prop.x) - half,
    x1: metres(prop.x) + half,
    y0: face.y0 - FACE_RELIEF,
    y1: face.y1 + FACE_RELIEF,
    z0: 0,
    z1: DOOR_HEIGHT,
  };
  const { x0, x1, z1 } = span;
  const depth = span.y1 - span.y0;
  const leaf = (depth - FACE_RELIEF) / depth;
  const wash = prop.sheet?.key === SHEETS.doorGlazed.key ? 'studyPaper' : 'floor';
  return {
    name: prop.key,
    kind: 'door',
    host: face.name,
    parts: [
      bar(span, 'wood', x0, x0 + BAR, 0, z1),
      bar(span, 'wood', x1 - BAR, x1, 0, z1),
      bar(span, 'wood', x0 + BAR, x1 - BAR, z1 - BAR, z1),
      bar(span, wash, x0 + BAR, x1 - BAR, 0, z1 - BAR, leaf),
    ],
  };
}

/** A box hedge on a bed's footprint. */
function hedgeParts(bed: { x0: number; x1: number; y0: number; y1: number }): ModelPart[] {
  return [
    {
      wash: 'runner',
      x0: bed.x0 + HEDGE_INSET,
      x1: bed.x1 - HEDGE_INSET,
      y0: bed.y0 + HEDGE_INSET,
      y1: bed.y1 - HEDGE_INSET,
      z0: 0,
      z1: HEDGE_HEIGHT,
    },
  ];
}

/** A species' shrub standing at (`x`, `y`): a stem under tiers of foliage whose widest spans `width`. */
function plantingParts(species: SpeciesKey, x: number, y: number, width: number): ModelPart[] {
  const { wash, tiers } = CROWNS[species];
  const stem = STEM_WIDTH / 2;
  const top = tiers[tiers.length - 1]?.[1] ?? 0;
  return [
    { wash: 'wood', x0: x - stem, x1: x + stem, y0: y - stem, y1: y + stem, z0: 0, z1: top },
    ...tiers.map(([fraction, z0, z1]): ModelPart => {
      const half = (width * fraction) / 2;
      return { wash, x0: x - half, x1: x + half, y0: y - half, y1: y + half, z0, z1 };
    }),
  ];
}

/**
 * The details of `room`: a door and a window at each opening of `plan`, a
 * hedge on each flat bed furniture piece and a planting on each source plant
 * (a prop with a species), the plan's anchors and furniture being the room
 * data's own.
 */
export function roomDetails(room: Room, plan: RoomPlan3d): Detail[] {
  const openings = plan.openings.map((o): Detail => {
    const host = hostOf(o, plan.walls);
    return {
      name: o.name,
      kind: o.kind,
      ...(host === undefined ? {} : { host: host.name }),
      parts: o.kind === 'door' ? doorParts(o, Math.min(o.z1, host?.z1 ?? o.z1)) : windowParts(o),
    };
  });
  const hedges = plan.floor
    .concat(plan.furniture)
    .filter((box) => box.name.endsWith(`.${BED_SHEET}`))
    .map((bed): Detail => ({ name: bed.name, kind: 'hedge', parts: hedgeParts(bed) }));
  const plantings = room.props.flatMap((prop): Detail[] =>
    prop.speciesKey === undefined
      ? []
      : [
          {
            name: prop.key,
            kind: 'planting',
            parts: plantingParts(
              prop.speciesKey,
              metres(prop.x),
              metres(prop.y + prop.h / 2),
              metres(prop.w),
            ),
          },
        ],
  );
  return [...openings, ...faceFixtures(room, plan), ...hedges, ...plantings];
}

/** How many details there are of each kind present. */
export function countDetails(details: readonly Detail[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { kind } of details) counts[kind] = (counts[kind] ?? 0) + 1;
  return counts;
}
