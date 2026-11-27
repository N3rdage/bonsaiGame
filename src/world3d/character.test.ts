import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ANIMATION_CLIPS,
  AVATAR_SCALE,
  BODY_MODEL_HEIGHT,
  BODY_SCALE,
  AT_REST,
  CHARACTER_HEIGHT,
  CLIP_MASKS,
  CLIP_NAMES,
  FOOT_SPEEDS,
  LANDING_OFFSETS,
  LIE_IDLE_SECONDS,
  PLAYER_CLIPS,
  RATE_MAX,
  RUN_FULL_SPEED,
  STRIDE_SPEEDS,
  UPPER_BODY,
  WALK_FULL_SPEED,
  advance,
  clipRate,
  fadeWeights,
  gaitRate,
  gaitTime,
  layersOf,
  parseLieSeconds,
  poseOf,
  release,
  released,
  sampleTrack,
  seatBlend,
  shotAt,
  shotLength,
  smoothSpeed,
  startOver,
  startShot,
  targetWeights,
  type ClipName,
  type ClipWeights,
  type Layer,
  type Mask,
  type Motion,
  type MotionStep,
  type PlayerClips,
  type Playing,
} from './character';
import { accessorFloats, readClips, readGlb, type Clip, type Glb, type GltfJson } from './glb';
import { MOVE_SPEED } from '../world/player';

/** A committed file under src/world3d/player/ as a GLB. */
function glbFile(path: string): Glb {
  const bytes = readFileSync(new URL(`./player/${path}`, import.meta.url));
  return readGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

interface Node {
  readonly name?: string;
  readonly children?: readonly number[];
  readonly mesh?: number;
  readonly skin?: number;
  readonly translation?: readonly number[];
  readonly rotation?: readonly number[];
}
interface Full extends GltfJson {
  readonly nodes: readonly Node[];
  readonly meshes?: readonly {
    readonly name?: string;
    readonly primitives: readonly {
      readonly attributes: Readonly<Record<string, number>>;
      readonly indices: number;
    }[];
  }[];
  readonly skins?: readonly { readonly joints: readonly number[] }[];
}

const clipsGlb = glbFile('animations.glb');
const bodyGlb = glbFile('rogue.glb');
const clips = readClips(clipsGlb);
const bodyJson = bodyGlb.json as Full;

function clip(name: string): Clip {
  const found = clips.get(name);
  if (!found) throw new Error(`no clip ${name}`);
  return found;
}

/** The player's clips as the renderer reads them from the file. */
function playerClips(): PlayerClips {
  return Object.fromEntries(
    CLIP_NAMES.map((name) => [name, clip(PLAYER_CLIPS[name])]),
  ) as PlayerClips;
}

describe('the player files', () => {
  it('play Idle_A at rest, Walking_A and Running_A on the move, and the carry, reach, lying and sitting clips', () => {
    expect(PLAYER_CLIPS).toEqual({
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
    });
  });

  it('carry every clip the player needs, and the chair clips, and no others', () => {
    expect([...clips.keys()].sort()).toEqual([...ANIMATION_CLIPS].sort());
    expect(clip('Idle_A').duration).toBeCloseTo(1.0667, 3);
    expect(clip('Walking_A').duration).toBeCloseTo(1.0667, 3);
    expect(clip('Running_A').duration).toBeCloseTo(0.8, 3);
  });

  it('drop the animation file mannequin: its file has no meshes', () => {
    expect((clipsGlb.json as Full).meshes ?? []).toEqual([]);
  });

  it('give the body one skinned mesh with no cape, hat or mask', () => {
    expect(bodyJson.meshes?.map((m) => m.name)).toEqual(['Rogue']);
    expect(bodyJson.nodes.filter((n) => n.mesh !== undefined).every((n) => n.skin === 0)).toBe(
      true,
    );
  });

  it('key only bones the body has, by name', () => {
    const joints = new Set(bodyJson.skins?.[0]?.joints.map((j) => bodyJson.nodes[j]?.name));
    for (const name of ANIMATION_CLIPS) {
      for (const node of clip(name).nodes.keys()) {
        if (node !== 'Rig_Medium') expect(joints).toContain(node);
      }
    }
  });
});

/** The body mesh's positions, normals and triangle indices. */
function bodyMesh(): { positions: Float32Array; normals: Float32Array; indices: number[] } {
  const primitive = bodyJson.meshes?.[0]?.primitives[0];
  if (!primitive) throw new Error('no body primitive');
  const positions = accessorFloats(bodyGlb, primitive.attributes.POSITION ?? -1);
  const normals = accessorFloats(bodyGlb, primitive.attributes.NORMAL ?? -1);
  const accessor = bodyJson.accessors?.[primitive.indices];
  const view = bodyJson.bufferViews?.[accessor?.bufferView ?? -1];
  const start = (view?.byteOffset ?? 0) + (accessor?.byteOffset ?? 0);
  const indices = Array.from({ length: accessor?.count ?? 0 }, (_, i) =>
    bodyGlb.bin.getUint16(start + i * 2, true),
  );
  return { positions, normals, indices };
}

describe('the body', () => {
  it('is drawn 1.73 m tall: the model, feet on y 0, scaled to the character height', () => {
    expect(CHARACTER_HEIGHT).toBeCloseTo(1.73, 2);
    const position =
      bodyJson.accessors?.[bodyJson.meshes?.[0]?.primitives[0]?.attributes.POSITION ?? -1];
    expect(position?.max?.[1]).toBeCloseTo(BODY_MODEL_HEIGHT, 3);
    expect(Math.abs(position?.min?.[1] ?? 1)).toBeLessThan(0.01);
    expect(BODY_MODEL_HEIGHT * BODY_SCALE).toBeCloseTo(CHARACTER_HEIGHT, 6);
  });

  // glTF's front faces wind counter-clockwise; the loader's handedness flip under its root
  // turns that into Babylon's clockwise, so one winding throughout is a body drawn solid.
  it('winds every visible triangle counter-clockwise about its normals, as glTF fronts do', () => {
    const { positions: p, normals: n, indices } = bodyMesh();
    const at = (list: Float32Array, i: number, o: number): number => list[i * 3 + o] ?? 0;
    let outward = 0;
    let inward = 0;
    for (let t = 0; t < indices.length; t += 3) {
      const [a = 0, b = 0, c = 0] = indices.slice(t, t + 3);
      const e1 = [0, 1, 2].map((o) => at(p, b, o) - at(p, a, o));
      const e2 = [0, 1, 2].map((o) => at(p, c, o) - at(p, a, o));
      const [x1 = 0, y1 = 0, z1 = 0] = e1;
      const [x2 = 0, y2 = 0, z2 = 0] = e2;
      const cross = [y1 * z2 - z1 * y2, z1 * x2 - x1 * z2, x1 * y2 - y1 * x2];
      const normal = [0, 1, 2].map((o) => at(n, a, o) + at(n, b, o) + at(n, c, o));
      const dot = cross.reduce((sum, v, o) => sum + v * (normal[o] ?? 0), 0);
      // Four of the head's triangles are specks (twice their area is under 1e-6 units^2), whose sign is float noise.
      if (Math.hypot(...cross) < 1e-6) continue;
      if (dot > 0) outward += 1;
      else inward += 1;
    }
    expect(outward).toBeGreaterThan(7400);
    expect(inward).toBe(0);
  });
});

type V3 = [number, number, number];
type Q = [number, number, number, number];
const multiply = ([ax, ay, az, aw]: Q, [bx, by, bz, bw]: Q): Q => [
  aw * bx + ax * bw + ay * bz - az * by,
  aw * by - ax * bz + ay * bw + az * bx,
  aw * bz + ax * by - ay * bx + az * bw,
  aw * bw - ax * bx - ay * by - az * bz,
];
const rotate = (q: Q, [x, y, z]: V3): V3 => {
  const [rx, ry, rz] = multiply(multiply(q, [x, y, z, 0]), [-q[0], -q[1], -q[2], q[3]]);
  return [rx, ry, rz];
};

/** Where node `index` is and how it is turned in the model's space at `time` into `walk`: the clip's keys over the body's rest pose. */
function worldOf(walk: Clip, index: number, time: number): { at: V3; turn: Q } {
  const { nodes } = bodyJson;
  const node = nodes[index];
  const tracks = walk.nodes.get(node?.name ?? '');
  const t = (
    tracks?.translation
      ? sampleTrack(tracks.translation, 3, time, walk.duration)
      : (node?.translation ?? [0, 0, 0])
  ) as V3;
  const r = (
    tracks?.rotation
      ? sampleTrack(tracks.rotation, 4, time, walk.duration)
      : (node?.rotation ?? [0, 0, 0, 1])
  ) as Q;
  const parent = nodes.findIndex((n) => n.children?.includes(index));
  if (parent < 0) return { at: t, turn: r };
  const up = worldOf(walk, parent, time);
  const [x, y, z] = rotate(up.turn, t);
  return { at: [up.at[0] + x, up.at[1] + y, up.at[2] + z], turn: multiply(up.turn, r) };
}

function boneAt(walk: Clip, bone: string, time: number): V3 {
  return worldOf(
    walk,
    bodyJson.nodes.findIndex((n) => n.name === bone),
    time,
  ).at;
}

describe('the gaits', () => {
  /** The median speed, model units a second, a planted left foot slides back under the hips in `gait` played at its own pace. */
  function plantedFootSpeed(gait: 'walk' | 'run'): number {
    const played = clip(PLAYER_CLIPS[gait]);
    const steps = 96;
    const dt = played.duration / steps;
    const path = Array.from({ length: steps }, (_, i) => boneAt(played, 'foot.l', i * dt));
    const lowest = Math.min(...path.map(([, y]) => y));
    const speeds = path
      .map((at, i) => [at, path[(i + 1) % steps] ?? at] as const)
      .filter(([a, b]) => a[1] - lowest < 0.015 && b[1] - lowest < 0.015)
      .map(([a, b]) => (a[2] - b[2]) / dt)
      .sort((a, b) => a - b);
    return speeds[speeds.length >> 1] ?? 0;
  }

  it.each(['walk', 'run'] as const)(
    'slide a planted foot back at FOOT_SPEEDS.%s model units a second, so the stride speed is that in metres',
    (gait) => {
      const measured = plantedFootSpeed(gait);
      expect(measured / FOOT_SPEEDS[gait]).toBeGreaterThan(0.95);
      expect(measured / FOOT_SPEEDS[gait]).toBeLessThan(1.05);
      expect(STRIDE_SPEEDS[gait]).toBeCloseTo(FOOT_SPEEDS[gait] * BODY_SCALE, 9);
    },
  );

  /** The seconds into `gait` at which the left foot lands: the first frame of its planted run, found by stepping the clip in 240ths. */
  function landing(gait: 'walk' | 'run'): { time: number; step: number } {
    const played = clip(PLAYER_CLIPS[gait]);
    const steps = 240;
    const step = played.duration / steps;
    const path = Array.from({ length: steps }, (_, i) => boneAt(played, 'foot.l', i * step));
    const lowest = Math.min(...path.map(([, y]) => y));
    const planted = path.map(([, y]) => y - lowest < 0.015);
    const first = planted.findIndex((on, i) => on && !planted[(i + steps - 1) % steps]);
    return { time: first * step, step };
  }

  it.each(['walk', 'run'] as const)(
    'land the left foot at LANDING_OFFSETS.%s, to within a frame of 240 steps',
    (gait) => {
      const { time, step } = landing(gait);
      expect(Math.abs(time - LANDING_OFFSETS[gait])).toBeLessThanOrEqual(step);
    },
  );

  it('keep the walk and run in phase through any speeds, both clips at their landing at phase 0', () => {
    const clips = playerClips();
    const phaseIn = (motion: Motion, gait: 'walk' | 'run'): number => {
      const time = layersOf(motion, clips, false)[0]?.clips.find((c) => c.clip === gait)?.time ?? 0;
      return (time - LANDING_OFFSETS[gait]) / clips[gait].duration;
    };
    let motion = AT_REST;
    expect(gaitTime('walk', 0, clips)).toBe(LANDING_OFFSETS.walk);
    expect(gaitTime('run', 0, clips)).toBe(LANDING_OFFSETS.run);
    for (const speed of [0.3, 1, 1.4, 2.5, 0.8, 1.9, 0]) {
      motion = run(0.7, { speed }, motion);
      const walk = phaseIn(motion, 'walk');
      expect(((walk % 1) + 1) % 1).toBeCloseTo(motion.gait, 6);
      expect(((phaseIn(motion, 'run') % 1) + 1) % 1).toBeCloseTo(motion.gait, 6);
    }
  });

  it('advance the stride phase at the weighted blend of the clips cycle frequencies', () => {
    const clips = playerClips();
    const frequency = (g: 'walk' | 'run', speed: number): number =>
      clipRate(g, speed, 1) / clips[g].duration;
    const rate = (walk: number, run: number, speed: number): number =>
      gaitRate({ idle: 1 - walk - run, walk, run }, speed, 1, clips);
    expect(rate(1, 0, 1)).toBeCloseTo(frequency('walk', 1), 9);
    expect(rate(0, 1, 3)).toBeCloseTo(frequency('run', 3), 9);
    expect(rate(0, 0, 0)).toBeCloseTo(frequency('walk', 0), 9);
    const blend = 0.5 * frequency('walk', 1.5) + 0.5 * frequency('run', 1.5);
    expect(rate(0.5, 0.5, 1.5)).toBeCloseTo(blend, 9);
    const settled = run(1, { speed: 3 });
    const next = run(1 / 60, { speed: 3 }, settled);
    expect(((next.gait - settled.gait + 1) % 1) * 60).toBeCloseTo(frequency('run', 3), 4);
  });

  it('pin the strides: about 0.54 m/s walking and 2.68 m/s running for the full-size figure', () => {
    expect(STRIDE_SPEEDS.walk).toBeCloseTo(0.54, 2);
    expect(STRIDE_SPEEDS.run).toBeCloseTo(2.68, 2);
  });
});

/** A one-node clip: `values` keyed at `times`, rotations or translations by their width. */
function testClip(width: 3 | 4, times: number[], values: number[], duration: number): Clip {
  const track = { times: Float32Array.from(times), values: Float32Array.from(values) };
  return {
    duration,
    nodes: new Map([['bone', width === 4 ? { rotation: track } : { translation: track }]]),
  };
}

describe('the clip sampler', () => {
  const s = Math.SQRT1_2;
  it('interpolates translations linearly and loops over the duration', () => {
    const track = { times: Float32Array.of(0, 1), values: Float32Array.of(0, 0, 0, 2, 4, 6) };
    expect(sampleTrack(track, 3, 0.5, 1)).toEqual([1, 2, 3]);
    expect(sampleTrack(track, 3, 0.25, 1)).toEqual(sampleTrack(track, 3, 1.25, 1));
    expect(sampleTrack(track, 3, -0.75, 1)).toEqual(sampleTrack(track, 3, 0.25, 1));
  });

  it('turns rotations along the shorter arc, whatever sign a key was stored with', () => {
    // From no turn to a quarter turn about y, the second key stored negated.
    const track = {
      times: Float32Array.of(0, 1),
      values: Float32Array.of(0, 0, 0, 1, 0, -s, 0, -s),
    };
    const [x = 0, y = 0, z = 0, w = 0] = sampleTrack(track, 4, 0.5, 2);
    expect(Math.hypot(x, y, z, w)).toBeCloseTo(1);
    expect(Math.abs(2 * Math.atan2(y, w))).toBeCloseTo(Math.PI / 4);
  });

  it('holds the first and last keys outside them', () => {
    const track = { times: Float32Array.of(0.2, 0.4), values: Float32Array.of(1, 1, 1, 3, 3, 3) };
    expect(sampleTrack(track, 3, 0.1, 1)).toEqual([1, 1, 1]);
    expect(sampleTrack(track, 3, 0.9, 1)).toEqual([3, 3, 3]);
  });

  /** Test clips by name, each a `bone` keyed over one second; the rest are empty. */
  function testClips(keyed: Partial<Record<ClipName, Clip>>): PlayerClips {
    const empty: Clip = { duration: 1, nodes: new Map() };
    return Object.fromEntries(
      CLIP_NAMES.map((name) => [name, keyed[name] ?? empty]),
    ) as PlayerClips;
  }
  const at = (clip: ClipName, weight = 1, time = 0.3): Playing => ({ clip, time, weight });

  it('mixes the clips of a layer by weight: translations as a weighted mean, rotations normalised', () => {
    const idle = testClip(3, [0, 1], [0, 0, 0, 0, 0, 0], 1);
    const walk = testClip(3, [0, 1], [4, 0, 0, 4, 0, 0], 1);
    const base = (weights: Playing[]): Layer[] => [{ mask: 'all', amount: 1, clips: weights }];
    expect(
      poseOf(testClips({ idle, walk }), base([at('idle', 0.75), at('walk', 0.25)])).get('bone')
        ?.translation,
    ).toEqual([1, 0, 0]);
    const still = testClip(4, [0, 1], [0, 0, 0, 1, 0, 0, 0, 1], 1);
    const turned = testClip(4, [0, 1], [0, s, 0, s, 0, s, 0, s], 1);
    const [, y = 0, , w = 0] =
      poseOf(
        testClips({ idle: still, walk: turned }),
        base([at('idle', 0.5), at('walk', 0.5)]),
      ).get('bone')?.rotation ?? [];
    expect(2 * Math.atan2(y, w)).toBeCloseTo(Math.PI / 4);
    expect(
      poseOf(testClips({ idle: still, walk: turned }), base([at('idle'), at('walk', 0)])).get(
        'bone',
      )?.rotation,
    ).toEqual([0, 0, 0, 1]);
  });

  it('lays a layer over those before it by its amount, and only on the bones of its mask', () => {
    const a = testClip(3, [0, 1], [0, 0, 0, 0, 0, 0], 1);
    const b = testClip(3, [0, 1], [8, 0, 0, 8, 0, 0], 1);
    const clips = testClips({ idle: a, hold: b });
    const over = (mask: Mask, amount: number): Layer[] => [
      { mask: 'all', amount: 1, clips: [at('idle')] },
      { mask, amount, clips: [at('hold')] },
    ];
    expect(poseOf(clips, over('all', 0.25)).get('bone')?.translation).toEqual([2, 0, 0]);
    expect(poseOf(clips, over('all', 1)).get('bone')?.translation).toEqual([8, 0, 0]);
    // 'bone' is not an upper-body bone: a layer masked to the upper body passes over it.
    expect(poseOf(clips, over('upper', 1)).get('bone')?.translation).toEqual([0, 0, 0]);
  });

  it('poses each bone of the real clips with a unit rotation, all idle at rest', () => {
    const pose = poseOf(playerClips(), layersOf(AT_REST, playerClips(), true));
    expect(pose.size).toBeGreaterThan(20);
    for (const { rotation } of pose.values()) {
      expect(Math.hypot(...(rotation ?? [0, 0, 0, 1]))).toBeCloseTo(1);
    }
  });
});

describe('the blend', () => {
  it('is all idle at rest', () => {
    expect(targetWeights(0)).toEqual({ idle: 1, walk: 0, run: 0 });
  });

  it('is half and half at half the walk speed', () => {
    expect(targetWeights(WALK_FULL_SPEED / 2)).toEqual({ idle: 0.5, walk: 0.5, run: 0 });
  });

  it('is all walk at the walk full speed, and half walk, half run midway to the run full speed', () => {
    expect(targetWeights(WALK_FULL_SPEED)).toEqual({ idle: 0, walk: 1, run: 0 });
    expect(targetWeights((WALK_FULL_SPEED + RUN_FULL_SPEED) / 2)).toEqual({
      idle: 0,
      walk: 0.5,
      run: 0.5,
    });
  });

  it('is all run at the full speed of the player and beyond', () => {
    const full = (MOVE_SPEED * 60) / 32;
    expect(full).toBeGreaterThan(RUN_FULL_SPEED);
    expect(targetWeights(full)).toEqual({ idle: 0, walk: 0, run: 1 });
    expect(targetWeights(10)).toEqual({ idle: 0, walk: 0, run: 1 });
  });

  it('cross-fades over 0.2 s a step and stops at the target', () => {
    const rest = { idle: 1, walk: 0, run: 0 };
    const half = fadeWeights(rest, 1, 0.1);
    expect(half.walk).toBeCloseTo(0.5);
    expect(half.idle).toBeCloseTo(0.5);
    expect(fadeWeights(half, 1, 1)).toEqual({ idle: 0, walk: 1, run: 0 });
    const toRun = fadeWeights({ idle: 0, walk: 1, run: 0 }, 5, 0.1);
    expect(toRun.walk).toBeCloseTo(0.5);
    expect(toRun.run).toBeCloseTo(0.5);
    expect(fadeWeights(toRun, 5, 1)).toEqual({ idle: 0, walk: 0, run: 1 });
    expect(fadeWeights({ idle: 0, walk: 1, run: 0 }, 0, 0.1).walk).toBeCloseTo(0.5);
    expect(fadeWeights({ idle: 0.9, walk: 0.1, run: 0 }, 0, 1)).toEqual({
      idle: 1,
      walk: 0,
      run: 0,
    });
  });

  it('reads the pace of the game time the steps covered, however slow the frame was', () => {
    const full = (MOVE_SPEED * 60) / 32;
    // Five steps a frame, then one step a frame: the same pace on the game's clock.
    for (const steps of [1, 5]) {
      const dt = steps / 60;
      const moved = full * dt;
      let speed = 0;
      let clips: ClipWeights = { idle: 1, walk: 0, run: 0 };
      for (let i = 0; i < 200; i += 1) {
        speed = smoothSpeed(speed, moved, dt);
        clips = fadeWeights(clips, speed, dt);
      }
      expect(speed).toBeCloseTo(full);
      expect(clips.run).toBe(1);
    }
  });

  it('has no speed without game time', () => {
    expect(smoothSpeed(2, 0.5, 0)).toBe(0);
  });

  it.each(['walk', 'run'] as const)(
    'plays the %s at 1 at its stride speed, within 0.5 and 2 either side',
    (gait) => {
      expect(clipRate(gait, STRIDE_SPEEDS[gait], 1)).toBeCloseTo(1);
      expect(clipRate(gait, 0, 1)).toBe(0.5);
      expect(clipRate(gait, 100, 1)).toBe(RATE_MAX);
    },
  );

  it('plays the idle at 1 whatever the speed', () => {
    expect(clipRate('idle', 0, 1)).toBe(1);
    expect(clipRate('idle', 5, 0.6)).toBe(1);
  });

  // The player's full speed, 2.34 m/s, is below the run's own pace for the full-size figure, and
  // the drawn avatar needs it played 1.25 times over: the run keeps pace.
  it('keeps the run in step with the ground at the player full speed', () => {
    const full = (MOVE_SPEED * 60) / 32;
    const rate = clipRate('run', full, AVATAR_SCALE);
    expect(rate).toBeCloseTo(full / (STRIDE_SPEEDS.run * AVATAR_SCALE));
    expect(rate).toBeLessThan(RATE_MAX);
    expect(rate).toBeCloseTo(1.25, 2);
    expect(clipRate('run', full, 1)).toBeCloseTo(0.875, 2);
  });
});

/** A motion at rest advanced by `dt`-second frames: `seconds` of it, with `step` filling in the rest of each frame's input. */
function run(
  seconds: number,
  step: Partial<MotionStep> & { speed?: number },
  from: Motion = AT_REST,
  clips: PlayerClips | undefined = playerClips(),
): Motion {
  const dt = 1 / 60;
  let motion = from;
  for (let i = 0; i < Math.round(seconds / dt); i += 1) {
    motion = advance(
      motion,
      {
        moved: (step.speed ?? 0) * dt,
        dt,
        carrying: false,
        avatarScale: 1,
        still: false,
        ...step,
      },
      clips,
    );
  }
  return motion;
}

/** The clips that have any say in a motion's layers, by layer: the clip names with weight above 0. */
function playing(motion: Motion, still = false): string[][] {
  return layersOf(motion, playerClips(), still).map((layer) =>
    layer.clips.filter(({ weight }) => weight > 0.001).map(({ clip }) => clip),
  );
}

describe('which clip plays', () => {
  it('is the idle for a body at rest, empty-handed', () => {
    expect(playing(run(1, {}))).toEqual([['idle']]);
  });

  it('is the walk at a walking pace', () => {
    expect(playing(run(1, { speed: WALK_FULL_SPEED }))).toEqual([['walk']]);
  });

  it('is the run at the full speed of the player', () => {
    expect(playing(run(1, { speed: (MOVE_SPEED * 60) / 32 }))).toEqual([['run']]);
  });

  it('puts the carry over the upper body once a tree is carried, the legs staying with the idle', () => {
    const still = run(1, { carrying: true });
    expect(playing(still)).toEqual([['idle'], ['hold']]);
    const layers = layersOf(still, playerClips(), false);
    expect(layers.map(({ mask, amount }) => [mask, amount])).toEqual([
      ['all', 1],
      ['upper', 1],
    ]);
  });

  it('keeps the legs on the walk and the run while a tree is carried', () => {
    expect(playing(run(1, { carrying: true, speed: WALK_FULL_SPEED }))).toEqual([
      ['walk'],
      ['hold'],
    ]);
    expect(playing(run(1, { carrying: true, speed: 3 }))).toEqual([['run'], ['hold']]);
  });

  it('fades the carry in and out over 0.2 s', () => {
    const half = run(0.1, { carrying: true });
    expect(half.carry).toBeCloseTo(0.5, 1);
    expect(run(0.1, { carrying: false }, run(1, { carrying: true })).carry).toBeCloseTo(0.5, 1);
    expect(playing(run(1, { carrying: false }, run(1, { carrying: true })))).toEqual([['idle']]);
  });

  it('holds the idle and carry clocks at their first pose with reduced motion', () => {
    const still = run(1, { carrying: true, still: true });
    expect(still.clocks.idle).toBe(0);
    expect(still.clocks.hold).toBe(0);
    expect(run(0.5, { carrying: true }).clocks.hold).toBeGreaterThan(0);
  });

  it('plays the interact clip once over the upper body, then goes back to the locomotion', () => {
    const clips = playerClips();
    const length = clip('Interact').duration;
    const started = { ...AT_REST, shot: startShot('interact') };
    const during = run(length / 2, {}, started);
    expect(playing(during)).toEqual([['idle'], ['interact']]);
    expect(layersOf(during, clips, false)[1]?.mask).toBe('upper');
    expect(playing(run(length + 0.1, {}, started))).toEqual([['idle']]);
    expect(run(length + 0.1, {}, started).shot).toBeUndefined();
  });

  it('plays the pick-up clip once over the upper body', () => {
    const length = clip('PickUp').duration;
    const started = { ...AT_REST, shot: startShot('pickUp') };
    expect(playing(run(length / 2, {}, started))).toEqual([['idle'], ['pickUp']]);
    expect(run(length + 0.1, {}, started).shot).toBeUndefined();
  });

  it('keeps the legs walking under a reach, and the reach does not stop the walk', () => {
    const walking = run(1, { speed: WALK_FULL_SPEED });
    const reaching = run(
      0.3,
      { speed: WALK_FULL_SPEED },
      { ...walking, shot: startShot('interact') },
    );
    expect(playing(reaching)).toEqual([['walk'], ['interact']]);
    expect(reaching.gait).not.toBe(walking.gait);
  });

  it('fades a reach in and out over 0.2 s', () => {
    const length = clip('PickUp').duration;
    const started = { ...AT_REST, shot: startShot('pickUp') };
    const amount = (motion: Motion): number =>
      layersOf(motion, playerClips(), false)[1]?.amount ?? 0;
    expect(amount(run(0.1, {}, started))).toBeCloseTo(0.5, 1);
    expect(amount(run(length / 2, {}, started))).toBe(1);
    expect(amount(run(length - 0.1, {}, started))).toBeCloseTo(0.5, 1);
  });

  it('lies down, lies still and stands up in that order over the whole body', () => {
    const lengths = [clip('Lie_Down').duration, LIE_IDLE_SECONDS, clip('Lie_StandUp').duration];
    const started = { ...AT_REST, shot: startShot('sleep') };
    const middle = (before: number, within: number): number => before + within / 2;
    const at = (seconds: number): string[][] => playing(run(seconds, {}, started));
    expect(at(middle(0, lengths[0] ?? 0))).toEqual([['idle'], ['lieDown']]);
    expect(at(middle(lengths[0] ?? 0, lengths[1] ?? 0))).toEqual([['idle'], ['lieIdle']]);
    expect(at(middle((lengths[0] ?? 0) + (lengths[1] ?? 0), lengths[2] ?? 0))).toEqual([
      ['idle'],
      ['lieStandUp'],
    ]);
    const total = lengths.reduce((sum, seconds) => sum + seconds, 0);
    expect(at(total + 0.1)).toEqual([['idle']]);
    expect(layersOf(run(0.5, {}, started), playerClips(), false)[1]?.mask).toBe('all');
  });

  it('runs a sleep for the lengths of its clips and the held Lie_Idle, fading only at its ends', () => {
    const clips = playerClips();
    const sleep = startShot('sleep', 3);
    expect(shotLength(sleep, clips)).toBeCloseTo(
      clip('Lie_Down').duration + 3 + clip('Lie_StandUp').duration,
    );
    const into = (elapsed: number) => shotAt({ ...sleep, elapsed }, clips);
    expect(into(clip('Lie_Down').duration)?.clip).toBe('lieIdle');
    expect(into(clip('Lie_Down').duration)?.amount).toBe(1);
    expect(into(clip('Lie_Down').duration + 1)?.time).toBeCloseTo(1);
    expect(into(shotLength(sleep, clips))).toBeUndefined();
  });

  it('takes the held lie from the page address, 1.5 s unless it is a number up to an hour', () => {
    expect(parseLieSeconds('')).toBe(LIE_IDLE_SECONDS);
    expect(parseLieSeconds('?lieSeconds=600')).toBe(600);
    for (const bad of ['?lieSeconds=x', '?lieSeconds=-1', '?lieSeconds=7200', '?lieSeconds=']) {
      expect(parseLieSeconds(bad)).toBe(LIE_IDLE_SECONDS);
    }
  });

  it('holds Lie_Idle at its first pose with reduced motion', () => {
    const lying = run(
      clip('Lie_Down').duration + 0.5,
      {},
      { ...AT_REST, shot: startShot('sleep') },
    );
    const time = (still: boolean): number | undefined =>
      layersOf(lying, playerClips(), still)[1]?.clips[0]?.time;
    expect(time(false)).toBeCloseTo(0.5, 1);
    expect(time(true)).toBe(0);
  });

  it('ignores a reach during any part of a sleep, and starts one otherwise', () => {
    const sleep = startShot('sleep', 3);
    const length = shotLength(sleep, playerClips());
    for (const elapsed of [0, 0.1, clip('Lie_Down').duration + 1, length - 0.1]) {
      const lying = { ...sleep, elapsed };
      for (const reach of ['interact', 'pickUp'] as const) {
        expect(startOver(lying, reach, 3)).toBe(lying);
      }
    }
    expect(startOver(undefined, 'interact', 3)).toEqual(startShot('interact', 3));
    expect(startOver(startShot('pickUp'), 'interact')).toEqual(startShot('interact'));
    expect(startOver(startShot('interact'), 'sleep', 3)).toEqual(sleep);
    expect(startOver({ ...sleep, elapsed: 1 }, 'sleep', 3)).toEqual(sleep);
    expect(startOver({ ...sleep, elapsed: 1 }, 'sit')).toEqual(startShot('sit'));
    expect(startOver(startShot('sit'), 'sit')).toEqual(startShot('sit'));
  });

  it('counts a sit as released from the moment it is told to end', () => {
    expect(released(undefined)).toBe(false);
    expect(released(startShot('sit'))).toBe(false);
    expect(released(release(startShot('sit')))).toBe(true);
    expect(released(release(startShot('sleep')))).toBe(false);
  });

  describe('a sit', () => {
    const down = clip('Sit_Chair_Down').duration;
    const standUp = clip('Sit_Chair_StandUp').duration;
    const sat = (seconds: number): Motion =>
      run(seconds, {}, { ...AT_REST, shot: startShot('sit') });
    const now = (motion: Motion): string | undefined =>
      motion.shot && shotAt(motion.shot, playerClips())?.clip;

    it('sits down, then holds Sit_Chair_Idle without end, over the whole body', () => {
      expect(now(sat(down / 2))).toBe('sitDown');
      expect(now(sat(down + 0.5))).toBe('sitIdle');
      expect(now(sat(600))).toBe('sitIdle');
      expect(shotLength(startShot('sit'), playerClips())).toBe(Infinity);
      expect(layersOf(sat(1), playerClips(), false)[1]?.mask).toBe('all');
    });

    it('stands up when released, then the shot ends', () => {
      const held = sat(down + 5);
      const released = run(0, {}, { ...held, shot: held.shot && release(held.shot) });
      expect(now(released)).toBe('sitStandUp');
      expect(now(run(standUp / 2, {}, released))).toBe('sitStandUp');
      expect(run(standUp + 0.1, {}, released).shot).toBeUndefined();
      expect(playing(run(standUp + 0.1, {}, released))).toEqual([['idle']]);
    });

    it('lets Sit_Chair_Down finish when released during it, then stands up with no idle between', () => {
      const early = sat(down / 2);
      const released = { ...early, shot: early.shot && release(early.shot) };
      expect(shotLength(released.shot ?? startShot('sit'), playerClips())).toBeCloseTo(
        down + standUp,
        2,
      );
      expect(now(run(down / 2 - 0.05, {}, released))).toBe('sitDown');
      expect(now(run(down / 2 + 0.1, {}, released))).toBe('sitStandUp');
    });

    it('is released once: a later release does not move the stand-up', () => {
      const first = release({ ...startShot('sit'), elapsed: 2 });
      expect(first.releasedAt).toBe(2);
      const later = { ...first, elapsed: 3 };
      expect(release(later)).toBe(later);
    });

    it('releases nothing but a sit', () => {
      const sleep = startShot('sleep');
      expect(release(sleep)).toBe(sleep);
    });

    it('fades in over the first 0.2 s and out over the last, the clips between running unfaded', () => {
      const clips = playerClips();
      const sit = release({ ...startShot('sit'), elapsed: 2 });
      const at = (elapsed: number) => shotAt({ ...sit, elapsed }, clips);
      expect(at(0.1)?.amount).toBeCloseTo(0.5, 5);
      expect(at(down)?.amount).toBe(1);
      expect(at(2 + standUp - 0.1)?.amount).toBeCloseTo(0.5, 5);
      expect(at(2 + standUp)).toBeUndefined();
    });

    it('moves the body from the standing spot to the seat over the sit-down and back over the stand-up', () => {
      const clips = playerClips();
      const sit = release({ ...startShot('sit'), elapsed: 2 });
      const blend = (elapsed: number): number => seatBlend({ ...sit, elapsed }, clips);
      expect(blend(0)).toBe(0);
      expect(blend(down / 2)).toBeCloseTo(0.5, 5);
      expect(blend(down)).toBe(1);
      expect(blend(1.5)).toBe(1);
      expect(blend(2 + standUp / 2)).toBeCloseTo(0.5, 5);
      expect(blend(2 + standUp)).toBe(0);
      expect(seatBlend(startShot('sleep'), clips)).toBe(0);
    });

    it('holds Sit_Chair_Idle at its first pose with reduced motion', () => {
      const seated = sat(down + 0.5);
      const time = (still: boolean): number | undefined =>
        layersOf(seated, playerClips(), still)[1]?.clips[0]?.time;
      expect(time(false)).toBeCloseTo(0.5, 1);
      expect(time(true)).toBe(0);
    });

    it('is replaced by another one-shot, which a sit never outlives', () => {
      expect(now({ ...sat(3), shot: startShot('sleep') })).toBe('lieDown');
    });
  });

  it('lets the locomotion go on under every one-shot, so the walk never stops', () => {
    const started = { ...AT_REST, shot: startShot('sleep') };
    expect(run(0.5, { speed: 1 }, started).gait).toBeGreaterThan(0);
  });
});

describe('the body mask', () => {
  it('takes the spine chain and the arms from the upper clips, and the hips and legs from the locomotion', () => {
    expect([...UPPER_BODY].sort()).toEqual(
      [
        'spine',
        'chest',
        'head',
        ...['upperarm', 'lowerarm', 'wrist', 'hand', 'handslot'].flatMap((b) => [
          `${b}.l`,
          `${b}.r`,
        ]),
      ].sort(),
    );
    for (const lower of ['root', 'hips', 'upperleg.l', 'lowerleg.r', 'foot.l', 'toes.r']) {
      expect(UPPER_BODY.has(lower)).toBe(false);
    }
  });

  it('names only bones the carry and the reaches key, and masks just those clips', () => {
    for (const name of ['Holding_A', 'Interact', 'PickUp']) {
      for (const bone of UPPER_BODY) expect([...clip(name).nodes.keys()]).toContain(bone);
    }
    expect(CLIP_NAMES.filter((name) => CLIP_MASKS[name] === 'upper')).toEqual([
      'hold',
      'interact',
      'pickUp',
    ]);
  });

  it('leaves the hips and legs to the walk while a tree is carried, and takes the arms from the carry', () => {
    const clips = playerClips();
    const walking = run(1, { carrying: true, speed: WALK_FULL_SPEED });
    const carried = poseOf(clips, layersOf(walking, clips, false));
    const bare = poseOf(clips, layersOf({ ...walking, carry: 0 }, clips, false));
    for (const bone of ['hips', 'upperleg.l', 'foot.r', 'root']) {
      expect(carried.get(bone)).toEqual(bare.get(bone));
    }
    for (const bone of ['upperarm.l', 'lowerarm.r']) {
      expect(carried.get(bone)?.rotation).not.toEqual(bare.get(bone)?.rotation);
    }
  });
});

describe('the avatar scale', () => {
  it('is a feel factor: the body is drawn at 70% of full size', () => {
    expect(AVATAR_SCALE).toBe(0.7);
  });

  it('scales the gait strides with the body, so the feet do not slide', () => {
    for (const gait of ['walk', 'run'] as const) {
      expect(clipRate(gait, STRIDE_SPEEDS[gait] * AVATAR_SCALE, AVATAR_SCALE)).toBeCloseTo(1);
      expect(clipRate(gait, STRIDE_SPEEDS[gait] * AVATAR_SCALE, AVATAR_SCALE)).toBeCloseTo(
        clipRate(gait, STRIDE_SPEEDS[gait], 1),
      );
    }
  });
});
