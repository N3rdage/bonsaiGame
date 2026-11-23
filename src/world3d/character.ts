/**
 * The player's body in the 3D world: a rounded gardener of ellipsoids, each
 * bound whole to one of seven joints, with an `idle` and a `walk` clip and the
 * rule that blends them by speed. Pure data and arithmetic, no Babylon, so the
 * skeleton, the clips and the blend are unit-tested; renderer.ts builds the
 * skinned mesh from `characterMesh` and sets each bone to `poseOf`'s result.
 *
 * Space: metres, y up, the character faces +z, its feet on y 0. A joint's
 * rotation is a quaternion (x, y, z, w) turning it about its own position.
 */

export const JOINT_NAMES = ['hips', 'spine', 'head', 'legL', 'legR', 'armL', 'armR'] as const;
export type JointName = (typeof JOINT_NAMES)[number];
export const CLIP_NAMES = ['idle', 'walk'] as const;
export type ClipName = (typeof CLIP_NAMES)[number];

type Vec3 = readonly [x: number, y: number, z: number];
type Quat = readonly [x: number, y: number, z: number, w: number];
type Rgb = readonly [r: number, g: number, b: number];

/** The model's drawn size against the numbers below, which were laid out for a 1.82 m figure. */
const SCALE = 0.95;

const scaled = (v: Vec3): Vec3 => [v[0] * SCALE, v[1] * SCALE, v[2] * SCALE];

interface JointSpec {
  /** The joint's place in the bind pose, in the model's space. */
  readonly at: Vec3;
  readonly parent: JointName | undefined;
}

const JOINTS: Readonly<Record<JointName, JointSpec>> = {
  hips: { at: scaled([0, 0.9, 0]), parent: undefined },
  spine: { at: scaled([0, 1, 0]), parent: 'hips' },
  head: { at: scaled([0, 1.5, 0]), parent: 'spine' },
  legL: { at: scaled([-0.1, 0.9, 0]), parent: 'hips' },
  legR: { at: scaled([0.1, 0.9, 0]), parent: 'hips' },
  armL: { at: scaled([-0.24, 1.4, 0]), parent: 'spine' },
  armR: { at: scaled([0.24, 1.4, 0]), parent: 'spine' },
};

/** A joint's place in the bind pose, in the model's space. */
export function jointAt(joint: JointName): Vec3 {
  return JOINTS[joint].at;
}

/** A joint's parent, undefined for the root. */
export function parentOf(joint: JointName): JointName | undefined {
  return JOINTS[joint].parent;
}

/** A joint's bind-pose translation from its parent (from the origin for the root). */
export function restOffset(joint: JointName): Vec3 {
  const { at, parent } = JOINTS[joint];
  const base = parent ? jointAt(parent) : ([0, 0, 0] as const);
  return [at[0] - base[0], at[1] - base[1], at[2] - base[2]];
}

const SKIN: Rgb = [0.87, 0.67, 0.53];
const SHIRT: Rgb = [0.35, 0.58, 0.45];
const TROUSERS: Rgb = [0.3, 0.36, 0.5];
const SHOE: Rgb = [0.25, 0.2, 0.18];

export interface Part {
  readonly joint: JointName;
  readonly center: Vec3;
  readonly radii: Vec3;
  /** Half the length of a straight middle along y: 0 is an ellipsoid, more a rounded bar. */
  readonly stretch: number;
  readonly color: Rgb;
}

export function part(joint: JointName, center: Vec3, radii: Vec3, color: Rgb, stretch = 0): Part {
  return { joint, center: scaled(center), radii: scaled(radii), stretch: stretch * SCALE, color };
}

/** The body: hips, chest, head and nose, a leg and a shoe each side, an arm and a hand each side. */
const PARTS: readonly Part[] = [
  part('hips', [0, 0.95, 0], [0.18, 0.13, 0.14], TROUSERS),
  part('spine', [0, 1.22, 0], [0.2, 0.16, 0.13], SHIRT, 0.08),
  part('head', [0, 1.67, 0], [0.14, 0.16, 0.15], SKIN),
  part('head', [0, 1.65, 0.15], [0.03, 0.03, 0.03], SKIN),
  part('legL', [-0.1, 0.45, 0], [0.075, 0.08, 0.075], TROUSERS, 0.3),
  part('legL', [-0.1, 0.05, 0.05], [0.08, 0.05, 0.13], SHOE),
  part('legR', [0.1, 0.45, 0], [0.075, 0.08, 0.075], TROUSERS, 0.3),
  part('legR', [0.1, 0.05, 0.05], [0.08, 0.05, 0.13], SHOE),
  part('armL', [-0.24, 1.14, 0], [0.055, 0.06, 0.055], SHIRT, 0.2),
  part('armL', [-0.24, 0.84, 0], [0.05, 0.05, 0.05], SKIN),
  part('armR', [0.24, 1.14, 0], [0.055, 0.06, 0.055], SHIRT, 0.2),
  part('armR', [0.24, 0.84, 0], [0.05, 0.05, 0.05], SKIN),
];

/** The figure's height, metres: the top of its head over feet on y 0. */
export const CHARACTER_HEIGHT = Math.max(...PARTS.map((p) => p.center[1] + p.radii[1] + p.stretch));

/** The body as one skinned mesh's arrays, every vertex weighted wholly to its part's joint. */
export interface CharacterMesh {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  /** RGBA per vertex. */
  readonly colors: Float32Array;
  /** The four joint indices (into `JOINT_NAMES`) per vertex; only the first counts. */
  readonly joints: Float32Array;
  /** The four joint weights per vertex: 1, 0, 0, 0. */
  readonly weights: Float32Array;
  readonly indices: Uint32Array;
}

/** The body's arrays: each part a smooth ellipsoid (a rounded bar with a stretch). */
export function characterMesh(
  parts: readonly Part[] = PARTS,
  RINGS = 8,
  SEGMENTS = 12,
): CharacterMesh {
  const per = (RINGS + 1) * (SEGMENTS + 1);
  const vertices = parts.length * per;
  const positions = new Float32Array(vertices * 3);
  const normals = new Float32Array(vertices * 3);
  const colors = new Float32Array(vertices * 4);
  const joints = new Float32Array(vertices * 4);
  const weights = new Float32Array(vertices * 4);
  const indices = new Uint32Array(parts.length * RINGS * SEGMENTS * 6);
  parts.forEach((p, n) => {
    const first = n * per;
    const [cx, cy, cz] = p.center;
    const [rx, ry, rz] = p.radii;
    for (let i = 0; i <= RINGS; i++) {
      const theta = (1 - i / RINGS) * Math.PI;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      for (let j = 0; j <= SEGMENTS; j++) {
        const phi = (j / SEGMENTS) * Math.PI * 2;
        const v = first + i * (SEGMENTS + 1) + j;
        const nx = (sinT * Math.cos(phi)) / rx;
        const ny = cosT / ry;
        const nz = (sinT * Math.sin(phi)) / rz;
        const length = Math.hypot(nx, ny, nz);
        positions.set(
          [
            cx + rx * sinT * Math.cos(phi),
            cy + ry * cosT + (cosT >= 0 ? p.stretch : -p.stretch),
            cz + rz * sinT * Math.sin(phi),
          ],
          v * 3,
        );
        normals.set([nx / length, ny / length, nz / length], v * 3);
        colors.set([...p.color, 1], v * 4);
        joints[v * 4] = JOINT_NAMES.indexOf(p.joint);
        weights[v * 4] = 1;
      }
    }
    let k = n * RINGS * SEGMENTS * 6;
    for (let i = 0; i < RINGS; i++) {
      for (let j = 0; j < SEGMENTS; j++) {
        const a = first + i * (SEGMENTS + 1) + j;
        const d = a + SEGMENTS + 1;
        indices.set([a, d, a + 1, a + 1, d, d + 1], k);
        k += 6;
      }
    }
  });
  return { positions, normals, colors, joints, weights, indices };
}

/** One joint's keyed motion in a clip: `values` has a key for each of `times`, rotations or, for the hips' bob, translations. */
interface Track {
  readonly joint: JointName;
  readonly path: 'rotation' | 'translation';
  readonly times: readonly number[];
  readonly values: readonly (readonly number[])[];
}

interface Clip {
  readonly duration: number;
  readonly tracks: readonly Track[];
}

/** A rotation of `angle` radians about an axis. */
function turn(axis: 'x' | 'y' | 'z', angle: number): Quat {
  const s = Math.sin(angle / 2);
  const c = Math.cos(angle / 2);
  return axis === 'x' ? [s, 0, 0, c] : axis === 'y' ? [0, s, 0, c] : [0, 0, s, c];
}

/** A looping swing about `axis` of `amplitude` radians each way over `period` seconds, `phase` quarter turns in. */
function swing(
  joint: JointName,
  axis: 'x' | 'y' | 'z',
  amplitude: number,
  period: number,
  phase: number,
): Track {
  const pattern = [0, 1, 0, -1];
  const keys = [0, 1, 2, 3, 4];
  return {
    joint,
    path: 'rotation',
    times: keys.map((k) => (k * period) / 4),
    values: keys.map((k) => turn(axis, amplitude * (pattern[(k + phase) % 4] ?? 0))),
  };
}

const IDLE_PERIOD = 3;
const WALK_PERIOD = 1;
const WALK_SWING = 0.65;
const HIPS_HEIGHT = JOINTS.hips.at[1];
const BOB = 0.03;

const CLIPS: Readonly<Record<ClipName, Clip>> = {
  idle: {
    duration: IDLE_PERIOD,
    tracks: [
      swing('spine', 'x', 0.025, IDLE_PERIOD, 0),
      swing('head', 'y', 0.12, IDLE_PERIOD, 1),
      swing('armL', 'z', 0.04, IDLE_PERIOD, 0),
      swing('armR', 'z', -0.04, IDLE_PERIOD, 0),
    ],
  },
  walk: {
    duration: WALK_PERIOD,
    tracks: [
      swing('legL', 'x', WALK_SWING, WALK_PERIOD, 1),
      swing('legR', 'x', -WALK_SWING, WALK_PERIOD, 1),
      swing('armL', 'x', -0.5, WALK_PERIOD, 1),
      swing('armR', 'x', 0.5, WALK_PERIOD, 1),
      swing('spine', 'y', 0.1, WALK_PERIOD, 1),
      {
        joint: 'hips',
        path: 'translation',
        times: [0, 1, 2, 3, 4].map((k) => (k * WALK_PERIOD) / 4),
        values: [0, BOB, 0, BOB, 0].map((bob) => [0, HIPS_HEIGHT - bob, 0]),
      },
    ],
  },
};

/** A clip's length in seconds; it loops. */
export function clipDuration(clip: ClipName): number {
  return CLIPS[clip].duration;
}

/** What each clip contributes to a pose, 0 to 1 and summing to 1. */
export type ClipWeights = Readonly<Record<ClipName, number>>;

/** The seconds a change between idle and walk takes. */
const FADE_SECONDS = 0.2;
/** The speed, metres a second, at which the walk clip is wholly in. */
export const WALK_FULL_SPEED = 1;
/** The speed, metres a second, at which the walk clip's feet do not slide: a half cycle carries a foot the length of its swing. */
export const STRIDE_SPEED = (4 * HIPS_HEIGHT * Math.sin(WALK_SWING)) / WALK_PERIOD;
/** The fastest and slowest the walk clip plays, as a multiple of its own speed. */
const RATE_MIN = 0.5;
const RATE_MAX = 2;

/** The weights a body moving at `speed` metres a second settles to: walk rises linearly to 1 at `WALK_FULL_SPEED`, idle takes the rest. */
export function targetWeights(speed: number): ClipWeights {
  const walk = Math.min(1, Math.max(0, speed / WALK_FULL_SPEED));
  return { idle: 1 - walk, walk };
}

/** `current` weights moved toward `targetWeights(speed)` over `dt` seconds, so a change cross-fades in `FADE_SECONDS`. */
export function fadeWeights(current: ClipWeights, speed: number, dt: number): ClipWeights {
  const target = targetWeights(speed).walk;
  const step = dt / FADE_SECONDS;
  const walk =
    current.walk < target
      ? Math.min(target, current.walk + step)
      : Math.max(target, current.walk - step);
  return { idle: 1 - walk, walk };
}

/** How fast the walk clip plays at `speed`, so the feet keep pace with the ground: 1 at `STRIDE_SPEED`. */
export function walkRate(speed: number): number {
  return Math.min(RATE_MAX, Math.max(RATE_MIN, speed / STRIDE_SPEED));
}

/** One joint's local transform: a rotation and a translation from its parent. */
export interface JointPose {
  readonly rotation: Quat;
  readonly translation: Vec3;
}

export type Pose = Readonly<Record<JointName, JointPose>>;

/** Where along `track` the clock `time` (seconds, looping over `duration`) falls, interpolated linearly between keys. */
function sample(track: Track, time: number, duration: number): readonly number[] {
  const t = ((time % duration) + duration) % duration;
  let k = 0;
  while (k + 2 < track.times.length && (track.times[k + 1] ?? Infinity) <= t) k++;
  const t0 = track.times[k] ?? 0;
  const t1 = track.times[k + 1] ?? t0;
  const f = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
  const a = track.values[k] ?? [];
  const b = track.values[k + 1] ?? a;
  return a.map((value, i) => value + ((b[i] ?? value) - value) * f);
}

/** The pose at each clip's own clock `times` (seconds), the clips mixed by `weights`. */
export function poseOf(weights: ClipWeights, times: Readonly<Record<ClipName, number>>): Pose {
  const entries = JOINT_NAMES.map((joint): [JointName, JointPose] => {
    const rest = restOffset(joint);
    const keyed = CLIP_NAMES.map((name) => {
      const clip = CLIPS[name];
      const turned = clip.tracks.find((tr) => tr.joint === joint && tr.path === 'rotation');
      const moved = clip.tracks.find((tr) => tr.joint === joint && tr.path === 'translation');
      return {
        weight: weights[name],
        rotation: turned ? sample(turned, times[name], clip.duration) : [0, 0, 0, 1],
        translation: moved ? sample(moved, times[name], clip.duration) : rest,
      };
    });
    const mix = (of: 'rotation' | 'translation', i: number): number =>
      keyed.reduce((sum, key) => sum + key.weight * (key[of][i] ?? 0), 0);
    const length =
      Math.hypot(mix('rotation', 0), mix('rotation', 1), mix('rotation', 2), mix('rotation', 3)) ||
      1;
    return [
      joint,
      {
        rotation: [
          mix('rotation', 0) / length,
          mix('rotation', 1) / length,
          mix('rotation', 2) / length,
          mix('rotation', 3) / length,
        ],
        translation: [mix('translation', 0), mix('translation', 1), mix('translation', 2)],
      },
    ];
  });
  return Object.fromEntries(entries) as Pose;
}
