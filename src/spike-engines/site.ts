/**
 * The front garden as pure data, shared by the 3D spikes (backlog #359's
 * front garden page, and #378's engine comparison, which builds on it in
 * `scene.ts`): plan B3's front garden, the house's front and the garage
 * beside it, in metres (docs/site-plan/README.md). Site x runs east and y
 * south, with the house's north-west corner at 0, 0; `z` is height above the
 * lawn. Every block is an axis-aligned box, or a roof slab tilted about the x
 * axis, and the renderers only scale and colour them.
 *
 * The world's room data stays the collision: room px map to metres by the
 * front garden's own rule (frontGardenRoom.ts: 32 px a metre, room x 0 at
 * site x −3.5 m, room y 0 at site y −7 m, the road's north edge).
 */

/** Logical px per metre in every room (frontGardenRoom.ts's METRE). */
export const ROOM_PX_PER_METRE = 32;
/** Site metres of room px 0, 0 in the front garden. */
const ROOM_ORIGIN = { x: -3.5, y: -7 } as const;

export function roomToSite(px: { x: number; y: number }): { x: number; y: number } {
  return {
    x: px.x / ROOM_PX_PER_METRE + ROOM_ORIGIN.x,
    y: px.y / ROOM_PX_PER_METRE + ROOM_ORIGIN.y,
  };
}

/** The Inked washes the blocks are drawn in (art/inked/style.mjs's WASHES, mirrored in palette.ts). */
export type Wash =
  | 'outside'
  | 'asphalt'
  | 'stone'
  | 'render'
  | 'tile'
  | 'wood'
  | 'paint'
  | 'glass'
  | 'metal'
  | 'soil'
  | 'foliage'
  | 'cap';

/** An axis-aligned box: x and y in site metres, z up from the lawn; a roof slab is tilted about its centre's x axis so it rises `tilt` radians toward the south. */
export interface Block {
  readonly name: string;
  readonly wash: Wash;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly z0: number;
  readonly z1: number;
  readonly tilt?: number;
}

/** Plan B3's dimensions the spike draws, metres; heights are the spike's, the plan has none. */
export const SITE = {
  garden: { x0: -3.5, x1: 14.5, y0: -4, y1: 0 },
  road: { y0: -7, y1: -4 },
  drive: { x0: -3.5, x1: 0 },
  path: { x0: 6.6, x1: 7.4 },
  house: { x0: 0, x1: 13, y0: 0, y1: 4.5, eaves: 2.4, pitchDeg: 35, overhang: 0.3 },
  garage: { x0: -3.5, x1: 0, y0: 0, y1: 8, height: 2.6 },
  frontDoor: { x: 7, width: 0.9, height: 2.1 },
  rollerDoor: { x: -1.75, width: 2.4, height: 2.1 },
  /** The lounge's two windows and the study's two, centred where the 2D face draws them (room x 168, 232, 424, 488). */
  windows: { xs: [1.75, 3.75, 9.75, 11.75], width: 1.2, height: 1.2, sill: 0.9 },
  /** The beds along the low fence's inside, x 0.5..6 and 8..13.5 (room x 128..304 and 368..544), 0.5 m deep. */
  beds: { xs: [[0.5, 6] as const, [8, 13.5] as const], y0: -3.5, y1: -3 },
  lowFence: { height: 0.9, post: 0.1 },
  passageFence: { x0: 13, x1: 14.5, height: 1.8 },
  gate: { x: 13.5, width: 0.8 },
} as const;

const box = (
  name: string,
  wash: Wash,
  [x0, x1]: readonly [number, number],
  [y0, y1]: readonly [number, number],
  [z0, z1]: readonly [number, number],
): Block => ({ name, wash, x0, x1, y0, y1, z0, z1 });

/** The house's ridge height above the lawn: the eaves plus half the depth at the roof's pitch. */
export function ridgeHeight(): number {
  const { y0, y1, eaves, pitchDeg } = SITE.house;
  return eaves + ((y1 - y0) / 2) * Math.tan((pitchDeg * Math.PI) / 180);
}

/**
 * The house's two roof slabs, 0.15 m thick, each from the ridge over its eave
 * by the overhang, tilted to the pitch. The gable ends stay open: neither
 * camera angle looks along the ridge.
 */
function houseRoof(): Block[] {
  const { x0, x1, y0, y1, pitchDeg, overhang } = SITE.house;
  const pitch = (pitchDeg * Math.PI) / 180;
  const half = (y1 - y0) / 2;
  const ridgeY = y0 + half;
  const ridge = ridgeHeight();
  const slope = (half + overhang) / Math.cos(pitch);
  const thick = 0.15;
  const slab = (name: string, side: -1 | 1): Block => {
    // Half way down the slope from the ridge, lifted so its underside runs from the ridge over the wall's top.
    const cy = ridgeY + side * (slope / 2) * Math.cos(pitch);
    const cz = ridge - (slope / 2) * Math.sin(pitch) + thick / 2 / Math.cos(pitch);
    const y: [number, number] = [cy - slope / 2, cy + slope / 2];
    const z: [number, number] = [cz - thick / 2, cz + thick / 2];
    return { ...box(name, 'tile', [x0 - overhang, x1 + overhang], y, z), tilt: -side * pitch };
  };
  return [slab('roof north', -1), slab('roof south', 1)];
}

/** The low front fence along the kerb, with its gaps at the drive and the path, and the west and east side fences. */
function fences(): Block[] {
  const { garden, drive, lowFence } = SITE;
  const { height, post } = lowFence;
  const runs: [number, number][] = [
    [drive.x1, 6.5],
    [7.5, garden.x1],
  ];
  const y: [number, number] = [garden.y0, garden.y0 + post];
  const out: Block[] = [];
  for (const [a, b] of runs) {
    out.push(box('fence rail', 'wood', [a, b], y, [height * 0.6, height * 0.7]));
    out.push(box('fence rail', 'wood', [a, b], y, [height * 0.25, height * 0.35]));
    for (let x = a; x <= b - post + 1e-9; x += 1) {
      out.push(box('fence post', 'wood', [x, x + post], y, [0, height]));
    }
    out.push(box('fence post', 'wood', [b - post, b], y, [0, height]));
  }
  out.push(
    box('west fence', 'wood', [garden.x0, garden.x0 + post], [garden.y0, garden.y1], [0, height]),
  );
  out.push(
    box('east fence', 'wood', [garden.x1 - post, garden.x1], [garden.y0, garden.y1], [0, height]),
  );
  return out;
}

/** The passage's fence between the house and the east fence, with the side gate in it. */
function passage(): Block[] {
  const { passageFence: f, gate } = SITE;
  const y: [number, number] = [-0.1, 0];
  const g0 = gate.x - gate.width / 2;
  const g1 = gate.x + gate.width / 2;
  return [
    box('passage fence', 'wood', [f.x0, g0], y, [0, f.height]),
    box('side gate', 'paint', [g0, g1], [-0.06, -0.02], [0, f.height - 0.2]),
    box('passage fence', 'wood', [g1, f.x1], y, [0, f.height]),
  ];
}

/** A few shrubs along each bed, 0.4 m cubes of foliage, one every 1.5 m. */
function beds(): Block[] {
  const { xs, y0, y1 } = SITE.beds;
  const out: Block[] = [];
  for (const [a, b] of xs) {
    out.push(box('bed', 'soil', [a, b], [y0, y1], [0, 0.06]));
    for (let x = a + 0.3; x + 0.4 <= b; x += 1.5) {
      out.push(box('shrub', 'foliage', [x, x + 0.4], [y0 + 0.05, y0 + 0.45], [0.06, 0.46]));
    }
  }
  return out;
}

/** How high the cutaway angle leaves the buildings standing, metres. */
export const CUT_HEIGHT = 1;

/** The blocks that are the buildings, which the cutaway cuts down. */
const BUILDING = new Set([
  'house',
  'roof north',
  'roof south',
  'front door',
  'window',
  'garage',
  'garage roof',
  'roller door',
]);

/** `blocks` with every building part above `CUT_HEIGHT` gone and the rest cut off at it. */
export function cutaway(blocks: readonly Block[]): Block[] {
  return blocks
    .filter((b) => !BUILDING.has(b.name) || b.z0 < CUT_HEIGHT)
    .map((b) => (BUILDING.has(b.name) ? { ...b, z1: Math.min(b.z1, CUT_HEIGHT) } : b));
}

/** Everything the spike draws, ground first. */
export function siteBlocks(): Block[] {
  const { garden, road, drive, path, house, garage, frontDoor, rollerDoor, windows } = SITE;
  const ground: [number, number] = [-0.2, 0];
  const paved: [number, number] = [-0.2, 0.02];
  const span = (c: number, w: number): [number, number] => [c - w / 2, c + w / 2];
  const face: [number, number] = [-0.05, 0];
  return [
    box('road', 'asphalt', [garden.x0, garden.x1], [road.y0, road.y1], [-0.3, -0.12]),
    box('kerb', 'stone', [garden.x0, garden.x1], [road.y1 - 0.15, road.y1], [-0.3, 0.02]),
    box('lawn', 'outside', [garden.x0, garden.x1], [garden.y0, garden.y1], ground),
    box('drive', 'stone', [drive.x0, drive.x1], [garden.y0, garden.y1], paved),
    box('path', 'stone', [path.x0, path.x1], [garden.y0, garden.y1], paved),
    ...beds(),
    ...fences(),
    box('house', 'render', [house.x0, house.x1], [house.y0, house.y1], [0, house.eaves]),
    ...houseRoof(),
    box('front door', 'wood', span(frontDoor.x, frontDoor.width), face, [0, frontDoor.height]),
    box('doorstep', 'stone', span(frontDoor.x, 1.2), [-0.4, 0], [0, 0.12]),
    ...windows.xs.map((x) =>
      box('window', 'glass', span(x, windows.width), face, [
        windows.sill,
        windows.sill + windows.height,
      ]),
    ),
    box('garage', 'render', [garage.x0, garage.x1], [garage.y0, garage.y1], [0, garage.height]),
    box(
      'garage roof',
      'cap',
      [garage.x0 - 0.1, garage.x1],
      [garage.y0 - 0.1, garage.y1],
      [garage.height, garage.height + 0.15],
    ),
    box('roller door', 'metal', span(rollerDoor.x, rollerDoor.width), face, [0, rollerDoor.height]),
    ...passage(),
  ];
}
