/**
 * The heavy engine spike's character (backlog #391): a rounded, skinned
 * gardener with an `idle` and a `walk` clip, built here as a binary glTF 2.0
 * (GLB) so both engines load the same bytes through their own glTF loaders.
 * Seven joints (hips, spine, head, two legs, two arms), capsule and sphere
 * body parts each bound whole to one joint, keyframed rotations for the
 * clips. Pure: no engine import, no file, no third-party model.
 *
 * Space: metres, y up, the character faces +z, its feet on y 0, 1.82 m tall.
 */

import { ellipsoid, type Vec3 } from './curved';

export const JOINT_NAMES = ['hips', 'spine', 'head', 'legL', 'legR', 'armL', 'armR'] as const;
export type JointName = (typeof JOINT_NAMES)[number];
export const CLIP_NAMES = ['idle', 'walk'] as const;
export type ClipName = (typeof CLIP_NAMES)[number];

/** Where each joint sits in the bind pose, world metres, and its parent. */
const SKELETON: Readonly<Record<JointName, { at: Vec3; parent: JointName | undefined }>> = {
  hips: { at: { x: 0, y: 0.9, z: 0 }, parent: undefined },
  spine: { at: { x: 0, y: 1, z: 0 }, parent: 'hips' },
  head: { at: { x: 0, y: 1.5, z: 0 }, parent: 'spine' },
  legL: { at: { x: -0.1, y: 0.9, z: 0 }, parent: 'hips' },
  legR: { at: { x: 0.1, y: 0.9, z: 0 }, parent: 'hips' },
  armL: { at: { x: -0.24, y: 1.4, z: 0 }, parent: 'spine' },
  armR: { at: { x: 0.24, y: 1.4, z: 0 }, parent: 'spine' },
};

type Rgb = readonly [number, number, number];
const SKIN: Rgb = [0.87, 0.67, 0.53];
const SHIRT: Rgb = [0.35, 0.58, 0.45];
const TROUSERS: Rgb = [0.3, 0.36, 0.5];
const SHOE: Rgb = [0.25, 0.2, 0.18];

interface Part {
  readonly joint: JointName;
  readonly center: Vec3;
  readonly radii: Vec3;
  readonly stretch?: number;
  readonly color: Rgb;
}

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

const PARTS: readonly Part[] = [
  { joint: 'hips', center: v(0, 0.95, 0), radii: v(0.18, 0.13, 0.14), color: TROUSERS },
  { joint: 'spine', center: v(0, 1.22, 0), radii: v(0.2, 0.16, 0.13), stretch: 0.08, color: SHIRT },
  { joint: 'head', center: v(0, 1.67, 0), radii: v(0.14, 0.16, 0.15), color: SKIN },
  { joint: 'head', center: v(0, 1.65, 0.15), radii: v(0.03, 0.03, 0.03), color: SKIN },
  {
    joint: 'legL',
    center: v(-0.1, 0.45, 0),
    radii: v(0.075, 0.08, 0.075),
    stretch: 0.3,
    color: TROUSERS,
  },
  { joint: 'legL', center: v(-0.1, 0.05, 0.05), radii: v(0.08, 0.05, 0.13), color: SHOE },
  {
    joint: 'legR',
    center: v(0.1, 0.45, 0),
    radii: v(0.075, 0.08, 0.075),
    stretch: 0.3,
    color: TROUSERS,
  },
  { joint: 'legR', center: v(0.1, 0.05, 0.05), radii: v(0.08, 0.05, 0.13), color: SHOE },
  {
    joint: 'armL',
    center: v(-0.24, 1.14, 0),
    radii: v(0.055, 0.06, 0.055),
    stretch: 0.2,
    color: SHIRT,
  },
  { joint: 'armL', center: v(-0.24, 0.84, 0), radii: v(0.05, 0.05, 0.05), color: SKIN },
  {
    joint: 'armR',
    center: v(0.24, 1.14, 0),
    radii: v(0.055, 0.06, 0.055),
    stretch: 0.2,
    color: SHIRT,
  },
  { joint: 'armR', center: v(0.24, 0.84, 0), radii: v(0.05, 0.05, 0.05), color: SKIN },
];

/** A key of a clip: its time in seconds and the value (a quaternion, or a translation for the hips' bob). */
interface Track {
  readonly joint: JointName;
  readonly path: 'rotation' | 'translation';
  readonly times: readonly number[];
  readonly values: readonly (readonly number[])[];
}

interface Clip {
  readonly name: ClipName;
  readonly tracks: readonly Track[];
}

/** A rotation of `angle` radians about an axis, as a glTF quaternion. */
const turn = (axis: 'x' | 'y' | 'z', angle: number): number[] => {
  const s = Math.sin(angle / 2);
  const c = Math.cos(angle / 2);
  return axis === 'x' ? [s, 0, 0, c] : axis === 'y' ? [0, s, 0, c] : [0, 0, s, c];
};

/** A looping swing about `axis` through `amplitude` and back, `phase` quarter turns in. */
function swing(
  joint: JointName,
  axis: 'x' | 'y' | 'z',
  amplitude: number,
  period: number,
  phase: number,
): Track {
  const pattern = [0, 1, 0, -1, 0];
  const times = [0, 1, 2, 3, 4].map((k) => (k * period) / 4);
  const values = [0, 1, 2, 3, 4].map((k) =>
    turn(axis, amplitude * (pattern[(k + phase) % 4] ?? 0)),
  );
  return { joint, path: 'rotation', times, values };
}

const IDLE_PERIOD = 3;
const WALK_PERIOD = 1;
const HIPS_HEIGHT = SKELETON.hips.at.y;

const CLIPS: readonly Clip[] = [
  {
    name: 'idle',
    tracks: [
      swing('spine', 'x', 0.025, IDLE_PERIOD, 0),
      swing('head', 'y', 0.12, IDLE_PERIOD, 1),
      swing('armL', 'z', 0.04, IDLE_PERIOD, 0),
      swing('armR', 'z', -0.04, IDLE_PERIOD, 0),
    ],
  },
  {
    name: 'walk',
    tracks: [
      swing('legL', 'x', 0.6, WALK_PERIOD, 1),
      swing('legR', 'x', -0.6, WALK_PERIOD, 1),
      swing('armL', 'x', -0.5, WALK_PERIOD, 1),
      swing('armR', 'x', 0.5, WALK_PERIOD, 1),
      swing('spine', 'y', 0.1, WALK_PERIOD, 1),
      {
        joint: 'hips',
        path: 'translation',
        times: [0, 1, 2, 3, 4].map((k) => (k * WALK_PERIOD) / 4),
        values: [0, 0.03, 0, 0.03, 0].map((bob) => [0, HIPS_HEIGHT - bob, 0]),
      },
    ],
  },
];

/** A character skinned and animated: the glTF's JSON and its one binary buffer. */
export interface CharacterGltf {
  readonly json: Record<string, unknown>;
  readonly bin: Uint8Array;
}

/** Packs typed arrays into one buffer, 4-byte aligned, with a bufferView and accessor for each. */
class Packer {
  readonly chunks: Uint8Array[] = [];
  readonly bufferViews: Record<string, unknown>[] = [];
  readonly accessors: Record<string, unknown>[] = [];
  private length = 0;

  add(
    data: Float32Array | Uint16Array | Uint8Array,
    componentType: number,
    type: string,
    options: { target?: number; bounds?: boolean } = {},
  ): number {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4);
    padded.set(bytes);
    const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type] ?? 1;
    this.bufferViews.push({
      buffer: 0,
      byteOffset: this.length,
      byteLength: bytes.length,
      ...(options.target ? { target: options.target } : {}),
    });
    const accessor: Record<string, unknown> = {
      bufferView: this.bufferViews.length - 1,
      componentType,
      count: data.length / width,
      type,
    };
    if (options.bounds) {
      const mins = Array.from({ length: width }, () => Infinity);
      const maxs = Array.from({ length: width }, () => -Infinity);
      data.forEach((value, i) => {
        const k = i % width;
        mins[k] = Math.min(mins[k] ?? Infinity, value);
        maxs[k] = Math.max(maxs[k] ?? -Infinity, value);
      });
      accessor.min = mins;
      accessor.max = maxs;
    }
    this.accessors.push(accessor);
    this.chunks.push(padded);
    this.length += padded.length;
    return this.accessors.length - 1;
  }

  bin(): Uint8Array {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }
}

const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const UNSIGNED_BYTE = 5121;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

/** The character as glTF 2.0 JSON plus its binary buffer. */
export function buildCharacterGltf(): CharacterGltf {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const joints: number[] = [];
  const indices: number[] = [];
  for (const part of PARTS) {
    const mesh = ellipsoid({ ...part, rings: 8, segments: 12 });
    const first = positions.length / 3;
    positions.push(...mesh.positions);
    normals.push(...mesh.normals);
    for (let i = 0; i < mesh.positions.length / 3; i++) {
      colors.push(...part.color);
      joints.push(JOINT_NAMES.indexOf(part.joint), 0, 0, 0);
    }
    for (const index of mesh.indices) indices.push(first + index);
  }
  const vertices = positions.length / 3;
  const weights = new Float32Array(vertices * 4);
  for (let i = 0; i < vertices; i++) weights[i * 4] = 1;

  const pack = new Packer();
  const attributes = {
    POSITION: pack.add(new Float32Array(positions), FLOAT, 'VEC3', {
      target: ARRAY_BUFFER,
      bounds: true,
    }),
    NORMAL: pack.add(new Float32Array(normals), FLOAT, 'VEC3', { target: ARRAY_BUFFER }),
    COLOR_0: pack.add(new Float32Array(colors), FLOAT, 'VEC3', { target: ARRAY_BUFFER }),
    JOINTS_0: pack.add(new Uint8Array(joints), UNSIGNED_BYTE, 'VEC4', { target: ARRAY_BUFFER }),
    WEIGHTS_0: pack.add(weights, FLOAT, 'VEC4', { target: ARRAY_BUFFER }),
  };
  const indexAccessor = pack.add(new Uint16Array(indices), UNSIGNED_SHORT, 'SCALAR', {
    target: ELEMENT_ARRAY_BUFFER,
  });

  // The inverse bind matrices: each joint's bind pose is a pure translation to its position.
  const inverseBind = new Float32Array(JOINT_NAMES.length * 16);
  JOINT_NAMES.forEach((name, i) => {
    const { x, y, z } = SKELETON[name].at;
    inverseBind.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1], i * 16);
  });
  const inverseBindAccessor = pack.add(inverseBind, FLOAT, 'MAT4');

  // Node 0 carries the skinned mesh; joint nodes follow in JOINT_NAMES order.
  const jointNode = (name: JointName): number => 1 + JOINT_NAMES.indexOf(name);
  const nodes: Record<string, unknown>[] = [{ name: 'body', mesh: 0, skin: 0 }];
  for (const name of JOINT_NAMES) {
    const { at, parent } = SKELETON[name];
    const base = parent ? SKELETON[parent].at : { x: 0, y: 0, z: 0 };
    const children = JOINT_NAMES.filter((child) => SKELETON[child].parent === name).map(jointNode);
    nodes.push({
      name,
      translation: [at.x - base.x, at.y - base.y, at.z - base.z],
      ...(children.length > 0 ? { children } : {}),
    });
  }

  const animations = CLIPS.map((clip) => {
    const samplers: Record<string, unknown>[] = [];
    const channels: Record<string, unknown>[] = [];
    for (const track of clip.tracks) {
      const input = pack.add(new Float32Array(track.times), FLOAT, 'SCALAR', { bounds: true });
      const output = pack.add(
        new Float32Array(track.values.flat()),
        FLOAT,
        track.path === 'rotation' ? 'VEC4' : 'VEC3',
      );
      samplers.push({ input, output, interpolation: 'LINEAR' });
      channels.push({
        sampler: samplers.length - 1,
        target: { node: jointNode(track.joint), path: track.path },
      });
    }
    return { name: clip.name, samplers, channels };
  });

  const bin = pack.bin();
  return {
    json: {
      asset: { version: '2.0', generator: 'bonsai engine spike' },
      scene: 0,
      scenes: [{ nodes: [0, jointNode('hips')] }],
      nodes,
      meshes: [
        { name: 'gardener', primitives: [{ attributes, indices: indexAccessor, material: 0 }] },
      ],
      materials: [
        { name: 'gardener', pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 1 } },
      ],
      skins: [
        {
          name: 'gardener',
          joints: JOINT_NAMES.map(jointNode),
          skeleton: jointNode('hips'),
          inverseBindMatrices: inverseBindAccessor,
        },
      ],
      animations,
      buffers: [{ byteLength: bin.length }],
      bufferViews: pack.bufferViews,
      accessors: pack.accessors,
    },
    bin,
  };
}

/** The character as a GLB file: a header, the JSON chunk and the binary chunk. */
export function buildCharacterGlb(): ArrayBuffer {
  const { json, bin } = buildCharacterGltf();
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jsonBytes = new Uint8Array(Math.ceil(text.length / 4) * 4).fill(0x20);
  jsonBytes.set(text);
  const total = 12 + 8 + jsonBytes.length + 8 + bin.length;
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(jsonBytes, 20);
  const binAt = 20 + jsonBytes.length;
  view.setUint32(binAt, bin.length, true);
  view.setUint32(binAt + 4, 0x004e4942, true);
  bytes.set(bin, binAt + 8);
  return out;
}

/** The speed, metres a second, at which the walk clip's feet do not slide. */
export const STRIDE_SPEED = 2.3;
/** Seconds a change between idle and walk takes. */
const FADE_SECONDS = 0.2;

/** The walk clip's weight after `dt` seconds with the walker at `speed`: it eases to 1 moving and 0 standing (idle takes the rest). */
export function walkWeight(current: number, speed: number, dt: number): number {
  const target = speed > 0.05 ? 1 : 0;
  const step = dt / FADE_SECONDS;
  return current < target ? Math.min(target, current + step) : Math.max(target, current - step);
}

/** How fast the walk clip plays at `speed`: 1 at the stride speed, never below 0.5 so a slow start still reads as walking. */
export function walkRate(speed: number): number {
  return Math.max(0.5, Math.min(2, speed / STRIDE_SPEED));
}
