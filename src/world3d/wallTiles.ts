/**
 * The 3D walls' Inked art: `wallRuns` (src/world/roomArt.ts) is the layout,
 * the same sheet and frame per run the 2D room draws, and this lays each run
 * on the plan box it belongs to, in metres, with each frame's UV rect, then
 * turns the quads into one mesh's vertex arrays. A back wall's face goes on
 * the north wall's inner face, the other walls' caps on their tops, and a
 * fence's bands on both of its long faces. Pure data; the renderer loads the
 * textures.
 */

import type { Sheet } from '../world/assets';
import { ROOM_STYLES, furnitureRuns, tileRuns, wallRuns, type WallRun } from '../world/roomArt';
import { ringWalls, type Room } from '../world/shedRoom';
import type { QuadMeshData } from './floorTiles';
import { toBabylon, type Vec3 } from './meshes';
import { furnitureBox, isPapered, metres, pixels, type Box, type WallBox } from './plan';

/** How far the art lies off the box's surface, so it never z-fights it. */
export const WALL_LIFT = 0.003;

/** How far a painted face lies off an inked furniture mass, which clears the outline shell that covers a 3 mm lift. */
export const MASS_LIFT = 0.05;

const EPSILON = 1e-6;

/** A plan wall box and the height its whole wall stands, which a piece cut by a window or door does not reach. */
export interface WallPiece extends WallBox {
  readonly height: number;
}

/** The wall a piece belongs to: `wall.3` for `wall.3.sill.window.0`. */
function wallOf(name: string): string {
  return name.split('.').slice(0, 2).join('.');
}

/** The walls' pieces, each with the full height of its wall (the tallest piece sharing its name's wall). */
export function wallPieces(walls: readonly WallBox[]): WallPiece[] {
  const heights = new Map<string, number>();
  for (const wall of walls) {
    heights.set(wallOf(wall.name), Math.max(heights.get(wallOf(wall.name)) ?? 0, wall.z1));
  }
  return walls.map((wall) => ({ ...wall, height: heights.get(wallOf(wall.name)) ?? wall.z1 }));
}

/**
 * Whether `piece` is a part of one of the room's ring walls, which the art
 * runs dress. A building's wall box in the garden (render, over its roof's
 * footprint) is not: its surface is its wash, and a fence's band laid on it
 * would stand on the building's own faces.
 */
export function onRing(room: Room, piece: Box): boolean {
  return ringWalls(room.bounds).some((r) => {
    const [x0, x1, y0, y1] = [metres(r.x), metres(r.x + r.w), metres(r.y), metres(r.y + r.h)];
    return (
      piece.x0 >= x0 - EPSILON &&
      piece.x1 <= x1 + EPSILON &&
      piece.y0 >= y0 - EPSILON &&
      piece.y1 <= y1 + EPSILON
    );
  });
}

/** The runs the walls wear: the ring's, without the windows, which the plan cuts as openings. */
function artRuns(room: Room): WallRun[] {
  const window = ROOM_STYLES[room.key].window?.sheet.key;
  return wallRuns(room).filter((run) => run.sheet.key !== window);
}

/** The distinct sheets the room's walls are drawn from, each loaded once. */
export function wallSheets(room: Room): Sheet[] {
  return [...new Map(artRuns(room).map((run) => [run.sheet.key, run.sheet])).values()];
}

/** One frame on one surface: its corners bottom-left, bottom-right, top-right, top-left seen from the normal's side, and the frame's UV rect (v up). */
export interface WallQuad {
  readonly frame: number;
  readonly normal: Vec3;
  readonly corners: readonly [Vec3, Vec3, Vec3, Vec3];
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
}

/** The quads laid on one wall piece. */
export interface PieceQuads {
  readonly piece: string;
  readonly quads: readonly WallQuad[];
}

/** The part of the line `from + k * span`, k in [0, 1], inside [lo, hi], as a range of k: empty when it is a point or less. */
function inside(
  from: number,
  span: number,
  lo: number,
  hi: number,
): readonly [number, number] | undefined {
  const [a, b] = [(lo - from) / span, (hi - from) / span];
  const range = [Math.max(0, Math.min(a, b)), Math.min(1, Math.max(a, b))] as const;
  return range[1] - range[0] > EPSILON ? range : undefined;
}

/**
 * The part of an axis-aligned `quad` that lies on `box`, or undefined when
 * none does. Along the quad's own two axes it is cut exactly to the box's
 * extent and its UVs follow linearly; across them, its plane must lie within
 * `tolerance` of the box's span, since art stands a little off the face it
 * dresses.
 */
export function clipQuad(quad: WallQuad, box: Box, tolerance: number): WallQuad | undefined {
  const [c0, c1, , c3] = quad.corners;
  const extent = { x: [box.x0, box.x1], y: [box.y0, box.y1], z: [box.z0, box.z1] } as const;
  let [s0, s1, t0, t1] = [0, 1, 0, 1];
  for (const axis of ['x', 'y', 'z'] as const) {
    const [lo, hi] = extent[axis];
    const [along, up] = [c1[axis] - c0[axis], c3[axis] - c0[axis]];
    if (Math.abs(along) > EPSILON) {
      const range = inside(c0[axis], along, lo, hi);
      if (!range) return undefined;
      [s0, s1] = range;
    } else if (Math.abs(up) > EPSILON) {
      const range = inside(c0[axis], up, lo, hi);
      if (!range) return undefined;
      [t0, t1] = range;
    } else if (c0[axis] < lo - tolerance || c0[axis] > hi + tolerance) {
      return undefined;
    }
  }
  const at = (s: number, t: number): Vec3 => ({
    x: c0.x + s * (c1.x - c0.x) + t * (c3.x - c0.x),
    y: c0.y + s * (c1.y - c0.y) + t * (c3.y - c0.y),
    z: c0.z + s * (c1.z - c0.z) + t * (c3.z - c0.z),
  });
  const [du, dv] = [quad.u1 - quad.u0, quad.v1 - quad.v0];
  return {
    frame: quad.frame,
    normal: quad.normal,
    corners: [at(s0, t0), at(s1, t0), at(s1, t1), at(s0, t1)],
    u0: quad.u0 + s0 * du,
    v0: quad.v0 + t0 * dv,
    u1: quad.u0 + s1 * du,
    v1: quad.v0 + t1 * dv,
  };
}

/** Whether `quad` lies on the face of `box` its normal points out of, `WALL_LIFT` off it, rather than inside the box or behind its other face. */
function onFace(quad: WallQuad, box: Box): boolean {
  const { x, y, z } = quad.normal;
  const [at, face] =
    x !== 0
      ? [quad.corners[0].x, x > 0 ? box.x1 : box.x0]
      : y !== 0
        ? [quad.corners[0].y, y > 0 ? box.y1 : box.y0]
        : [quad.corners[0].z, z > 0 ? box.z1 : box.z0];
  return Math.abs(at - face) <= WALL_LIFT + EPSILON;
}

/**
 * A layout's quads handed to the drawn boxes they lie on, grouped by box in
 * the order the boxes come. The layout is made on the plan's whole pieces, so
 * one wall claims a corner run; here every quad is cut to each drawn box whose
 * face it lies on, and the part over a neighbour's box rides that box, which
 * the camera's cutaway moves with its art. A part inside a box is out of sight
 * and a part on no drawn box would hang in the air, so both are dropped.
 */
export function onDrawnPieces(layout: readonly PieceQuads[], drawn: readonly Box[]): PieceQuads[] {
  const quads = layout.flatMap((piece) => piece.quads);
  return drawn.flatMap((box) => {
    const parts = quads.flatMap((quad) =>
      onFace(quad, box) ? (clipQuad(quad, box, WALL_LIFT + EPSILON) ?? []) : [],
    );
    return parts.length > 0 ? [{ piece: box.name, quads: parts }] : [];
  });
}

/** A run in plan metres. */
interface Span {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

type Kind = 'face' | 'cap' | 'band';

/** Whether the piece's wall runs east-west: the north and south walls do, a piece cut short by a window or door still. */
function alongX(piece: WallPiece): boolean {
  if (piece.side === 'N' || piece.side === 'S') return true;
  if (piece.side === 'W' || piece.side === 'E') return false;
  return piece.x1 - piece.x0 >= piece.y1 - piece.y0;
}

/** The part of a run's axis a piece covers, [from, to]: the run's x for a piece along x, its y otherwise. */
function overlap(span: Span, piece: WallPiece): readonly [number, number] {
  return alongX(piece)
    ? [Math.max(span.x0, piece.x0), Math.min(span.x1, piece.x1)]
    : [Math.max(span.y0, piece.y0), Math.min(span.y1, piece.y1)];
}

/**
 * Whether a run is laid on a piece: a face on a north piece; a cap or a band
 * on a piece it lies across, its extent across the piece's length inside the
 * piece's own, and sharing some of its length.
 */
function claims(kind: Kind, span: Span, piece: WallPiece): boolean {
  const [from, to] = overlap(span, piece);
  if (to - from <= EPSILON) return false;
  if (kind === 'face') return piece.side === 'N';
  const [lo, hi] = alongX(piece) ? [span.y0, span.y1] : [span.x0, span.x1];
  const [a0, a1] = alongX(piece) ? [piece.y0, piece.y1] : [piece.x0, piece.x1];
  return lo >= a0 - EPSILON && hi <= a1 + EPSILON;
}

/** A frame's UV rect for the fractions of it a quad shows (v up from the frame's bottom), inset half a texel. */
function frameUv(
  sheet: Sheet,
  frame: number,
  image: { readonly w: number; readonly h: number },
  show: readonly [number, number, number, number],
): Pick<WallQuad, 'u0' | 'v0' | 'u1' | 'v1'> {
  const columns = Math.max(1, Math.floor(image.w / sheet.frameWidth));
  const left = (frame % columns) * sheet.frameWidth;
  const top = Math.floor(frame / columns) * sheet.frameHeight;
  const [fu0, fv0, fu1, fv1] = show;
  return {
    u0: (left + fu0 * sheet.frameWidth) / image.w + 0.5 / image.w,
    v0: 1 - (top + (1 - fv0) * sheet.frameHeight) / image.h + 0.5 / image.h,
    u1: (left + fu1 * sheet.frameWidth) / image.w - 0.5 / image.w,
    v1: 1 - (top + (1 - fv1) * sheet.frameHeight) / image.h - 0.5 / image.h,
  };
}

/** The normals a band's art faces: both long faces of the piece. */
function bandNormals(piece: WallPiece): Vec3[] {
  return alongX(piece)
    ? [
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
      ]
    : [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
      ];
}

/** A run's quad on a piece's vertical face with `normal`: the run clipped to the piece along its length and the piece's heights. */
function standing(
  span: Span,
  piece: WallPiece,
  normal: Vec3,
  lift = WALL_LIFT,
): Pick<WallQuad, 'normal' | 'corners'> & {
  readonly show: readonly [number, number, number, number];
} {
  const along = alongX(piece);
  const [r0, r1] = along ? [span.x0, span.x1] : [span.y0, span.y1];
  const [c0, c1] = overlap(span, piece);
  const plane = along
    ? normal.y > 0
      ? piece.y1 + lift
      : piece.y0 - lift
    : normal.x > 0
      ? piece.x1 + lift
      : piece.x0 - lift;
  // The viewer's right along the axis: (n.y, -n.x) in the plan.
  const right = along ? normal.y : -normal.x;
  const [left, rightEnd] = right > 0 ? [c0, c1] : [c1, c0];
  const at = (s: number, z: number): Vec3 =>
    along ? { x: s, y: plane, z } : { x: plane, y: s, z };
  const length = r1 - r0;
  const fu =
    right > 0 ? [(c0 - r0) / length, (c1 - r0) / length] : [(r1 - c1) / length, (r1 - c0) / length];
  return {
    normal,
    corners: [
      at(left, piece.z0),
      at(rightEnd, piece.z0),
      at(rightEnd, piece.z1),
      at(left, piece.z1),
    ],
    show: [fu[0] ?? 0, piece.z0 / piece.height, fu[1] ?? 1, piece.z1 / piece.height],
  };
}

/** A cap's quad on the top of `piece`: the run clipped to the piece's footprint, lying `WALL_LIFT` above its height. */
function topQuad(
  sheet: Sheet,
  frame: number,
  image: { readonly w: number; readonly h: number },
  span: Span,
  piece: WallPiece,
): WallQuad {
  const [x0, x1] = [Math.max(span.x0, piece.x0), Math.min(span.x1, piece.x1)];
  const [y0, y1] = [Math.max(span.y0, piece.y0), Math.min(span.y1, piece.y1)];
  const [w, h] = [span.x1 - span.x0, span.y1 - span.y0];
  const z = piece.height + WALL_LIFT;
  return {
    frame,
    normal: { x: 0, y: 0, z: 1 },
    corners: [
      { x: x0, y: y1, z },
      { x: x1, y: y1, z },
      { x: x1, y: y0, z },
      { x: x0, y: y0, z },
    ],
    ...frameUv(sheet, frame, image, [
      (x0 - span.x0) / w,
      (span.y1 - y1) / h,
      (x1 - span.x0) / w,
      (span.y1 - y0) / h,
    ]),
  };
}

/** The room's papered masses (the lounge's hallway block): solid furniture drawn as the house beyond, which stand as walls. */
export function paperedMasses(room: Room): Box[] {
  return room.furniture.flatMap((f, index) =>
    isPapered(f) ? [furnitureBox(f, index, room.key)] : [],
  );
}

/**
 * The quads of `sheet` on a papered `mass`, which dresses as the room's walls
 * do: the back wall's face tiles on its south and west faces, the faces a
 * player sees, the whole of its height; the room's cap runs that lie on its
 * footprint on its top. Each frame's rect is inset as `wallLayout`'s.
 */
export function massLayout(
  room: Room,
  mass: Box,
  sheet: Sheet,
  imageWidth: number,
  imageHeight: number,
): WallQuad[] {
  const { face, wallRow, wallColumn } = ROOM_STYLES[room.key];
  const image = { w: imageWidth, h: imageHeight };
  const quads: WallQuad[] = [];
  if (face?.sheet.key === sheet.key) {
    const south: WallPiece = { ...mass, side: 'S', height: mass.z1 };
    const west: WallPiece = { ...mass, side: 'W', height: mass.z1 };
    const lay = (piece: WallPiece, normal: Vec3, from: number, to: number): void => {
      for (const run of tileRuns(sheet, { x: from, y: 0, w: to - from, h: face.height })) {
        const [a0, a1] = [metres(run.x), metres(run.x + run.w)];
        const span = alongX(piece)
          ? { x0: a0, x1: a1, y0: piece.y0, y1: piece.y1 }
          : { x0: piece.x0, x1: piece.x1, y0: a0, y1: a1 };
        const { show, ...placed } = standing(span, piece, normal);
        quads.push({
          frame: run.frame ?? 0,
          ...placed,
          ...frameUv(sheet, run.frame ?? 0, image, show),
        });
      }
    };
    lay(south, { x: 0, y: 1, z: 0 }, pixels(mass.x0), pixels(mass.x1));
    lay(west, { x: -1, y: 0, z: 0 }, pixels(mass.y0), pixels(mass.y1));
  }
  if (sheet.key === wallRow.key || sheet.key === wallColumn.key) {
    const top: WallPiece = { ...mass, side: 'N', height: mass.z1 };
    for (const run of furnitureRuns(room)) {
      const span: Span = {
        x0: metres(run.x),
        x1: metres(run.x + run.w),
        y0: metres(run.y),
        y1: metres(run.y + run.h),
      };
      const within =
        span.x0 >= mass.x0 - EPSILON &&
        span.x1 <= mass.x1 + EPSILON &&
        span.y0 >= mass.y0 - EPSILON &&
        span.y1 <= mass.y1 + EPSILON;
      if (run.sheet.key === sheet.key && within) {
        quads.push(topQuad(sheet, run.frame ?? 0, image, span, top));
      }
    }
  }
  return quads;
}

/**
 * The quads of every run of `sheet` on the room's wall pieces, for an image of
 * `imageWidth` x `imageHeight` px, grouped by piece. A run is laid on the
 * pieces of the first wall that claims it, so a corner tile the north and west
 * walls share is drawn once; each piece shows the part of the run it covers,
 * and its height as that fraction of the frame. Every rect is inset half a
 * texel so a nearest sample never reads the neighbouring frame.
 */
export function wallLayout(
  room: Room,
  pieces: readonly WallPiece[],
  sheet: Sheet,
  imageWidth: number,
  imageHeight: number,
): PieceQuads[] {
  const style = ROOM_STYLES[room.key];
  const image = { w: imageWidth, h: imageHeight };
  const byPiece = new Map<string, WallQuad[]>();
  for (const run of artRuns(room).filter((r) => r.sheet.key === sheet.key)) {
    const frame = run.frame ?? 0;
    const span: Span = {
      x0: metres(run.x),
      x1: metres(run.x + run.w),
      y0: metres(run.y),
      y1: metres(run.y + run.h),
    };
    const kind: Kind = !style.face
      ? 'band'
      : run.sheet.key === style.face.sheet.key
        ? 'face'
        : 'cap';
    const claimed = pieces.filter((piece) => onRing(room, piece) && claims(kind, span, piece));
    const first = claimed[0];
    if (!first) continue;
    for (const piece of claimed.filter((p) => wallOf(p.name) === wallOf(first.name))) {
      const quads: WallQuad[] = [];
      if (kind === 'cap') {
        if (Math.abs(piece.z1 - piece.height) > EPSILON) continue;
        quads.push(topQuad(sheet, frame, image, span, piece));
      } else {
        const normals = kind === 'face' ? [{ x: 0, y: 1, z: 0 }] : bandNormals(piece);
        for (const normal of normals) {
          const { show, ...placed } = standing(span, piece, normal);
          quads.push({ frame, ...placed, ...frameUv(sheet, frame, image, show) });
        }
      }
      byPiece.set(piece.name, [...(byPiece.get(piece.name) ?? []), ...quads]);
    }
  }
  return [...byPiece].map(([piece, quads]) => ({ piece, quads }));
}

/** The normal of the face of a wall piece that looks into the room, `bandNormals`' two for a wall against no edge. */
function inwardNormals(piece: WallPiece): Vec3[] {
  const inward: Record<string, Vec3> = {
    N: { x: 0, y: 1, z: 0 },
    S: { x: 0, y: -1, z: 0 },
    W: { x: 1, y: 0, z: 0 },
    E: { x: -1, y: 0, z: 0 },
  };
  const one = inward[piece.side];
  return one ? [one] : bandNormals(piece);
}

/**
 * A painted surface laid whole on a piece's vertical face with `normal`, its
 * UVs in metres from the plan's origin along the face, as the viewer reads it
 * left to right (u), and from the floor up (v), over `repeat` metres a
 * texture, so pieces side by side, and a window's sill and lintel, carry one
 * unbroken surface. Frame 0: a painted quad has no sheet.
 */
function paintedQuad(
  piece: WallPiece,
  normal: Vec3,
  repeat: { readonly u: number; readonly v: number },
  lift = WALL_LIFT,
): WallQuad {
  const placed = standing(
    { x0: piece.x0, x1: piece.x1, y0: piece.y0, y1: piece.y1 },
    piece,
    normal,
    lift,
  );
  const [left, right, , top] = placed.corners;
  const along = alongX(piece);
  const sign = (along ? normal.y : -normal.x) > 0 ? 1 : -1;
  const at = (c: Vec3): number => (sign * (along ? c.x : c.y)) / repeat.u;
  return {
    frame: 0,
    normal,
    corners: placed.corners,
    u0: at(left),
    v0: left.z / repeat.v,
    u1: at(right),
    v1: top.z / repeat.v,
  };
}

/** The quads of a painted surface on the faces of `pieces` that look into the room, grouped by piece. */
export function paintedFaces(
  pieces: readonly WallPiece[],
  repeat: { readonly u: number; readonly v: number },
): PieceQuads[] {
  return pieces.map((piece) => ({
    piece: piece.name,
    quads: inwardNormals(piece).map((normal) => paintedQuad(piece, normal, repeat)),
  }));
}

/** The quads of a painted surface on a papered `mass`'s south and west faces, the ones a player sees (`massLayout`'s), `MASS_LIFT` off it. */
export function paintedMassFaces(
  mass: Box,
  repeat: { readonly u: number; readonly v: number },
): WallQuad[] {
  return [
    paintedQuad({ ...mass, side: 'S', height: mass.z1 }, { x: 0, y: 1, z: 0 }, repeat, MASS_LIFT),
    paintedQuad({ ...mass, side: 'W', height: mass.z1 }, { x: -1, y: 0, z: 0 }, repeat, MASS_LIFT),
  ];
}

/**
 * The vertex arrays of one mesh holding every quad, wound to face its normal
 * in Babylon's left-handed frame, positioned relative to `origin` (the piece's
 * middle, in plan metres) so the mesh can ride its box's transform.
 */
export function wallMeshData(quads: readonly WallQuad[], origin: Vec3): QuadMeshData {
  const data: QuadMeshData = { positions: [], normals: [], uvs: [], indices: [] };
  quads.forEach((q, n) => {
    const uvs = [q.u0, q.v0, q.u1, q.v0, q.u1, q.v1, q.u0, q.v1];
    q.corners.forEach((c) => {
      const at = toBabylon({ x: c.x - origin.x, y: c.y - origin.y, z: c.z - origin.z });
      const normal = toBabylon(q.normal);
      data.positions.push(at.x, at.y, at.z);
      data.normals.push(normal.x, normal.y, normal.z);
    });
    data.uvs.push(...uvs);
    const first = n * 4;
    data.indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  });
  return data;
}
