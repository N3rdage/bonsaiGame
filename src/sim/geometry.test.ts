import { describe, expect, it } from 'vitest';
import type { BonsaiTree, Branch, TrunkMovement } from './types';
import {
  BRANCH_BEND_PER_CLICK,
  DISPLAY_SCALE,
  TRUNK_BEND_PER_EVENT,
  branchFrameAt,
  branchPoint,
  trunkFrameAt,
  trunkFrames,
} from './geometry';
import { darccos, dcos, dsin, vec3Length } from './vec3';

function makeTree(trunk: Partial<BonsaiTree['trunk']> = {}, branches: Branch[] = []): BonsaiTree {
  return {
    id: 0,
    speciesKey: 'juniper',
    origin: 'cutting',
    name: 'Test',
    ageDays: 0,
    vitality: 100,
    vigor: 50,
    waterLevel: 100,
    lastWateredDay: 1,
    lastFedDay: 1,
    fertilizedUntilDay: 0,
    potTier: 0,
    soilTier: 0,
    lastRepotDay: 0,
    location: 'shed',
    timeAccel: 1,
    trunk: { heightCm: 20, girthMm: 10, taper: 0.5, movement: [], ...trunk },
    branches,
    foliageDensity: 0.5,
    wiresApplied: [],
    clipsHistory: [],
    prunesHistory: [],
    repotsHistory: [],
    styleTags: [],
    targetStyle: '',
    revision: 0,
  };
}

function makeBranch(over: Partial<Branch> = {}): Branch {
  return {
    id: 0,
    parentId: -1,
    originY: 10,
    angle: 0,
    length: 8,
    girth: 3,
    wired: false,
    bend: 0,
    bendV: 0,
    ...over,
  };
}

function leanOf(z: number): number {
  return darccos(z);
}

describe('constants', () => {
  it('match the prototype macros', () => {
    expect(DISPLAY_SCALE).toBe(4);
    expect(TRUNK_BEND_PER_EVENT).toBe(20);
    expect(BRANCH_BEND_PER_CLICK).toBe(15);
  });
});

describe('trunkFrames', () => {
  it('samples max(8, floor(arc * 20)) + 1 frames', () => {
    // 20 cm -> arc 0.8 -> 16 segments
    expect(trunkFrames(makeTree({ heightCm: 20 }))).toHaveLength(17);
    // 5 cm -> arc 0.2 -> floor(4) -> clamped to 8 segments
    expect(trunkFrames(makeTree({ heightCm: 5 }))).toHaveLength(9);
  });

  it('runs a straight trunk up +z with total arc = heightCm/100*4', () => {
    const frames = trunkFrames(makeTree({ heightCm: 30 }));
    for (const f of frames) {
      expect(f.tangent).toEqual({ x: 0, y: 0, z: 1 });
      expect(f.normal).toEqual({ x: 1, y: 0, z: 0 });
      expect(f.binormal).toEqual({ x: 0, y: 1, z: 0 });
      expect(f.pos.x).toBe(0);
      expect(f.pos.y).toBe(0);
    }
    expect(frames[0]?.pos.z).toBe(0);
    expect(frames[frames.length - 1]?.pos.z).toBeCloseTo((30 / 100) * 4, 10);
  });

  it('tilts the tangent by exactly 20 degrees for one event at y=0 toward angle 0', () => {
    const frames = trunkFrames(makeTree({ movement: [{ y: 0, angleDeg: 0 }] }));
    const t = frames[0]?.tangent;
    expect(t).toBeDefined();
    if (!t) return;
    expect(leanOf(t.z)).toBeCloseTo(20, 9);
    // Leans toward +x (angle 0)
    expect(t.x).toBeCloseTo(dsin(20), 12);
    expect(t.y).toBeCloseTo(0, 12);
  });

  it('composes two same-direction events to 40 degrees', () => {
    const frames = trunkFrames(
      makeTree({
        movement: [
          { y: 0, angleDeg: 90 },
          { y: 0, angleDeg: 90 },
        ],
      }),
    );
    const t = frames[frames.length - 1]?.tangent;
    expect(t).toBeDefined();
    if (!t) return;
    expect(leanOf(t.z)).toBeCloseTo(40, 9);
    expect(t.y).toBeCloseTo(dsin(40), 12);
  });

  it('only applies an event once the arc reaches its height', () => {
    const frames = trunkFrames(makeTree({ heightCm: 20, movement: [{ y: 10, angleDeg: 0 }] }));
    // 16 segments over 20 cm: frame 8 sits at 10 cm.
    expect(frames[7]?.tangent).toEqual({ x: 0, y: 0, z: 1 });
    expect(leanOf(frames[8]?.tangent.z ?? 1)).toBeCloseTo(20, 9);
  });

  it('sorts events by height before applying them', () => {
    const a: TrunkMovement[] = [
      { y: 15, angleDeg: 90 },
      { y: 5, angleDeg: 0 },
    ];
    const b: TrunkMovement[] = [
      { y: 5, angleDeg: 0 },
      { y: 15, angleDeg: 90 },
    ];
    expect(trunkFrames(makeTree({ movement: a }))).toEqual(trunkFrames(makeTree({ movement: b })));
  });

  it('carries the trunk past horizontal so the tip descends (cascade)', () => {
    const movement: TrunkMovement[] = [];
    for (let y = 0; y <= 35; y += 5) movement.push({ y, angleDeg: 0 });
    const frames = trunkFrames(makeTree({ heightCm: 50, movement }));
    const zs = frames.map((f) => f.pos.z);
    const peak = Math.max(...zs);
    const last = zs[zs.length - 1] ?? 0;
    expect(last).toBeLessThan(peak);
    // 8 events = 160 degrees: tangent points mostly downward.
    const tip = frames[frames.length - 1]?.tangent;
    expect(leanOf(tip?.z ?? 1)).toBeCloseTo(160, 9);
    expect(tip?.z ?? 0).toBeLessThan(0);
  });

  it('keeps frames orthonormal through bends', () => {
    const frames = trunkFrames(
      makeTree({
        movement: [
          { y: 3, angleDeg: 30 },
          { y: 9, angleDeg: 200 },
        ],
      }),
    );
    for (const f of frames) {
      expect(vec3Length(f.tangent)).toBeCloseTo(1, 10);
      expect(vec3Length(f.normal)).toBeCloseTo(1, 10);
      expect(vec3Length(f.binormal)).toBeCloseTo(1, 10);
    }
  });
});

describe('trunkFrameAt', () => {
  const tree = makeTree({ movement: [{ y: 6, angleDeg: 45 }] });
  const frames = trunkFrames(tree);

  it('returns the first and last frames at t=0 and t=1', () => {
    expect(trunkFrameAt(tree, 0)).toEqual(frames[0]);
    const last = frames[frames.length - 1];
    const at1 = trunkFrameAt(tree, 1);
    expect(at1.pos).toEqual(last?.pos);
    expect(at1.tangent.z).toBeCloseTo(last?.tangent.z ?? 0, 12);
  });

  it('clamps t outside [0, 1]', () => {
    expect(trunkFrameAt(tree, -1)).toEqual(trunkFrameAt(tree, 0));
    expect(trunkFrameAt(tree, 2)).toEqual(trunkFrameAt(tree, 1));
  });

  it('interpolates position at t=0.5 on a straight trunk', () => {
    const straight = makeTree({ heightCm: 20 });
    const mid = trunkFrameAt(straight, 0.5);
    expect(mid.pos.z).toBeCloseTo(0.4, 12);
    expect(mid.tangent).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('lerps between neighbouring samples and renormalises', () => {
    // 16 segments: t = 1.5/16 is halfway between frames 1 and 2.
    const f = trunkFrameAt(tree, 1.5 / 16);
    const a = frames[1];
    const b = frames[2];
    expect(f.pos.z).toBeCloseTo(((a?.pos.z ?? 0) + (b?.pos.z ?? 0)) / 2, 12);
    expect(vec3Length(f.tangent)).toBeCloseTo(1, 12);
  });
});

describe('branchPoint', () => {
  it('starts exactly trunkRadius from the trunk axis on an unbent trunk', () => {
    const branch = makeBranch({ originY: 10, angle: 30 });
    const tree = makeTree({ heightCm: 20, girthMm: 10, taper: 0.5 }, [branch]);
    const p = branchPoint(tree, branch, 0);
    const baseR = (10 / 1000 / 2) * 4;
    const trunkR = baseR + (baseR * 0.5 - baseR) * 0.5;
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(trunkR, 12);
    expect(p.x).toBeCloseTo(trunkR * dcos(30), 12);
    expect(p.y).toBeCloseTo(trunkR * dsin(30), 12);
    expect(p.z).toBeCloseTo((10 / 100) * 4, 12);
  });

  it('with bend=0 ends length/100*4 along the attachment direction plus 0.25 lift', () => {
    const branch = makeBranch({ originY: 10, angle: 60, length: 8 });
    const tree = makeTree({}, [branch]);
    const p0 = branchPoint(tree, branch, 0);
    const p1 = branchPoint(tree, branch, 1);
    const l = (8 / 100) * 4;
    expect(p1.x - p0.x).toBeCloseTo(l * dcos(60), 12);
    expect(p1.y - p0.y).toBeCloseTo(l * dsin(60), 12);
    expect(p1.z - p0.z).toBeCloseTo(l * 0.25, 12);
  });

  it('follows a circular arc for horizontal bend', () => {
    const branch = makeBranch({ angle: 0, length: 10, bend: 90 });
    const tree = makeTree({}, [branch]);
    const p0 = branchPoint(tree, branch, 0);
    const p1 = branchPoint(tree, branch, 1);
    const l = 0.4;
    const r = (l / 90) * (180 / Math.PI);
    // Quarter circle starting along +x, curling toward +y.
    expect(p1.x - p0.x).toBeCloseTo(r, 12);
    expect(p1.y - p0.y).toBeCloseTo(r, 12);
    expect(p1.z - p0.z).toBeCloseTo(l * 0.25, 12);
  });

  it('is continuous between the bendV=0 and bendV!=0 code paths', () => {
    const flat = makeBranch({ angle: 40, length: 12, bend: 30, bendV: 0 });
    const tiny = { ...flat, bendV: 1e-4 };
    const tree = makeTree({}, [flat]);
    for (const t of [0.25, 0.5, 1]) {
      const a = branchPoint(tree, flat, t);
      const b = branchPoint(tree, tiny, t);
      expect(b.x).toBeCloseTo(a.x, 4);
      expect(b.y).toBeCloseTo(a.y, 4);
      expect(b.z).toBeCloseTo(a.z, 4);
    }
  });

  it('positive bendV lifts the branch tip', () => {
    const flat = makeBranch({ angle: 0, length: 10, bendV: 0.0 });
    const up = { ...flat, bendV: 45 };
    const tree = makeTree({}, [flat]);
    expect(branchPoint(tree, up, 1).z).not.toBeCloseTo(branchPoint(tree, flat, 1).z, 3);
  });
});

describe('branchFrameAt', () => {
  const tree = makeTree();

  it('returns a unit tangent for horizontal and mixed bends', () => {
    for (const over of [
      { bend: 0, bendV: 0 },
      { bend: 45, bendV: 0 },
      { bend: 30, bendV: 30 },
      { bend: -15, bendV: -60 },
    ]) {
      const branch = makeBranch({ angle: 75, ...over });
      for (const t of [0, 0.5, 1]) {
        const f = branchFrameAt(tree, branch, t);
        expect(vec3Length(f.tangent)).toBeCloseTo(1, 12);
        expect(vec3Length(f.normal)).toBeCloseTo(1, 12);
        expect(vec3Length(f.binormal)).toBeCloseTo(1, 12);
      }
    }
  });

  it('uses branchPoint for its position', () => {
    const branch = makeBranch({ angle: 10, bend: 20, bendV: 10 });
    expect(branchFrameAt(tree, branch, 0.7).pos).toEqual(branchPoint(tree, branch, 0.7));
  });

  it('agrees between code paths at a tiny bendV', () => {
    const flat = makeBranch({ angle: 40, bend: 30, bendV: 0 });
    const tiny = { ...flat, bendV: 1e-4 };
    const a = branchFrameAt(tree, flat, 0.5);
    const b = branchFrameAt(tree, tiny, 0.5);
    expect(b.tangent.x).toBeCloseTo(a.tangent.x, 5);
    expect(b.tangent.y).toBeCloseTo(a.tangent.y, 5);
    expect(b.tangent.z).toBeCloseTo(a.tangent.z, 5);
    expect(b.normal.x).toBeCloseTo(a.normal.x, 5);
    expect(b.binormal.z).toBeCloseTo(a.binormal.z, 5);
  });
});
