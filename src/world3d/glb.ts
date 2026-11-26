/**
 * A reader for the animation clips of a binary glTF (GLB) file: its JSON
 * chunk, and each animation's rotation and translation keys per node, by the
 * node's name, as plain arrays. Pure, no Babylon, so the player's clips are
 * read from the committed file in tests exactly as the game reads them.
 * Scale keys are not read: the KayKit clips hold every bone's scale at 1.
 */

/** The parts of a glTF's JSON the reader uses. */
export interface GltfJson {
  readonly nodes?: readonly { readonly name?: string }[];
  readonly accessors?: readonly {
    readonly bufferView?: number;
    readonly byteOffset?: number;
    readonly componentType: number;
    readonly count: number;
    readonly type: string;
    readonly min?: readonly number[];
    readonly max?: readonly number[];
  }[];
  readonly bufferViews?: readonly {
    readonly byteOffset?: number;
    readonly byteLength: number;
    readonly byteStride?: number;
  }[];
  readonly animations?: readonly {
    readonly name?: string;
    readonly channels: readonly {
      readonly sampler: number;
      readonly target: { readonly node?: number; readonly path: string };
    }[];
    readonly samplers: readonly {
      readonly input: number;
      readonly output: number;
      readonly interpolation?: string;
    }[];
  }[];
}

/** A GLB's JSON and its binary chunk. */
export interface Glb {
  readonly json: GltfJson;
  readonly bin: DataView;
}

const MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const FLOAT = 5126;
const WIDTH: Readonly<Record<string, number>> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/** The JSON and binary chunks of a GLB file's bytes. */
export function readGlb(data: ArrayBuffer): Glb {
  const view = new DataView(data);
  if (view.getUint32(0, true) !== MAGIC) throw new Error('not a GLB file');
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== JSON_CHUNK) throw new Error('GLB has no JSON chunk first');
  const json = JSON.parse(
    new TextDecoder().decode(new Uint8Array(data, 20, jsonLength)),
  ) as GltfJson;
  const at = 20 + jsonLength;
  const hasBin = at + 8 <= data.byteLength && view.getUint32(at + 4, true) === BIN_CHUNK;
  const bin = new DataView(data, hasBin ? at + 8 : 0, hasBin ? view.getUint32(at, true) : 0);
  return { json, bin };
}

/** A float accessor's values, flattened (stride-aware). */
export function accessorFloats(glb: Glb, index: number): Float32Array {
  const accessor = glb.json.accessors?.[index];
  const view = glb.json.bufferViews?.[accessor?.bufferView ?? -1];
  if (!accessor || !view || accessor.componentType !== FLOAT) {
    throw new Error(`accessor ${String(index)} is not a float array in a buffer view`);
  }
  const width = WIDTH[accessor.type] ?? 1;
  const stride = view.byteStride ?? width * 4;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const out = new Float32Array(accessor.count * width);
  for (let i = 0; i < accessor.count; i++) {
    for (let k = 0; k < width; k++) {
      out[i * width + k] = glb.bin.getFloat32(start + i * stride + k * 4, true);
    }
  }
  return out;
}

/** One node's keyed motion: a time for each key, and the key values flattened (4 a key for a rotation, 3 for a translation). */
export interface Track {
  readonly times: Float32Array;
  readonly values: Float32Array;
}

/** What a clip keys on one node. */
export interface NodeTracks {
  readonly rotation?: Track;
  readonly translation?: Track;
}

/** An animation clip: its length in seconds and its tracks by node name. */
export interface Clip {
  readonly duration: number;
  readonly nodes: ReadonlyMap<string, NodeTracks>;
}

/** Every animation in `glb` by name, as linearly interpolated rotation and translation tracks. */
export function readClips(glb: Glb): Map<string, Clip> {
  const clips = new Map<string, Clip>();
  for (const animation of glb.json.animations ?? []) {
    const nodes = new Map<string, { rotation?: Track; translation?: Track }>();
    let duration = 0;
    for (const { sampler, target } of animation.channels) {
      const path = target.path;
      if (path !== 'rotation' && path !== 'translation') continue;
      const keys = animation.samplers[sampler];
      const name = glb.json.nodes?.[target.node ?? -1]?.name;
      if (!keys || name === undefined) continue;
      if ((keys.interpolation ?? 'LINEAR') !== 'LINEAR') {
        throw new Error(`${animation.name ?? ''}: only linear keys are read`);
      }
      const times = accessorFloats(glb, keys.input);
      duration = Math.max(duration, times[times.length - 1] ?? 0);
      const tracks = nodes.get(name) ?? {};
      tracks[path] = { times, values: accessorFloats(glb, keys.output) };
      nodes.set(name, tracks);
    }
    clips.set(animation.name ?? '', { duration, nodes });
  }
  return clips;
}
