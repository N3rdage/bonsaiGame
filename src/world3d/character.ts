/**
 * The player's body in the 3D world: which files and clips it is, the size it
 * is drawn at, which clip plays for what the player is doing (idle, walk and
 * run blended on speed; a carry over the upper body; one-shot reaches and a
 * sleep's lying down, over the arms or the whole body), and the sampler that
 * turns the clips' keys into a pose. The body is the KayKit Rogue (Kay
 * Lousberg, CC0) on the `Rig_Medium` skeleton; renderer.ts loads it, feeds
 * `advance` the frame's game time and sets each bone's node to `poseOf`'s
 * result. Pure data and arithmetic, no Babylon, so the rules are unit-tested.
 *
 * Space: the model's own units, y up, the character faces +z, its feet on
 * y 0; renderer.ts scales it to metres. A rotation is a quaternion (x, y, z, w).
 */

import type { Clip, Track } from './glb';

export const CLIP_NAMES = [
  'idle',
  'walk',
  'run',
  'hold',
  'interact',
  'pickUp',
  'lieDown',
  'lieIdle',
  'lieStandUp',
  'sitDown',
  'sitIdle',
  'sitStandUp',
] as const;
export type ClipName = (typeof CLIP_NAMES)[number];
/** The clips that blend on speed: the base of every pose. */
export const LOCOMOTION = ['idle', 'walk', 'run'] as const;
export type Locomotion = (typeof LOCOMOTION)[number];

type Vec3 = readonly [x: number, y: number, z: number];
type Quat = readonly [x: number, y: number, z: number, w: number];

/** The clip in the animations file each of the player's clips plays. */
export const PLAYER_CLIPS: Readonly<Record<ClipName, string>> = {
  idle: 'Idle_A',
  walk: 'Walking_A',
  run: 'Running_A',
  hold: 'Holding_A',
  interact: 'Interact',
  pickUp: 'PickUp',
  lieDown: 'Lie_Down',
  lieIdle: 'Lie_Idle',
  lieStandUp: 'Lie_StandUp',
  sitDown: 'Sit_Chair_Down',
  sitIdle: 'Sit_Chair_Idle',
  sitStandUp: 'Sit_Chair_StandUp',
};

/** Every clip the animations file carries: the player's. */
export const ANIMATION_CLIPS = Object.values(PLAYER_CLIPS);

/** The player's clips as read from the animations file. */
export type PlayerClips = Readonly<Record<ClipName, Clip>>;

/** Which bones a clip drives: all of them, or the upper body (`UPPER_BODY`), leaving the legs to the layers below. */
export type Mask = 'all' | 'upper';

/**
 * The bones the arm and carry clips drive, by the rig's own names: the spine
 * chain up through the chest to the head, and both arms down to the hand and
 * its slot. The hips and the root, which bob and travel with the stride, and
 * the legs, feet and toes stay with the idle, walk and run blend. Rig_Medium's
 * other bones, `Rig_Medium` among them, are not keyed by any player clip.
 */
export const UPPER_BODY: ReadonlySet<string> = new Set(
  ['spine', 'chest', 'head'].concat(
    ['upperarm', 'lowerarm', 'wrist', 'hand', 'handslot'].flatMap((bone) => [
      `${bone}.l`,
      `${bone}.r`,
    ]),
  ),
);

/** The bones each clip drives: carrying and the two reaches use the arms only, so a walk goes on under them; lying down and sitting take the whole body. */
export const CLIP_MASKS: Readonly<Record<ClipName, Mask>> = {
  idle: 'all',
  walk: 'all',
  run: 'all',
  hold: 'upper',
  interact: 'upper',
  pickUp: 'upper',
  lieDown: 'all',
  lieIdle: 'all',
  lieStandUp: 'all',
  sitDown: 'all',
  sitIdle: 'all',
  sitStandUp: 'all',
};

/** The figure's height, metres, top of its head over its feet: the model is scaled to it. */
export const CHARACTER_HEIGHT = 1.7313;
/** The body model's height in its own units, in its bind pose: the top of its hair over its feet on y 0. */
export const BODY_MODEL_HEIGHT = 2.1783;
/** The scale from the model's units to metres. */
export const BODY_SCALE = CHARACTER_HEIGHT / BODY_MODEL_HEIGHT;

/** A feel factor, not real scale: the body is drawn at 70% of `CHARACTER_HEIGHT`, since the rooms feel cramped around a full-size figure. The sim, rooms, furniture, plants, collision and speed ignore it. */
export const AVATAR_SCALE = 0.7;

/** The seconds a change between clips takes: idle to walk, a carry in or out, a reach in or out. */
export const FADE_SECONDS = 0.2;
/** The speed, metres a second, at which the walk clip is wholly in. */
export const WALK_FULL_SPEED = 1;
/** The speed, metres a second, at which the run clip is wholly in: the walk fades out on the way from `WALK_FULL_SPEED`. */
export const RUN_FULL_SPEED = 2;
/**
 * How fast a planted foot slides back under the hips in each gait clip played
 * at its own pace, model units a second: the median over the frames the foot
 * is within 1.5 cm of its lowest (character.test.ts measures them from the file).
 */
export const FOOT_SPEEDS: Readonly<Record<'walk' | 'run', number>> = { walk: 0.68, run: 3.37 };
/**
 * Seconds into each gait clip at which the left foot lands: the first frame of
 * the run of frames its foot is within 1.5 cm of its lowest (character.test.ts
 * measures them from the file). The walk and run strides are played from one
 * phase, 0 at these moments, so they stay in step while they blend.
 */
export const LANDING_OFFSETS: Readonly<Record<'walk' | 'run', number>> = { walk: 1.062, run: 0.08 };
/** The speed, metres a second, at which each gait clip's feet do not slide: a planted foot's speed, scaled to metres. */
export const STRIDE_SPEEDS: Readonly<Record<'walk' | 'run', number>> = {
  walk: FOOT_SPEEDS.walk * BODY_SCALE,
  run: FOOT_SPEEDS.run * BODY_SCALE,
};
/** The fastest and slowest a gait clip plays, as a multiple of its own speed. */
const RATE_MIN = 0.5;
export const RATE_MAX = 2;

/** Seconds over which the measured speed of a body's feet settles, so the fixed steps' jitter does not flicker the blend. */
export const SPEED_SMOOTHING = 0.1;

/** What each locomotion clip contributes to a pose, 0 to 1 and summing to 1. */
export type ClipWeights = Readonly<Record<Locomotion, number>>;

/** `value` between 0 and `max`. */
function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, value));
}

/**
 * `speed` (metres a second) moved toward `moved` metres over `dt` seconds of
 * game time, the time the fixed steps covered, so the reading is the body's
 * true pace however long the frame took on the wall clock. No time, no speed.
 */
export function smoothSpeed(speed: number, moved: number, dt: number): number {
  if (dt <= 0) return 0;
  return speed + (moved / dt - speed) * Math.min(1, dt / SPEED_SMOOTHING);
}

/**
 * Where a body sits on the gait axis: 0 idle, 1 walk, 2 run. The blend is
 * always two neighbours, so the weights are a point on it, and a fade is a
 * move along it.
 */
function gaitAt(speed: number): number {
  const walking = clamp(speed / WALK_FULL_SPEED, 1);
  const running = clamp((speed - WALK_FULL_SPEED) / (RUN_FULL_SPEED - WALK_FULL_SPEED), 1);
  return walking + running;
}

/** The weights at a point on the gait axis. */
function weightsAt(gait: number): ClipWeights {
  return {
    idle: Math.max(0, 1 - gait),
    walk: gait <= 1 ? gait : Math.max(0, 2 - gait),
    run: Math.max(0, gait - 1),
  };
}

/** The weights a body moving at `speed` metres a second settles to: walk rises linearly to 1 at `WALK_FULL_SPEED`, then gives way to run, wholly in at `RUN_FULL_SPEED`. */
export function targetWeights(speed: number): ClipWeights {
  return weightsAt(gaitAt(speed));
}

/** `current` weights moved toward `targetWeights(speed)` over `dt` seconds, so a step between neighbouring clips cross-fades in `FADE_SECONDS`. */
export function fadeWeights(current: ClipWeights, speed: number, dt: number): ClipWeights {
  const at = current.walk + 2 * current.run;
  const target = gaitAt(speed);
  const step = dt / FADE_SECONDS;
  return weightsAt(at < target ? Math.min(target, at + step) : Math.max(target, at - step));
}

/** How fast a gait clip plays at `speed` for a body drawn at `avatarScale`, so its (shorter) stride keeps pace with the ground: 1 at `STRIDE_SPEEDS[clip] * avatarScale`; idle always plays at 1. */
export function clipRate(clip: Locomotion, speed: number, avatarScale: number): number {
  if (clip === 'idle') return 1;
  return Math.min(RATE_MAX, Math.max(RATE_MIN, speed / (STRIDE_SPEEDS[clip] * avatarScale)));
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

/** A clip playing `time` seconds in (it loops over its length), with `weight` among the clips of its layer. */
export interface Playing {
  readonly clip: ClipName;
  readonly time: number;
  readonly weight: number;
}

/** Clips mixed by their weights, laid over the layers before it on the bones of `mask`, `amount` (0 to 1) of the way. */
export interface Layer {
  readonly mask: Mask;
  readonly amount: number;
  readonly clips: readonly Playing[];
}

/**
 * The pose of `layers`, the first the base and each later one laid over those
 * before: per node, a layer takes its `amount` of what the layers above it
 * left, and passes over nodes outside its mask. Within that, per node, the
 * rotations' weighted sum on one hemisphere, normalised, and the
 * translations' weighted mean, each over the clips that key it. A node no
 * clip keys is left out, so it keeps its bind pose.
 */
export function poseOf(clips: PlayerClips, layers: readonly Layer[]): Map<string, NodePose> {
  const names = new Set(
    layers.flatMap((layer) => layer.clips.flatMap(({ clip }) => [...clips[clip].nodes.keys()])),
  );
  const pose = new Map<string, NodePose>();
  for (const name of names) {
    const rotation = [0, 0, 0, 0];
    const translation = [0, 0, 0];
    let turned = 0;
    let moved = 0;
    let left = 1;
    for (const layer of [...layers].reverse()) {
      if (layer.mask === 'upper' && !UPPER_BODY.has(name)) continue;
      const share = layer.amount * left;
      left -= share;
      for (const { clip, time, weight: within } of layer.clips) {
        const weight = within * share;
        const tracks = clips[clip].nodes.get(name);
        if (weight <= 0 || !tracks) continue;
        const { duration } = clips[clip];
        if (tracks.rotation) {
          const q = sampleTrack(tracks.rotation, 4, time, duration);
          const side = q.reduce((sum, v, i) => sum + v * (rotation[i] ?? 0), 0) < 0 ? -1 : 1;
          q.forEach((v, i) => (rotation[i] = (rotation[i] ?? 0) + side * weight * v));
          turned += weight;
        }
        if (tracks.translation) {
          const v = sampleTrack(tracks.translation, 3, time, duration);
          v.forEach((x, i) => (translation[i] = (translation[i] ?? 0) + weight * x));
          moved += weight;
        }
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

/** The clips that play once, started by something the player does: a prop used, a tree picked up, a sleep, a seat taken. */
export type OneShotKind = 'interact' | 'pickUp' | 'sleep' | 'sit';

/** The clips each one-shot plays in turn. */
export const ONE_SHOT_CLIPS: Readonly<Record<OneShotKind, readonly ClipName[]>> = {
  interact: ['interact'],
  pickUp: ['pickUp'],
  sleep: ['lieDown', 'lieIdle', 'lieStandUp'],
  sit: ['sitDown', 'sitIdle', 'sitStandUp'],
};

/** Seconds the sleep lies still between lying down and standing up. */
export const LIE_IDLE_SECONDS = 1.5;

/** The seconds the sleep lies still: `LIE_IDLE_SECONDS`, or the `lieSeconds` of a page address's query when that is a number from 0 to an hour. */
export function parseLieSeconds(search: string): number {
  const raw = new URLSearchParams(search).get('lieSeconds');
  const seconds = raw ? Number(raw) : NaN;
  return seconds >= 0 && seconds <= 3600 ? seconds : LIE_IDLE_SECONDS;
}

/**
 * A one-shot under way: `elapsed` game seconds in, how long `Lie_Idle` is held
 * if it plays, and for a sit the `elapsed` at which the player was released
 * from the seat (undefined while still seated).
 */
export interface OneShot {
  readonly kind: OneShotKind;
  readonly elapsed: number;
  readonly lieSeconds: number;
  readonly releasedAt: number | undefined;
}

/** A one-shot just started. */
export function startShot(kind: OneShotKind, lieSeconds = LIE_IDLE_SECONDS): OneShot {
  return { kind, elapsed: 0, lieSeconds, releasedAt: undefined };
}

/**
 * The one-shot a `kind` started now becomes, given the `current` one: a reach
 * (`interact`, `pickUp`) does not cut into a sleep, from lying down to standing
 * up, and leaves it; anything else starts over.
 */
export function startOver(
  current: OneShot | undefined,
  kind: OneShotKind,
  lieSeconds = LIE_IDLE_SECONDS,
): OneShot {
  const reach = kind === 'interact' || kind === 'pickUp';
  return current?.kind === 'sleep' && reach ? current : startShot(kind, lieSeconds);
}

/** True once a sit has been told to end: its stand-up is coming or under way. */
export function released(shot: OneShot | undefined): boolean {
  return shot?.kind === 'sit' && shot.releasedAt !== undefined;
}

/**
 * A sit told to end now: `Sit_Chair_Idle` stops being held and `Sit_Chair_StandUp`
 * follows. A release during `Sit_Chair_Down` lets that clip finish, then stands
 * up straight away. Any other shot, and a sit already released, is unchanged.
 */
export function release(shot: OneShot): OneShot {
  return shot.kind === 'sit' && shot.releasedAt === undefined
    ? { ...shot, releasedAt: shot.elapsed }
    : shot;
}

/**
 * The clips a one-shot plays and for how long each: its own length, except
 * `Lie_Idle`, held `lieSeconds`, and `Sit_Chair_Idle`, held without end until
 * the sit is released: from the end of `Sit_Chair_Down` to the release, none
 * if the release came first.
 */
function segments(shot: OneShot, clips: PlayerClips): { clip: ClipName; seconds: number }[] {
  return ONE_SHOT_CLIPS[shot.kind].map((clip) => {
    if (clip === 'lieIdle') return { clip, seconds: shot.lieSeconds };
    if (clip !== 'sitIdle') return { clip, seconds: clips[clip].duration };
    const held = (shot.releasedAt ?? Infinity) - clips.sitDown.duration;
    return { clip, seconds: Math.max(0, held) };
  });
}

/** How long a one-shot lasts. */
export function shotLength(shot: OneShot, clips: PlayerClips): number {
  return segments(shot, clips).reduce((sum, { seconds }) => sum + seconds, 0);
}

/**
 * The clip a one-shot is on, how far into it, and how much of the pose it
 * is: in over `FADE_SECONDS` at the start and out over the last, so the
 * clips of a sequence run into each other unfaded. Undefined once it is over.
 */
export function shotAt(
  shot: OneShot,
  clips: PlayerClips,
): { clip: ClipName; time: number; amount: number } | undefined {
  const total = shotLength(shot, clips);
  if (shot.elapsed >= total) return undefined;
  let start = 0;
  for (const { clip, seconds } of segments(shot, clips)) {
    if (shot.elapsed < start + seconds) {
      const amount = clamp(Math.min(shot.elapsed, total - shot.elapsed) / FADE_SECONDS, 1);
      return { clip, time: shot.elapsed - start, amount };
    }
    start += seconds;
  }
  return undefined;
}

/**
 * How far a sit has carried the body from where the player stands to the
 * seat, 0 to 1: eased in over `Sit_Chair_Down`, 1 while seated, eased out over
 * `Sit_Chair_StandUp`. 0 for any other shot and once the sit is over.
 */
export function seatBlend(shot: OneShot, clips: PlayerClips): number {
  const playing = shot.kind === 'sit' ? shotAt(shot, clips) : undefined;
  if (!playing || playing.clip === 'sitIdle') return playing ? 1 : 0;
  const t = clamp(playing.time / clips[playing.clip].duration, 1);
  const eased = t * t * (3 - 2 * t);
  return playing.clip === 'sitDown' ? eased : 1 - eased;
}

/** The clocks of the idle and carry clips, each seconds into its clip; the walk and run share `Motion.gait`. */
export type Clocks = Readonly<Record<'idle' | 'hold', number>>;

/** Everything the body's pose carries from frame to frame. */
export interface Motion {
  /** Metres a second over the ground, smoothed. */
  readonly speed: number;
  readonly weights: ClipWeights;
  /** How much of the upper body is the carry, 0 to 1, fading with `FADE_SECONDS`. */
  readonly carry: number;
  readonly clocks: Clocks;
  /** Where the body is in its stride, 0 to 1 over a cycle; 0 is the left foot landing in both the walk and the run clip. */
  readonly gait: number;
  readonly shot: OneShot | undefined;
}

/** A body at rest, empty-handed. */
export const AT_REST: Motion = {
  speed: 0,
  weights: { idle: 1, walk: 0, run: 0 },
  carry: 0,
  clocks: { idle: 0, hold: 0 },
  gait: 0,
  shot: undefined,
};

/** What a frame feeds the body. */
export interface MotionStep {
  /** Metres the feet moved over `dt`. */
  readonly moved: number;
  /** Seconds of game time the frame's fixed steps covered. */
  readonly dt: number;
  readonly carrying: boolean;
  readonly avatarScale: number;
  /** Reduced motion: the idle and carry clips hold their first pose. */
  readonly still: boolean;
}

/**
 * How many strides a second the blend of the walk and run clips takes: each
 * clip's cycle frequency at `speed`, weighted by its weight (the walk's alone
 * when neither is in, so a body at rest starts off at the walking pace).
 */
export function gaitRate(
  weights: ClipWeights,
  speed: number,
  avatarScale: number,
  clips: PlayerClips,
): number {
  const frequency = (clip: 'walk' | 'run'): number =>
    clipRate(clip, speed, avatarScale) / clips[clip].duration;
  const total = weights.walk + weights.run;
  if (total <= 0) return frequency('walk');
  return (weights.walk * frequency('walk') + weights.run * frequency('run')) / total;
}

/** Seconds into `clip` (walk or run) at stride phase `gait`. */
export function gaitTime(clip: 'walk' | 'run', gait: number, clips: PlayerClips): number {
  const { duration } = clips[clip];
  return (LANDING_OFFSETS[clip] + gait * duration) % duration;
}

/**
 * `motion` moved on by `step`: the speed and the gait blend, the carry fading
 * in or out, the looping clocks (the stride phase advancing at the blend of
 * the gait clips' rates, which keeps their feet on the ground) and the one-shot under way, which ends when its clips
 * do. `clips` is undefined until the body has loaded, when clocks just run.
 */
export function advance(motion: Motion, step: MotionStep, clips: PlayerClips | undefined): Motion {
  const { dt } = step;
  const speed = smoothSpeed(motion.speed, step.moved, dt);
  const loop = (clip: ClipName, time: number): number => {
    const duration = clips?.[clip].duration ?? 0;
    return duration > 0 ? time % duration : time;
  };
  const { idle, hold } = motion.clocks;
  const elapsed = motion.shot ? motion.shot.elapsed + dt : 0;
  const shot = motion.shot && { ...motion.shot, elapsed };
  const weights = fadeWeights(motion.weights, speed, dt);
  const strides = clips ? gaitRate(weights, speed, step.avatarScale, clips) * dt : 0;
  return {
    speed,
    weights,
    carry: clamp(motion.carry + (step.carrying ? dt : -dt) / FADE_SECONDS, 1),
    clocks: {
      idle: step.still ? idle : loop('idle', idle + dt),
      hold: step.still ? hold : loop('hold', hold + dt),
    },
    gait: (motion.gait + strides) % 1,
    shot: shot && clips && shotAt(shot, clips) ? shot : undefined,
  };
}

/**
 * What plays now, from the base up: the idle, walk and run blend on every
 * bone; the carry's `Holding_A` over the upper body by how far the carry has
 * faded in; and the one-shot's clip over its mask (the arms for a reach, the
 * whole body for lying down or sitting) by its fade. With `still`, `Lie_Idle` and
 * `Sit_Chair_Idle` hold their first pose.
 */
export function layersOf(motion: Motion, clips: PlayerClips, still: boolean): Layer[] {
  const layers: Layer[] = [
    {
      mask: 'all',
      amount: 1,
      clips: LOCOMOTION.map((clip) => ({
        clip,
        time: clip === 'idle' ? motion.clocks.idle : gaitTime(clip, motion.gait, clips),
        weight: motion.weights[clip],
      })),
    },
  ];
  if (motion.carry > 0) {
    layers.push({
      mask: CLIP_MASKS.hold,
      amount: motion.carry,
      clips: [{ clip: 'hold', time: motion.clocks.hold, weight: 1 }],
    });
  }
  const playing = motion.shot && shotAt(motion.shot, clips);
  if (playing) {
    const held = playing.clip === 'lieIdle' || playing.clip === 'sitIdle';
    const time = still && held ? 0 : playing.time;
    layers.push({
      mask: CLIP_MASKS[playing.clip],
      amount: playing.amount,
      clips: [{ clip: playing.clip, time, weight: 1 }],
    });
  }
  return layers;
}
