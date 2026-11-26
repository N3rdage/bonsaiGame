/**
 * The player's body in the 3D world: which files and clips it is, the size it
 * is drawn at, the rule that blends its idle and walk clips by speed, and the
 * sampler that turns the clips' keys into a pose. The body is the KayKit
 * Rogue (Kay Lousberg, CC0) on the `Rig_Medium` skeleton; renderer.ts loads
 * it and sets each bone's node to `poseOf`'s result. Pure data and
 * arithmetic, no Babylon, so the blend and the sampler are unit-tested.
 *
 * Space: the model's own units, y up, the character faces +z, its feet on
 * y 0; renderer.ts scales it to metres. A rotation is a quaternion (x, y, z, w).
 */

import type { Clip, Track } from './glb';

export const CLIP_NAMES = ['idle', 'walk'] as const;
export type ClipName = (typeof CLIP_NAMES)[number];

type Vec3 = readonly [x: number, y: number, z: number];
type Quat = readonly [x: number, y: number, z: number, w: number];

/** The clip in the animations file each blend clip plays. */
export const PLAYER_CLIPS: Readonly<Record<ClipName, string>> = {
  idle: 'Idle_A',
  walk: 'Walking_A',
};

/** Every clip the animations file carries: idle and walk, a carry, two reaches, sitting on a chair and lying down. */
export const ANIMATION_CLIPS = [
  'Idle_A',
  'Walking_A',
  'Holding_A',
  'Interact',
  'PickUp',
  'Sit_Chair_Down',
  'Sit_Chair_Idle',
  'Sit_Chair_StandUp',
  'Lie_Down',
  'Lie_Idle',
  'Lie_StandUp',
] as const;

/** The figure's height, metres, top of its head over its feet: the model is scaled to it. */
export const CHARACTER_HEIGHT = 1.7313;
/** The body model's height in its own units, in its bind pose: the top of its hair over its feet on y 0. */
export const BODY_MODEL_HEIGHT = 2.1783;
/** The scale from the model's units to metres. */
export const BODY_SCALE = CHARACTER_HEIGHT / BODY_MODEL_HEIGHT;

/** The seconds a change between idle and walk takes. */
const FADE_SECONDS = 0.2;
/** The speed, metres a second, at which the walk clip is wholly in. */
export const WALK_FULL_SPEED = 1;
/**
 * How fast a planted foot slides back under the hips in `Walking_A` played at
 * its own pace, model units a second: the median over the frames the foot is
 * within 1.5 cm of its lowest (character.test.ts measures it from the file).
 */
export const WALK_FOOT_SPEED = 0.68;
/** The speed, metres a second, at which the walk clip's feet do not slide: a planted foot's speed, scaled to metres. */
export const STRIDE_SPEED = WALK_FOOT_SPEED * BODY_SCALE;
/** The fastest and slowest the walk clip plays, as a multiple of its own speed. */
const RATE_MIN = 0.5;
const RATE_MAX = 2;

/** Seconds over which the measured speed of a body's feet settles, so the fixed steps' jitter does not flicker the blend. */
export const SPEED_SMOOTHING = 0.1;

/** What each clip contributes to a pose, 0 to 1 and summing to 1. */
export type ClipWeights = Readonly<Record<ClipName, number>>;

/**
 * `speed` (metres a second) moved toward `moved` metres over `dt` seconds of
 * game time, the time the fixed steps covered, so the reading is the body's
 * true pace however long the frame took on the wall clock. No time, no speed.
 */
export function smoothSpeed(speed: number, moved: number, dt: number): number {
  if (dt <= 0) return 0;
  return speed + (moved / dt - speed) * Math.min(1, dt / SPEED_SMOOTHING);
}

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

/** One node's local transform in a pose: what the clips key of it. */
export interface NodePose {
  readonly rotation: Quat | undefined;
  readonly translation: Vec3 | undefined;
}

/** The value of `track` (keys `width` wide) at `time` seconds into a clip that loops over `duration`: keys are interpolated linearly, rotations along the shorter arc. */
export function sampleTrack(track: Track, width: 3 | 4, time: number, duration: number): number[] {
  const { times, values } = track;
  const key = (i: number): number[] => Array.from(values.subarray(i * width, i * width + width));
  const t = duration > 0 ? ((time % duration) + duration) % duration : 0;
  const last = times.length - 1;
  if (last <= 0 || t <= (times[0] ?? 0)) return key(0);
  if (t >= (times[last] ?? 0)) return key(last);
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((times[mid] ?? 0) <= t) lo = mid;
    else hi = mid;
  }
  const t0 = times[lo] ?? 0;
  const f = (t - t0) / ((times[hi] ?? t0) - t0 || 1);
  const a = key(lo);
  const b = key(hi);
  return width === 4 ? slerp(a, b, f) : a.map((v, i) => v + ((b[i] ?? v) - v) * f);
}

/** The rotation `f` of the way from `a` to `b` along the shorter arc. */
function slerp(a: readonly number[], b: readonly number[], f: number): number[] {
  let dot = a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
  const sign = dot < 0 ? -1 : 1;
  dot *= sign;
  let wa = 1 - f;
  let wb = f;
  if (dot < 0.9995) {
    const angle = Math.acos(dot);
    const sin = Math.sin(angle);
    wa = Math.sin((1 - f) * angle) / sin;
    wb = Math.sin(f * angle) / sin;
  }
  const q = a.map((v, i) => v * wa + sign * (b[i] ?? 0) * wb);
  const length = Math.hypot(...q) || 1;
  return q.map((v) => v / length);
}

/**
 * The pose at each clip's own clock `times` (seconds), the clips mixed by
 * `weights`: per node, the rotations' weighted sum on one hemisphere,
 * normalised, and the translations' weighted mean, each over the clips that
 * key it. A node no clip keys is left out, so it keeps its bind pose.
 */
export function poseOf(
  clips: Readonly<Record<ClipName, Clip>>,
  weights: ClipWeights,
  times: Readonly<Record<ClipName, number>>,
): Map<string, NodePose> {
  const names = new Set(CLIP_NAMES.flatMap((clip) => [...clips[clip].nodes.keys()]));
  const pose = new Map<string, NodePose>();
  for (const name of names) {
    const rotation = [0, 0, 0, 0];
    const translation = [0, 0, 0];
    let turned = 0;
    let moved = 0;
    for (const clip of CLIP_NAMES) {
      const weight = weights[clip];
      const tracks = clips[clip].nodes.get(name);
      if (weight <= 0 || !tracks) continue;
      const { duration } = clips[clip];
      if (tracks.rotation) {
        const q = sampleTrack(tracks.rotation, 4, times[clip], duration);
        const side = q.reduce((sum, v, i) => sum + v * (rotation[i] ?? 0), 0) < 0 ? -1 : 1;
        q.forEach((v, i) => (rotation[i] = (rotation[i] ?? 0) + side * weight * v));
        turned += weight;
      }
      if (tracks.translation) {
        const v = sampleTrack(tracks.translation, 3, times[clip], duration);
        v.forEach((x, i) => (translation[i] = (translation[i] ?? 0) + weight * x));
        moved += weight;
      }
    }
    const [x = 0, y = 0, z = 0, w = 0] = rotation;
    const length = Math.hypot(x, y, z, w) || 1;
    const [tx = 0, ty = 0, tz = 0] = translation;
    pose.set(name, {
      rotation: turned > 0 ? [x / length, y / length, z / length, w / length] : undefined,
      translation: moved > 0 ? [tx / moved, ty / moved, tz / moved] : undefined,
    });
  }
  return pose;
}
