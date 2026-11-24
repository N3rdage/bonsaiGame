import { describe, expect, it } from 'vitest';
import {
  CHARACTER_HEIGHT,
  CLIP_NAMES,
  GARDENER_PALETTE,
  JOINT_NAMES,
  STRIDE_SPEED,
  WALK_FULL_SPEED,
  characterMesh,
  clipDuration,
  fadeWeights,
  jointAt,
  parentOf,
  poseOf,
  restOffset,
  smoothSpeed,
  targetWeights,
  walkRate,
} from './character';
import { MOVE_SPEED } from '../world/player';

describe('the skeleton', () => {
  it('has seven joints under one root, hips', () => {
    expect(JOINT_NAMES).toHaveLength(7);
    const roots = JOINT_NAMES.filter((joint) => parentOf(joint) === undefined);
    expect(roots).toEqual(['hips']);
  });

  it('hangs the spine and legs from the hips, the head and arms from the spine', () => {
    expect(parentOf('spine')).toBe('hips');
    expect(parentOf('legL')).toBe('hips');
    expect(parentOf('legR')).toBe('hips');
    expect(parentOf('head')).toBe('spine');
    expect(parentOf('armL')).toBe('spine');
    expect(parentOf('armR')).toBe('spine');
  });

  it('places each joint at its parent plus its rest offset', () => {
    for (const joint of JOINT_NAMES) {
      const parent = parentOf(joint);
      const base = parent ? jointAt(parent) : [0, 0, 0];
      const offset = restOffset(joint);
      jointAt(joint).forEach((value, i) => {
        expect(value).toBeCloseTo((base[i] ?? 0) + (offset[i] ?? 0));
      });
    }
  });
});

describe('the body', () => {
  const mesh = characterMesh();
  const vertices = mesh.positions.length / 3;

  it('stands 1.6 to 1.8 m tall with its feet on the ground', () => {
    let low = Infinity;
    let high = -Infinity;
    for (let i = 1; i < mesh.positions.length; i += 3) {
      low = Math.min(low, mesh.positions[i] ?? 0);
      high = Math.max(high, mesh.positions[i] ?? 0);
    }
    expect(low).toBeCloseTo(0, 5);
    expect(high).toBeCloseTo(CHARACTER_HEIGHT, 5);
    expect(CHARACTER_HEIGHT).toBeGreaterThanOrEqual(1.6);
    expect(CHARACTER_HEIGHT).toBeLessThanOrEqual(1.8);
  });

  it('weights every vertex wholly to one of the seven joints', () => {
    for (let v = 0; v < vertices; v++) {
      expect(mesh.weights[v * 4]).toBe(1);
      expect(mesh.weights[v * 4 + 1]).toBe(0);
      const joint = mesh.joints[v * 4] ?? -1;
      expect(Number.isInteger(joint)).toBe(true);
      expect(joint).toBeGreaterThanOrEqual(0);
      expect(joint).toBeLessThan(JOINT_NAMES.length);
    }
  });

  it('has unit normals and indices inside the vertex arrays', () => {
    for (let v = 0; v < vertices; v++) {
      const [x = 0, y = 0, z = 0] = mesh.normals.slice(v * 3, v * 3 + 3);
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5);
    }
    expect(Math.max(...mesh.indices)).toBe(vertices - 1);
    expect(mesh.colors).toHaveLength(vertices * 4);
  });

  it('stands about 1.7 to 1.75 m with its bun, bun and boots included', () => {
    expect(CHARACTER_HEIGHT).toBeGreaterThanOrEqual(1.7);
    expect(CHARACTER_HEIGHT).toBeLessThanOrEqual(1.75);
  });

  it('is 38 parts of 117 vertices each', () => {
    expect(vertices).toBe(38 * 117);
    expect(mesh.indices).toHaveLength(38 * 8 * 12 * 6);
  });

  it('binds the vertices to the joints they follow: limbs below their pivots, the head above its own', () => {
    const count = [0, 0, 0, 0, 0, 0, 0];
    for (let v = 0; v < vertices; v++) {
      const joint = JOINT_NAMES[mesh.joints[v * 4] ?? -1] ?? 'hips';
      const y = mesh.positions[v * 3 + 1] ?? 0;
      count[mesh.joints[v * 4] ?? 0] = (count[mesh.joints[v * 4] ?? 0] ?? 0) + 1;
      if (joint === 'legL' || joint === 'legR') expect(y).toBeLessThan(jointAt(joint)[1]);
      if (joint === 'armL' || joint === 'armR') expect(y).toBeLessThan(jointAt(joint)[1]);
      if (joint === 'head') expect(y).toBeGreaterThan(jointAt('head')[1] * 0.8);
    }
    expect(Object.fromEntries(JOINT_NAMES.map((j, i) => [j, (count[i] ?? 0) / 117]))).toEqual({
      hips: 4,
      spine: 4,
      head: 18,
      legL: 3,
      legR: 3,
      armL: 3,
      armR: 3,
    });
  });

  it('paints the same every build, within the colour range, lit from above', () => {
    expect(characterMesh().colors).toEqual(mesh.colors);
    expect(Math.min(...mesh.colors)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...mesh.colors)).toBeLessThanOrEqual(1);
    // The first part's top pole is lighter than its bottom one (ring 0 is the bottom).
    const top = mesh.colors[8 * 13 * 4] ?? 0;
    const bottom = mesh.colors[0] ?? 0;
    expect(top).toBeGreaterThan(bottom);
  });
});

describe('the gardener', () => {
  it('wears the painterly palette', () => {
    expect(GARDENER_PALETTE).toEqual({
      skin: 0xeab48c,
      hair: 0x2e2a2e,
      sprig: 0xe8c470,
      leaf: 0x7ab85a,
      band: 0x3a6a8a,
      shirt: 0xd2604a,
      apron: 0xe8d8b4,
      trousers: 0x3a4a6a,
      boots: 0x5a3828,
      scarf: 0xf0d080,
      cheek: 0xf08070,
      eye: 0x1e1a1e,
      handle: 0x8a5a3a,
    });
  });
});

describe('the clips', () => {
  it('are idle and walk, looping over 3 s and 1 s', () => {
    expect(CLIP_NAMES).toEqual(['idle', 'walk']);
    expect(clipDuration('idle')).toBe(3);
    expect(clipDuration('walk')).toBe(1);
  });

  it('swing the legs apart in the walk and not in the idle', () => {
    const times = { idle: 0, walk: 0 };
    const walking = poseOf({ idle: 0, walk: 1 }, times);
    expect(walking.legL.rotation[0]).toBeGreaterThan(0.2);
    expect(walking.legR.rotation[0]).toBeLessThan(-0.2);
    const standing = poseOf({ idle: 1, walk: 0 }, times);
    expect(standing.legL.rotation[0]).toBe(0);
  });

  it('keep every rotation a unit quaternion and loop seamlessly', () => {
    const weights = { idle: 0.4, walk: 0.6 };
    const pose = poseOf(weights, { idle: 0.7, walk: 0.3 });
    for (const joint of JOINT_NAMES) {
      expect(Math.hypot(...pose[joint].rotation)).toBeCloseTo(1, 6);
    }
    const start = poseOf(weights, { idle: 0, walk: 0 });
    const end = poseOf(weights, { idle: 3, walk: 1 });
    expect(end.legL.rotation[0]).toBeCloseTo(start.legL.rotation[0], 6);
  });

  it('bob the hips in the walk and leave the others at their rest offsets', () => {
    const rest = restOffset('spine');
    const pose = poseOf({ idle: 0, walk: 1 }, { idle: 0, walk: 0.25 });
    expect(pose.spine.translation).toEqual(rest);
    expect(pose.hips.translation[1]).toBeLessThan(restOffset('hips')[1]);
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

  it('puts the player at full walking speed near the stride speed', () => {
    const full = (MOVE_SPEED * 60) / 32;
    expect(walkRate(full)).toBeGreaterThan(0.9);
    expect(walkRate(full)).toBeLessThan(1.2);
  });
});
