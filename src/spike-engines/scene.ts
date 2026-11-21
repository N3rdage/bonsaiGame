/**
 * The engine comparison's scene as plain data (backlog #378): the front
 * garden and house from the front garden spike (`site.ts`), the side passage
 * through the open gate, a strip of back garden and the shed, whose south
 * door the player walks through, at plan B3's real positions
 * (docs/site-plan/README.md). Every engine page renders exactly this; none
 * adds geometry of its own, so the pages differ only in how they draw it.
 *
 * Frame: site metres, x east, y south, z up from the lawn, the house's
 * north-west corner at 0, 0 (as `site.ts`). `meshData.ts` turns boxes into
 * triangles in the render frame (`toRender`), which is Y-up.
 *
 * Deliberately left out: the greenhouse, the lounge behind the shed's north
 * door (drawn shut), the house's back face detail and the garage's interior.
 */

import { CAST_SHADOW } from '../world/lighting';
import { MOVE_SPEED, STEPS_PER_SECOND } from '../world/player';
import { SHEETS, type Sheet } from '../world/assets';
import { ROOM_PX_PER_METRE, SITE, siteBlocks, type Block, type Wash } from './site';

/** A point or direction in site metres: x east, y south, z up. */
export interface SiteVec {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** An axis-aligned rectangle on the ground, site metres. */
export interface Rect2 {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

/** An axis-aligned box, site metres. */
export interface Aabb3 extends Rect2 {
  readonly z0: number;
  readonly z1: number;
}

/**
 * The surfaces, each named for what it is. A textured one repeats frame 0 of
 * an Inked sheet from public/assets/ every `tile` metres (u along the face,
 * v up a wall or north along a floor); an untextured one is its wash as it
 * lands on paper (ink.ts `onPaper(WASH_RGB[wash])`).
 */
export type MaterialKey =
  | 'lawn'
  | 'drive'
  | 'paving'
  | 'road'
  | 'houseWall'
  | 'roof'
  | 'shedFloor'
  | 'shedWall'
  | 'shedOuter'
  | 'shedRoof'
  | Exclude<Wash, 'outside' | 'asphalt' | 'render' | 'tile'>;

export interface MaterialSpec {
  /** The sheet whose frame 0 tiles the surface; absent for a flat wash. */
  readonly sheet?: Sheet;
  /** Metres one tile covers, along u and v. */
  readonly tile: { readonly u: number; readonly v: number };
  /** The wash the surface is in: its colour when untextured. */
  readonly wash: Wash;
}

/** A 16 logical px floor tile is half a metre (the scale rule); a wall's 16 x 48 face tile is half a metre by the 2.4 m wall. */
const FLOOR_TILE = { u: 0.5, v: 0.5 } as const;
const FACE_TILE = { u: 0.5, v: 2.4 } as const;
const PLAIN = { u: 1, v: 1 } as const;

export const MATERIALS: Readonly<Record<MaterialKey, MaterialSpec>> = {
  lawn: { sheet: SHEETS.floorGarden, tile: FLOOR_TILE, wash: 'outside' },
  drive: { sheet: SHEETS.drive, tile: FLOOR_TILE, wash: 'stone' },
  paving: { sheet: SHEETS.path, tile: FLOOR_TILE, wash: 'stone' },
  // A 32 x 96 slice of the 3 m road: 1 m along it, the road's width across.
  road: { sheet: SHEETS.road, tile: { u: 1, v: 3 }, wash: 'asphalt' },
  houseWall: { sheet: SHEETS.houseFace, tile: FACE_TILE, wash: 'render' },
  roof: { sheet: SHEETS.houseRoof, tile: FLOOR_TILE, wash: 'tile' },
  shedFloor: { sheet: SHEETS.floorShed, tile: FLOOR_TILE, wash: 'wood' },
  shedWall: { sheet: SHEETS.shedWall, tile: FACE_TILE, wash: 'wood' },
  shedOuter: { sheet: SHEETS.shedFace, tile: FACE_TILE, wash: 'wood' },
  shedRoof: { sheet: SHEETS.shedRoof, tile: FLOOR_TILE, wash: 'cap' },
  stone: { tile: PLAIN, wash: 'stone' },
  wood: { tile: PLAIN, wash: 'wood' },
  paint: { tile: PLAIN, wash: 'paint' },
  glass: { tile: PLAIN, wash: 'glass' },
  metal: { tile: PLAIN, wash: 'metal' },
  soil: { tile: PLAIN, wash: 'soil' },
  foliage: { tile: PLAIN, wash: 'foliage' },
  cap: { tile: PLAIN, wash: 'cap' },
};

/** The walls and roofs that fade when they stand between the camera and the player, each fading as one. */
export type OccluderKey =
  | 'house'
  | 'garage'
  | 'shedRoof'
  | 'shedNorth'
  | 'shedSouth'
  | 'shedEast'
  | 'shedWest'
  | 'fenceEast'
  | 'fenceSouth'
  | 'fenceWest';

export interface SceneBox extends Block {
  readonly material: MaterialKey;
  /** Lies on the ground: takes cast shadows and casts none (everything else casts and takes none). */
  readonly ground: boolean;
  /** The occluder the box fades with, if any. */
  readonly occluder?: OccluderKey;
  /** Stops the player: its footprint is a collider. */
  readonly solid: boolean;
}

export type RoomKey = 'garden' | 'shed';

/** A doorway: a gap in a wall the player walks through from one room to the other. */
export interface Doorway {
  readonly name: string;
  readonly gap: Rect2;
  readonly between: readonly [RoomKey, RoomKey];
}

export type SpawnKey = 'frontDoor' | 'shedDoor' | 'shed';

export interface SpikeScene {
  readonly boxes: readonly SceneBox[];
  readonly materials: Readonly<Record<MaterialKey, MaterialSpec>>;
  /** Every box that stops the player, plus the site's invisible edges, as ground footprints. */
  readonly colliders: readonly Rect2[];
  /** Each occluder's bounds, the union of its boxes (a tilted roof slab by its corners). */
  readonly occluders: Readonly<Partial<Record<OccluderKey, Aabb3>>>;
  /** Where each room is; anywhere outside the shed is the garden. */
  readonly shed: Rect2;
  readonly doorways: readonly Doorway[];
  /** The pedestal the tree stands on: its top centre. */
  readonly pedestal: SiteVec;
  readonly spawns: Readonly<Record<SpawnKey, { readonly x: number; readonly y: number }>>;
  /** Unit vector toward the one light (the sun), site frame. */
  readonly light: SiteVec;
}

/**
 * Toward the rooms' one light (src/world/lighting.ts) laid on the ground with
 * north up the screen, as every room is drawn: a post 1 m tall throws its
 * shadow `CAST_SHADOW.length` m down and to the right, south-east. Fixed in
 * the world, so it no longer turns with the camera as the rooms' does.
 */
export function sunDirection(): SiteVec {
  const [dx, dy] = CAST_SHADOW.direction;
  const sx = CAST_SHADOW.length * dx;
  const sy = CAST_SHADOW.length * dy;
  const len = Math.hypot(sx, sy, 1);
  return { x: -sx / len, y: -sy / len, z: 1 / len };
}

/** The game's walking speed in metres a second: MOVE_SPEED logical px a step at 32 px a metre. */
export const WALK_SPEED = (MOVE_SPEED * STEPS_PER_SECOND) / ROOM_PX_PER_METRE;
/** The player's footprint radius, metres. */
export const PLAYER_RADIUS = 0.25;
/** The player's height, metres: the 2D sheet's 1.7 m gardener in a 2 m frame. */
export const PLAYER_HEIGHT = 2;

/** Plan B3's shed and the back garden around it, metres; heights are the spike's. */
export const SHED = {
  x0: 0,
  x1: 5,
  y0: 4.5,
  y1: 8,
  height: 2.4,
  wall: 0.12,
  door: { x: 2.5, width: 0.8, height: 2.0 },
} as const;
const BACK = {
  passage: { x0: 13, x1: 14.5, y0: 0, y1: 4.5 },
  notch: { x0: 5, x1: 14.5, y0: 4.5, y1: 8 },
  lawn: { x0: 0, x1: 14.5, y0: 8, y1: 16 },
  fence: 1.8,
} as const;

/** Tags the front garden spike's blocks: the house's and garage's parts fade with them; the side gate is left open. */
function frontBlocks(): SceneBox[] {
  const HOUSE = new Set(['house', 'roof north', 'roof south', 'front door', 'window']);
  const GARAGE = new Set(['garage', 'garage roof', 'roller door']);
  const BY_NAME: Partial<Record<string, MaterialKey>> = {
    lawn: 'lawn',
    drive: 'drive',
    path: 'paving',
    kerb: 'paving',
    doorstep: 'paving',
    road: 'road',
    house: 'houseWall',
    garage: 'houseWall',
    'roof north': 'roof',
    'roof south': 'roof',
    'garage roof': 'roof',
  };
  return siteBlocks()
    .filter((b) => b.name !== 'side gate')
    .map((b) => {
      const material: MaterialKey = BY_NAME[b.name] ?? (b.wash as MaterialKey);
      const occluder: OccluderKey | undefined = HOUSE.has(b.name)
        ? 'house'
        : GARAGE.has(b.name)
          ? 'garage'
          : undefined;
      return tag(b, material, occluder);
    });
}

/** Whether a block stands where a walker would walk into it: off the ground, below head height. */
function blocksWalker(b: Block): boolean {
  return b.z1 > 0.3 && b.z0 < 1.5;
}

function tag(b: Block, material: MaterialKey, occluder?: OccluderKey): SceneBox {
  const ground = b.z1 <= 0.1;
  const box: SceneBox = { ...b, material, ground, solid: !ground && blocksWalker(b) };
  return occluder ? { ...box, occluder } : box;
}

const block = (
  name: string,
  material: MaterialKey,
  [x0, x1]: readonly [number, number],
  [y0, y1]: readonly [number, number],
  [z0, z1]: readonly [number, number],
  occluder?: OccluderKey,
): SceneBox =>
  tag({ name, wash: MATERIALS[material].wash, x0, x1, y0, y1, z0, z1 }, material, occluder);

/** The passage, the notch behind the study and the back lawn, with their board fences. */
function backGarden(): SceneBox[] {
  const ground: [number, number] = [-0.2, 0];
  const { passage, notch, lawn, fence } = BACK;
  const t = 0.1;
  return [
    // The meadow the stress test's trees and hedges stand on, a little under the lawns.
    block('meadow', 'lawn', [-90, 100], [-90, 100], [-0.4, -0.2]),
    block('lawn', 'lawn', [passage.x0, passage.x1], [passage.y0, passage.y1], ground),
    block('lawn', 'lawn', [notch.x0, notch.x1], [notch.y0, notch.y1], ground),
    block('lawn', 'lawn', [lawn.x0, lawn.x1], [lawn.y0, lawn.y1], ground),
    block('east fence', 'wood', [lawn.x1 - t, lawn.x1], [0, lawn.y1], [0, fence], 'fenceEast'),
    block(
      'south fence',
      'wood',
      [lawn.x0, lawn.x1],
      [lawn.y1 - t, lawn.y1],
      [0, fence],
      'fenceSouth',
    ),
    block(
      'west fence',
      'wood',
      [lawn.x0 - t, lawn.x0],
      [lawn.y0, lawn.y1],
      [0, fence],
      'fenceWest',
    ),
  ];
}

/**
 * The shed: board walls inside its footprint, Inked boards outside and its
 * own wall face inside where the outside shows (south and east; the house and
 * garage hide the north and west), the south door as a 0.8 m gap, a flat
 * roof, the floorboards, a workbench, a planting table, a shelf and the
 * pedestal.
 */
function shed(): SceneBox[] {
  const { x0, x1, y0, y1, height: h, wall: w, door } = SHED;
  const lining = 0.02;
  const d0 = door.x - door.width / 2;
  const d1 = door.x + door.width / 2;
  const full: [number, number] = [0, h];
  return [
    block('shed floor', 'shedFloor', [x0, x1], [y0, y1], [-0.2, 0.03]),
    block('shed wall', 'shedWall', [x0, x1], [y0, y0 + w], full, 'shedNorth'),
    block('shed wall', 'shedWall', [x0, x0 + w], [y0, y1], full, 'shedWest'),
    block('shed wall', 'shedOuter', [x1 - w, x1], [y0, y1], full, 'shedEast'),
    block('shed lining', 'shedWall', [x1 - w - lining, x1 - w], [y0 + w, y1 - w], full, 'shedEast'),
    block('shed wall', 'shedOuter', [x0, d0], [y1 - w, y1], full, 'shedSouth'),
    block('shed wall', 'shedOuter', [d1, x1], [y1 - w, y1], full, 'shedSouth'),
    block('shed lintel', 'shedOuter', [d0, d1], [y1 - w, y1], [door.height, h], 'shedSouth'),
    block('shed lining', 'shedWall', [x0 + w, d0], [y1 - w - lining, y1 - w], full, 'shedSouth'),
    block('shed lining', 'shedWall', [d1, x1 - w], [y1 - w - lining, y1 - w], full, 'shedSouth'),
    block('lounge door', 'wood', [2.1, 2.9], [y0 + w, y0 + w + 0.03], [0, 2], 'shedNorth'),
    // From just past the house's south overhang (site.ts's 0.3 m) to 0.2 m over the south wall.
    block(
      'shed roof',
      'shedRoof',
      [x0 - 0.1, x1 + 0.2],
      [y0 + 0.3, y1 + 0.2],
      [h, h + 0.15],
      'shedRoof',
    ),
    block('workbench', 'wood', [0.3, 1.9], [y0 + w, y0 + w + 0.6], [0, 0.9]),
    block('planting table', 'wood', [3.2, 4.6], [y0 + w, y0 + w + 0.6], [0, 0.85]),
    block('shelf', 'wood', [x0 + w, x0 + w + 0.35], [5.9, 7.4], [0, 1.6]),
    block('pedestal', 'stone', [3.4, 3.8], [6.1, 6.5], [0, 0.6]),
  ];
}

/** The site's invisible edges: the road (drawn, not walked), and past the outer fences. */
const EDGES: readonly Rect2[] = [
  { x0: SITE.garden.x0, x1: SITE.garden.x1, y0: SITE.road.y0, y1: SITE.road.y1 },
  { x0: SITE.garden.x0 - 2, x1: SITE.garden.x0, y0: SITE.road.y0, y1: BACK.lawn.y1 + 2 },
  { x0: SITE.garden.x1, x1: SITE.garden.x1 + 2, y0: SITE.road.y0, y1: BACK.lawn.y1 + 2 },
  { x0: SITE.garden.x0, x1: SITE.garden.x1, y0: BACK.lawn.y1, y1: BACK.lawn.y1 + 2 },
];

/** A block's eight corners, with a tilted slab turned about its centre's x axis as `meshData.ts` turns it. */
export function blockCorners(b: Block): SiteVec[] {
  const cy = (b.y0 + b.y1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  // A positive tilt raises the south (+y) end.
  const t = b.tilt ?? 0;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const out: SiteVec[] = [];
  for (const x of [b.x0, b.x1]) {
    for (const y of [b.y0, b.y1]) {
      for (const z of [b.z0, b.z1]) {
        const dy = y - cy;
        const dz = z - cz;
        out.push({ x, y: cy + dy * c - dz * s, z: cz + dy * s + dz * c });
      }
    }
  }
  return out;
}

/** The smallest box around `boxes`' corners. */
export function boundsOf(boxes: readonly Block[]): Aabb3 {
  const corners = boxes.flatMap(blockCorners);
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const zs = corners.map((p) => p.z);
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
    z0: Math.min(...zs),
    z1: Math.max(...zs),
  };
}

/** The whole scene, built fresh (it is small). */
export function buildScene(): SpikeScene {
  const boxes = [...frontBlocks(), ...backGarden(), ...shed()];
  const occluders: Partial<Record<OccluderKey, Aabb3>> = {};
  for (const key of new Set(boxes.flatMap((b) => (b.occluder ? [b.occluder] : [])))) {
    occluders[key] = boundsOf(boxes.filter((b) => b.occluder === key));
  }
  const colliders: Rect2[] = [
    ...boxes.filter((b) => b.solid).map(({ x0, x1, y0, y1 }) => ({ x0, x1, y0, y1 })),
    ...EDGES,
  ];
  const pedestal = boxes.find((b) => b.name === 'pedestal');
  if (!pedestal) throw new Error('the shed has no pedestal');
  const { x0, x1, y1, door } = SHED;
  return {
    boxes,
    materials: MATERIALS,
    colliders,
    occluders,
    shed: { x0: SHED.x0, x1: SHED.x1, y0: SHED.y0, y1: SHED.y1 },
    doorways: [
      {
        name: 'shed door',
        gap: { x0: door.x - door.width / 2, x1: door.x + door.width / 2, y0: y1 - SHED.wall, y1 },
        between: ['shed', 'garden'],
      },
      {
        name: 'side gate',
        gap: {
          x0: SITE.gate.x - SITE.gate.width / 2,
          x1: SITE.gate.x + SITE.gate.width / 2,
          y0: -0.1,
          y1: 0,
        },
        between: ['garden', 'garden'],
      },
    ],
    pedestal: {
      x: (pedestal.x0 + pedestal.x1) / 2,
      y: (pedestal.y0 + pedestal.y1) / 2,
      z: pedestal.z1,
    },
    spawns: {
      // The front door's landing at the top of the path, as the front garden spike starts.
      frontDoor: { x: SITE.frontDoor.x, y: -0.8 },
      // On the back lawn, a metre and a half south of the shed's door.
      shedDoor: { x: door.x, y: y1 + 1.5 },
      shed: { x: (x0 + x1) / 2, y: 7 },
    },
    light: sunDirection(),
  };
}

/** Which room a ground point is in. */
export function roomAt(scene: SpikeScene, p: { readonly x: number; readonly y: number }): RoomKey {
  const { x0, x1, y0, y1 } = scene.shed;
  return p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1 ? 'shed' : 'garden';
}

/**
 * A site point in the render frame both engines use: x east, y up, z south.
 * That is three.js's right-handed Y-up frame; Babylon.js must set
 * `scene.useRightHandedSystem = true` to read it the same way.
 */
export function toRender(p: SiteVec): SiteVec {
  return { x: p.x, y: p.z, z: p.y };
}
