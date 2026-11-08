import { describe, expect, it } from 'vitest';
import { trunkFrames } from '../sim/geometry';
import { SEASONS, type Season } from '../sim/seasons';
import { createNewGameState } from '../sim/state';
import type { BonsaiTree } from '../sim/types';
import { darccos } from '../sim/vec3';
import { branchCarriesFoliage, buildFoliageMesh } from './foliageMesh';
import { buildTreeMesh } from './treeMesh';
import {
  MAPLE_BRANCHES,
  MAPLE_HEIGHT_CM,
  VIEWER_FIXTURES,
  isViewerFixtureKey,
} from './viewerFixtures';

const vertices = (key: keyof typeof VIEWER_FIXTURES): number =>
  buildTreeMesh(VIEWER_FIXTURES[key]()).positions.length / 3;

describe('viewer fixtures', () => {
  it('recognises only the fixture keys', () => {
    expect(isViewerFixtureKey('cutting')).toBe(true);
    expect(isViewerFixtureKey('bent')).toBe(true);
    expect(isViewerFixtureKey('cascade')).toBe(true);
    expect(isViewerFixtureKey('maple')).toBe(true);
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
    expect(tree.trunk.heightCm).toBe(30);
    expect(tree.trunk.movement.map((m) => m.y)).toEqual([0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20]);
    expect(tree.trunk.movement.every((m) => m.angleDeg === -135)).toBe(true);
    const frames = trunkFrames(tree);
    const tip = frames.at(-1);
    // 9 events x 20 degrees = 180: the tangent points straight down.
    expect(tip?.tangent.z ?? 0).toBeCloseTo(-1, 9);
    // The last 10 cm (0.4 units) hang below the soil line.
    expect(tip?.pos.z ?? 0).toBeLessThan(-0.3);
    // Inside the default framing: target z 0.6, distance 2.5, fov 60 sees about 1.44 above and below.
    for (const f of frames) expect(Math.abs(f.pos.z - 0.6)).toBeLessThan(1.2);
    // Inside the portrait phone frame (about 0.65 units either side at yaw 45):
    // the 0.57-unit sweep along (-1,-1) is 0.40 per axis.
    for (const f of frames) {
      expect(Math.abs(f.pos.x)).toBeLessThan(0.46);
      expect(Math.abs(f.pos.y)).toBeLessThan(0.46);
    }
    // 30 cm -> arc 1.2 -> 24 segments: 24 x 10 x 2 + 4 x 72 = 768 triangles.
    expect(vertices('cascade')).toBe(2304);
  });

  it('maple is a young seed-grown maple with three branches above the foliage gate', () => {
    const tree = VIEWER_FIXTURES.maple();
    expect(tree.speciesKey).toBe('maple');
    expect(tree.origin).toBe('seed');
    expect(tree.trunk.heightCm).toBe(MAPLE_HEIGHT_CM);
    expect(tree.foliageDensity).toBe(0.5);
    expect(tree.branches.map((b) => b.originY)).toEqual(MAPLE_BRANCHES.map(([y]) => y));
    expect(tree.branches.every((b) => branchCarriesFoliage(tree, b))).toBe(true);
    // 20 cm -> arc 0.8 -> 16 segments: 16 x 10 x 2 + 3 x 72 = 536 triangles.
    expect(vertices('maple')).toBe(1608);
  });
});

// The e2e suite pins the same counts through window.__bonsai.viewer.foliageVertices.
describe('viewer fixture foliage', () => {
  const foliage = (tree: BonsaiTree, season: Season): number =>
    buildFoliageMesh(tree, season).positions.length / 3;

  it('the starter juniper (four branches above the gate, density 0.5) leafs out in every season', () => {
    const tree = createNewGameState().trees[0];
    if (!tree) throw new Error('no starter');
    expect(tree.foliageDensity).toBe(0.5);
    // 4 branches x 7 leaves x 12 vertices.
    for (const season of SEASONS) expect(foliage(tree, season)).toBe(336);
  });

  it('maple is bare in winter and carries 3 clusters of 7 leaves in autumn', () => {
    expect(foliage(VIEWER_FIXTURES.maple(), 'winter')).toBe(0);
    expect(foliage(VIEWER_FIXTURES.maple(), 'autumn')).toBe(252);
  });

  it('cutting, bent and cascade foliage counts', () => {
    // Cutting: 2 branches (3 and 5 of 8 cm), density 0.25 -> 5 leaves.
    expect(foliage(VIEWER_FIXTURES.cutting(), 'spring')).toBe(2 * 5 * 12);
    expect(foliage(VIEWER_FIXTURES.bent(), 'spring')).toBe(336);
    // Cascade: at 30 cm the 8 cm branch sits at 0.27, below the gate.
    expect(foliage(VIEWER_FIXTURES.cascade(), 'spring')).toBe(3 * 7 * 12);
  });
});
