import { describe, expect, it } from 'vitest';
import { trunkFrames } from '../sim/geometry';
import { darccos } from '../sim/vec3';
import { buildTreeMesh } from './treeMesh';
import { VIEWER_FIXTURES, isViewerFixtureKey } from './viewerFixtures';

const vertices = (key: keyof typeof VIEWER_FIXTURES): number =>
  buildTreeMesh(VIEWER_FIXTURES[key]()).positions.length / 3;

describe('viewer fixtures', () => {
  it('recognises only the fixture keys', () => {
    expect(isViewerFixtureKey('cutting')).toBe(true);
    expect(isViewerFixtureKey('bent')).toBe(true);
    expect(isViewerFixtureKey('cascade')).toBe(true);
    expect(isViewerFixtureKey('starter')).toBe(false);
    expect(isViewerFixtureKey('toString')).toBe(false);
    expect(isViewerFixtureKey(null)).toBe(false);
  });

  it('cutting is a fresh, unwired juniper cutting', () => {
    const tree = VIEWER_FIXTURES.cutting();
    expect(tree.speciesKey).toBe('juniper');
    expect(tree.trunk.heightCm).toBe(8);
    expect(tree.trunk.movement).toEqual([]);
    expect(tree.branches).toHaveLength(2);
    // 8 trunk segments x 10 x 2 + 2 branches x 6 x 6 x 2 = 304 triangles (e2e pins this too).
    expect(vertices('cutting')).toBe(912);
  });

  it('bent is the starter with two -135 degree trunk bends, leaning into the (-x, -y) quadrant', () => {
    const tree = VIEWER_FIXTURES.bent();
    expect(tree.trunk.heightCm).toBe(25);
    expect(tree.trunk.girthMm).toBe(18);
    expect(tree.branches).toHaveLength(4);
    expect(tree.trunk.movement).toEqual([
      { y: 5, angleDeg: -135 },
      { y: 12, angleDeg: -135 },
    ]);
    const tip = trunkFrames(tree).at(-1);
    expect(darccos(tip?.tangent.z ?? 1)).toBeCloseTo(40, 9);
    expect(tip?.pos.x ?? 0).toBeLessThan(0);
    expect(tip?.pos.y ?? 0).toBeLessThan(0);
    // Same topology as the starter: 688 triangles.
    expect(vertices('bent')).toBe(2064);
  });

  it('cascade carries the trunk past horizontal so the tip descends below the soil line', () => {
    const tree = VIEWER_FIXTURES.cascade();
    expect(tree.trunk.heightCm).toBe(45);
    expect(tree.trunk.movement.map((m) => m.y)).toEqual([0, 5, 10, 15, 20, 25, 30, 35]);
    expect(tree.trunk.movement.every((m) => m.angleDeg === -135)).toBe(true);
    const frames = trunkFrames(tree);
    const tip = frames.at(-1);
    // 8 events x 20 degrees: the tangent points 160 degrees from straight up.
    expect(darccos(tip?.tangent.z ?? 1)).toBeCloseTo(160, 9);
    expect(tip?.pos.z ?? 0).toBeLessThan(0);
    // Inside the default framing: target z 0.9, distance 2.5, fov 60 sees about 1.44 either side.
    for (const f of frames) expect(Math.abs(f.pos.z - 0.9)).toBeLessThan(1.2);
    // 45 cm -> arc 1.8 -> 36 segments: 36 x 10 x 2 + 4 x 72 = 1008 triangles.
    expect(vertices('cascade')).toBe(3024);
  });
});
