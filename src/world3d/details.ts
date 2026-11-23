/**
 * The 3D rooms' modelled details, as pure data derived from the 2D room data
 * and never authored beside it: a door where the plan cuts a door opening, a
 * window where it cuts a window opening (and the windows and roller door hung from a building's face), a box hedge on each flat bed
 * (`spr_bed`) and a small shrub on each source plant. Each is a handful of
 * boxes in plan metres with a palette wash. A door or window goes with the
 * wall piece it hangs from, so the camera's cut-away takes it along.
 */

import type { ModelPart } from './furnitureModels';
import type { Opening, RoomPlan3d, WallBox } from './plan';
import type { Room } from '../world/shedRoom';
import {
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
/** A source plant's shrub: a stem and a crown over its standing point (metres). */
const STEM = { width: 0.08, height: 0.3 };
const CROWN = { width: 0.5, z0: 0.25, z1: 0.85 };

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
function faceFixtures(room: Room): Detail[] {
  const faces = room.furniture
    .map((f, index) => ({ f, index }))
    .filter(({ f }) => f.sheet.key.endsWith('_face'));
  return room.furniture.flatMap((f, index): Detail[] => {
    if (!isFaceFixture(f)) return [];
    const host = faces.find(
      ({ f: face }) =>
        face.x <= f.x &&
        face.x + face.w >= f.x + f.w &&
        face.y <= f.y &&
        face.y + face.h >= f.y + f.h,
    );
    if (host === undefined) return [];
    const face = furnitureBox(host.f, host.index);
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

/** A shrub standing at (`x`, `y`): a stem under a crown. */
function plantingParts(x: number, y: number): ModelPart[] {
  const stem = STEM.width / 2;
  const crown = CROWN.width / 2;
  return [
    {
      wash: 'wood',
      x0: x - stem,
      x1: x + stem,
      y0: y - stem,
      y1: y + stem,
      z0: 0,
      z1: STEM.height,
    },
    {
      wash: 'runner',
      x0: x - crown,
      x1: x + crown,
      y0: y - crown,
      y1: y + crown,
      z0: CROWN.z0,
      z1: CROWN.z1,
    },
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
  const plantings = room.props
    .filter((prop) => prop.speciesKey !== undefined)
    .map((prop): Detail => ({
      name: prop.key,
      kind: 'planting',
      parts: plantingParts(metres(prop.x), metres(prop.y + prop.h / 2)),
    }));
  return [...openings, ...faceFixtures(room), ...hedges, ...plantings];
}

/** How many details there are of each kind present. */
export function countDetails(details: readonly Detail[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { kind } of details) counts[kind] = (counts[kind] ?? 0) + 1;
  return counts;
}
