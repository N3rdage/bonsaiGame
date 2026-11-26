import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ANIMATION_CLIPS,
  BODY_MODEL_HEIGHT,
  BODY_SCALE,
  CHARACTER_HEIGHT,
  PLAYER_CLIPS,
  STRIDE_SPEED,
  WALK_FOOT_SPEED,
  WALK_FULL_SPEED,
  fadeWeights,
  poseOf,
  sampleTrack,
  smoothSpeed,
  targetWeights,
  walkRate,
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

describe('the player files', () => {
  it('play Idle_A at rest and Walking_A on the move', () => {
    expect(PLAYER_CLIPS).toEqual({ idle: 'Idle_A', walk: 'Walking_A' });
  });

  it('carry every clip the player needs, and no others', () => {
    expect([...clips.keys()].sort()).toEqual([...ANIMATION_CLIPS].sort());
    expect(clip('Idle_A').duration).toBeCloseTo(1.0667, 3);
    expect(clip('Walking_A').duration).toBeCloseTo(1.0667, 3);
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

describe('the walk', () => {
  it('slides a planted foot back at WALK_FOOT_SPEED model units a second, so the stride speed is that in metres', () => {
    const walk = clip(PLAYER_CLIPS.walk);
    const steps = 96;
    const dt = walk.duration / steps;
    const path = Array.from({ length: steps }, (_, i) => boneAt(walk, 'foot.l', i * dt));
    const lowest = Math.min(...path.map(([, y]) => y));
    const speeds = path
      .map((at, i) => [at, path[(i + 1) % steps] ?? at] as const)
      .filter(([a, b]) => a[1] - lowest < 0.015 && b[1] - lowest < 0.015)
      .map(([a, b]) => (a[2] - b[2]) / dt)
      .sort((a, b) => a - b);
    const median = speeds[speeds.length >> 1] ?? 0;
    expect(median / WALK_FOOT_SPEED).toBeGreaterThan(0.95);
    expect(median / WALK_FOOT_SPEED).toBeLessThan(1.05);
    expect(STRIDE_SPEED).toBeCloseTo(WALK_FOOT_SPEED * BODY_SCALE, 9);
    expect(STRIDE_SPEED).toBeCloseTo(0.54, 2);
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

  it('mixes the clips by weight: translations as a weighted mean, rotations normalised', () => {
    const idle = testClip(3, [0, 1], [0, 0, 0, 0, 0, 0], 1);
    const walk = testClip(3, [0, 1], [4, 0, 0, 4, 0, 0], 1);
    const times = { idle: 0.3, walk: 0.6 };
    expect(
      poseOf({ idle, walk }, { idle: 0.75, walk: 0.25 }, times).get('bone')?.translation,
    ).toEqual([1, 0, 0]);
    const still = testClip(4, [0, 1], [0, 0, 0, 1, 0, 0, 0, 1], 1);
    const turned = testClip(4, [0, 1], [0, s, 0, s, 0, s, 0, s], 1);
    const [, y = 0, , w = 0] =
      poseOf({ idle: still, walk: turned }, { idle: 0.5, walk: 0.5 }, times).get('bone')
        ?.rotation ?? [];
    expect(2 * Math.atan2(y, w)).toBeCloseTo(Math.PI / 4);
    expect(
      poseOf({ idle: still, walk: turned }, { idle: 1, walk: 0 }, times).get('bone')?.rotation,
    ).toEqual([0, 0, 0, 1]);
  });

  it('poses each bone of the real clips with a unit rotation, all idle at rest', () => {
    const pose = poseOf(
      { idle: clip(PLAYER_CLIPS.idle), walk: clip(PLAYER_CLIPS.walk) },
      { idle: 1, walk: 0 },
      { idle: 0.5, walk: 0 },
    );
    expect(pose.size).toBeGreaterThan(20);
    for (const { rotation } of pose.values()) {
      expect(Math.hypot(...(rotation ?? [0, 0, 0, 1]))).toBeCloseTo(1);
    }
  });
});

describe('the blend', () => {
  it('is all idle at rest', () => {
    expect(targetWeights(0)).toEqual({ idle: 1, walk: 0 });
  });

  it('is half and half at half the walk speed', () => {
    expect(targetWeights(WALK_FULL_SPEED / 2)).toEqual({ idle: 0.5, walk: 0.5 });
  });

  it('is all walk at the full speed of the player and beyond', () => {
    const full = (MOVE_SPEED * 60) / 32;
    expect(targetWeights(full)).toEqual({ idle: 0, walk: 1 });
    expect(targetWeights(10)).toEqual({ idle: 0, walk: 1 });
  });

  it('cross-fades over 0.2 s and stops at the target', () => {
    const rest = { idle: 1, walk: 0 };
    const half = fadeWeights(rest, 2, 0.1);
    expect(half.walk).toBeCloseTo(0.5);
    expect(half.idle).toBeCloseTo(0.5);
    expect(fadeWeights(half, 2, 1)).toEqual({ idle: 0, walk: 1 });
    expect(fadeWeights({ idle: 0, walk: 1 }, 0, 0.1).walk).toBeCloseTo(0.5);
    expect(fadeWeights({ idle: 0.9, walk: 0.1 }, 0, 1)).toEqual({ idle: 1, walk: 0 });
  });

  it('reads the pace of the game time the steps covered, however slow the frame was', () => {
    const full = (MOVE_SPEED * 60) / 32;
    // Five steps a frame, then one step a frame: the same pace on the game's clock.
    for (const steps of [1, 5]) {
      const dt = steps / 60;
      const moved = full * dt;
      let speed = 0;
      let clips = { idle: 1, walk: 0 };
      for (let i = 0; i < 200; i += 1) {
        speed = smoothSpeed(speed, moved, dt);
        clips = fadeWeights(clips, speed, dt);
      }
      expect(speed).toBeCloseTo(full);
      expect(clips.walk).toBe(1);
    }
  });

  it('has no speed without game time', () => {
    expect(smoothSpeed(2, 0.5, 0)).toBe(0);
  });

  it('plays the walk at 1 at the stride speed, within 0.5 and 2 either side', () => {
    expect(walkRate(STRIDE_SPEED)).toBeCloseTo(1);
    expect(walkRate(0)).toBe(0.5);
    expect(walkRate(100)).toBe(2);
  });

  // The player's full speed, 2.34 m/s, is over four times the walk's own pace: the clip plays at
  // its fastest and the feet cover half the ground they would need to (see ARCHITECTURE.md).
  it('plays the walk at its fastest at the player full speed', () => {
    const full = (MOVE_SPEED * 60) / 32;
    expect(full / STRIDE_SPEED).toBeGreaterThan(4);
    expect(walkRate(full)).toBe(2);
  });
});
