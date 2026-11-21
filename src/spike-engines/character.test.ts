import { describe, expect, it } from 'vitest';
import {
  CLIP_NAMES,
  JOINT_NAMES,
  STRIDE_SPEED,
  buildCharacterGlb,
  buildCharacterGltf,
  walkRate,
  walkWeight,
} from './character';

interface Accessor {
  count: number;
  type: string;
  bufferView: number;
}
interface Json {
  nodes: { name: string; children?: number[] }[];
  skins: { joints: number[]; inverseBindMatrices: number }[];
  accessors: Accessor[];
  bufferViews: { byteOffset: number; byteLength: number }[];
  buffers: { byteLength: number }[];
  meshes: { primitives: { attributes: Record<string, number>; indices: number }[] }[];
  animations: {
    name: string;
    samplers: { input: number; output: number }[];
    channels: { sampler: number; target: { node: number; path: string } }[];
  }[];
}

const gltf = buildCharacterGltf();
const json = gltf.json as unknown as Json;

describe('the character glTF', () => {
  it('has one skin with seven joints under the hips', () => {
    expect(json.skins).toHaveLength(1);
    expect(json.skins[0]?.joints).toHaveLength(JOINT_NAMES.length);
    expect(json.skins[0]?.joints.map((n) => json.nodes[n]?.name)).toEqual([...JOINT_NAMES]);
    const hips = json.nodes[json.skins[0]?.joints[0] ?? 0];
    expect(hips?.children).toHaveLength(3);
  });

  it('has one inverse bind matrix per joint', () => {
    const accessor = json.accessors[json.skins[0]?.inverseBindMatrices ?? 0];
    expect(accessor?.type).toBe('MAT4');
    expect(accessor?.count).toBe(JOINT_NAMES.length);
  });

  it('has matching counts across the skinned primitive', () => {
    const primitive = json.meshes[0]?.primitives[0];
    const counts = ['POSITION', 'NORMAL', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0'].map(
      (name) => json.accessors[primitive?.attributes[name] ?? -1]?.count,
    );
    expect(new Set(counts).size).toBe(1);
    expect(counts[0]).toBeGreaterThan(500);
    expect(json.accessors[primitive?.indices ?? -1]?.count).toBeGreaterThan(1000);
  });

  it('names the idle and walk clips and gives each sampler equal key counts', () => {
    expect(json.animations.map((a) => a.name)).toEqual([...CLIP_NAMES]);
    for (const clip of json.animations) {
      expect(clip.channels.length).toBeGreaterThan(2);
      for (const sampler of clip.samplers) {
        const times = json.accessors[sampler.input]?.count ?? 0;
        expect(times).toBeGreaterThan(1);
        const out = json.accessors[sampler.output];
        expect(out?.count).toBe(times);
      }
    }
    const walk = json.animations.find((a) => a.name === 'walk');
    const paths = new Set(walk?.channels.map((c) => c.target.path));
    expect(paths).toEqual(new Set(['rotation', 'translation']));
  });

  it('keeps every bufferView inside the buffer', () => {
    const length = json.buffers[0]?.byteLength ?? 0;
    expect(length).toBe(gltf.bin.length);
    for (const view of json.bufferViews) {
      expect(view.byteOffset % 4).toBe(0);
      expect(view.byteOffset + view.byteLength).toBeLessThanOrEqual(length);
    }
  });
});

describe('the character GLB', () => {
  it('has the glTF magic, version 2, a JSON chunk and a binary chunk', () => {
    const glb = buildCharacterGlb();
    const view = new DataView(glb);
    expect(view.getUint32(0, true)).toBe(0x46546c67);
    expect(view.getUint32(4, true)).toBe(2);
    expect(view.getUint32(8, true)).toBe(glb.byteLength);
    const jsonLength = view.getUint32(12, true);
    expect(view.getUint32(16, true)).toBe(0x4e4f534a);
    expect(jsonLength % 4).toBe(0);
    const parsed = JSON.parse(
      new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength)),
    ) as Json;
    expect(parsed.animations).toHaveLength(2);
    const binAt = 20 + jsonLength;
    expect(view.getUint32(binAt + 4, true)).toBe(0x004e4942);
    expect(view.getUint32(binAt, true)).toBe(gltf.bin.length);
  });
});

describe('the walk blend', () => {
  it('eases the walk weight up while moving and down when stopped', () => {
    expect(walkWeight(0, 1.6, 0.1)).toBeCloseTo(0.5);
    expect(walkWeight(0.9, 1.6, 0.1)).toBe(1);
    expect(walkWeight(1, 0, 0.1)).toBeCloseTo(0.5);
    expect(walkWeight(0.2, 0, 0.1)).toBe(0);
  });

  it('plays the walk at the stride speed at rate 1 and clamps it', () => {
    expect(walkRate(STRIDE_SPEED)).toBe(1);
    expect(walkRate(0.1)).toBe(0.5);
    expect(walkRate(99)).toBe(2);
  });
});
