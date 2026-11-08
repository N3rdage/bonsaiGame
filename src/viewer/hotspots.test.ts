import { describe, expect, it } from 'vitest';
import { branchPoint, trunkFrameAt } from '../sim/geometry';
import { createNewGameState } from '../sim/state';
import type { BonsaiTree, Branch, Vec3 } from '../sim/types';
import {
  BEND_SIGN_PROBE_DEG,
  BRANCH_HOTSPOT_T,
  CLIP_HOTSPOT_COLOR,
  HOTSPOT_ALPHA,
  HOTSPOT_ALPHA_HOVER,
  HOTSPOT_HIT_RADIUS,
  HOTSPOT_RADIUS,
  HOTSPOT_RADIUS_HOVER,
  PRUNE_HOTSPOT_COLOR,
  TRUNK_HOTSPOT_COLOR,
  TRUNK_HOTSPOT_COUNT,
  TRUNK_HOTSPOT_T_HI,
  TRUNK_HOTSPOT_T_LO,
  UI_STRIP_HEIGHT,
  UI_STRIP_HEIGHT_WIRE,
  WIRE_BEND_UNWIRED_HOTSPOT_COLOR,
  WIRE_BEND_WIRED_HOTSPOT_COLOR,
  WIRE_REMOVE_HOTSPOT_COLOR,
  bendAxis,
  branchBendSign,
  branchBendTarget,
  createViewerUiState,
  hotspotWorldPoints,
  trunkBendWorldAngle,
  uiStripHeight,
  type ViewerUiState,
} from './hotspots';
import { VIEWER_FIXTURES, WIRED_BRANCH_ID } from './viewerFixtures';

function starter(): BonsaiTree {
  const tree = createNewGameState().trees[0];
  if (!tree) throw new Error('new game has no starter tree');
  return tree;
}

function ui(overrides: Partial<ViewerUiState>): ViewerUiState {
  return { ...createViewerUiState(), ...overrides };
}

function firstBranch(tree: BonsaiTree): Branch {
  const branch = tree.branches[0];
  if (!branch) throw new Error('tree has no branches');
  return branch;
}

describe('viewer ui constants', () => {
  // archive/gamemaker/objects/obj_viewer_3d: Create_0, Step_0, Draw_64.
  it('pins the prototype numbers', () => {
    expect(UI_STRIP_HEIGHT).toBe(60);
    expect(UI_STRIP_HEIGHT_WIRE).toBe(110);
    expect(BRANCH_HOTSPOT_T).toBe(0.7);
    expect(TRUNK_HOTSPOT_COUNT).toBe(4);
    expect(TRUNK_HOTSPOT_T_LO).toBe(0.2);
    expect(TRUNK_HOTSPOT_T_HI).toBe(0.8);
    expect(HOTSPOT_RADIUS).toBe(8);
    expect(HOTSPOT_RADIUS_HOVER).toBe(12);
    expect(HOTSPOT_HIT_RADIUS).toBe(16);
    expect(HOTSPOT_ALPHA).toBe(0.6);
    expect(HOTSPOT_ALPHA_HOVER).toBe(0.9);
    expect(BEND_SIGN_PROBE_DEG).toBe(5);
  });

  it('pins the hotspot colours', () => {
    expect(CLIP_HOTSPOT_COLOR).toEqual({ r: 255, g: 200, b: 80 });
    expect(PRUNE_HOTSPOT_COLOR).toEqual({ r: 255, g: 100, b: 100 });
    expect(WIRE_REMOVE_HOTSPOT_COLOR).toEqual({ r: 255, g: 130, b: 40 });
    expect(WIRE_BEND_WIRED_HOTSPOT_COLOR).toEqual({ r: 255, g: 180, b: 80 });
    expect(WIRE_BEND_UNWIRED_HOTSPOT_COLOR).toEqual({ r: 100, g: 200, b: 255 });
    expect(TRUNK_HOTSPOT_COLOR).toEqual({ r: 120, g: 220, b: 140 });
  });

  it('starts in view mode, bending left, with both wire filters on', () => {
    expect(createViewerUiState()).toEqual({
      mode: 'view',
      wireAction: 'bend',
      bendDir: 'left',
      showWired: true,
      showUnwired: true,
    });
  });

  it('uses the taller strip only in wire mode', () => {
    expect(uiStripHeight('view')).toBe(60);
    expect(uiStripHeight('clip')).toBe(60);
    expect(uiStripHeight('prune')).toBe(60);
    expect(uiStripHeight('wire')).toBe(110);
  });
});

describe('hotspotWorldPoints', () => {
  const kinds = (hs: ReturnType<typeof hotspotWorldPoints>): string[] =>
    hs.map((h) => `${h.kind}${String(h.id)}`);

  it('shows nothing in view mode', () => {
    expect(hotspotWorldPoints(starter(), ui({ mode: 'view' }))).toEqual([]);
  });

  it('puts one hotspot per branch in clip and prune modes, labelled by index', () => {
    const tree = starter();
    for (const mode of ['clip', 'prune'] as const) {
      const hs = hotspotWorldPoints(tree, ui({ mode }));
      expect(kinds(hs)).toEqual(['branch0', 'branch1', 'branch2', 'branch3']);
      expect(hs.map((h) => h.label)).toEqual(['0', '1', '2', '3']);
    }
  });

  it('places branch hotspots 70% along each branch', () => {
    const tree = starter();
    const hs = hotspotWorldPoints(tree, ui({ mode: 'clip' }));
    tree.branches.forEach((branch, i) => {
      expect(hs[i]?.world).toEqual(branchPoint(tree, branch, 0.7));
    });
  });

  it('adds four trunk hotspots at 20-80% of the trunk in wire + bend', () => {
    const tree = starter();
    const hs = hotspotWorldPoints(tree, ui({ mode: 'wire' }));
    expect(kinds(hs)).toEqual([
      'branch0',
      'branch1',
      'branch2',
      'branch3',
      'trunk0',
      'trunk1',
      'trunk2',
      'trunk3',
    ]);
    const trunk = hs.filter((h) => h.kind === 'trunk');
    [0.2, 0.4, 0.6, 0.8].forEach((t, i) => {
      const pos = trunkFrameAt(tree, t).pos;
      const world = trunk[i]?.world;
      expect(world?.x).toBeCloseTo(pos.x, 12);
      expect(world?.y).toBeCloseTo(pos.y, 12);
      expect(world?.z).toBeCloseTo(pos.z, 12);
    });
    // The starter's trunk is 25 cm: heights in whole cm.
    expect(trunk.map((h) => h.label)).toEqual(['5', '10', '15', '20']);
  });

  it('rounds trunk labels to whole cm', () => {
    const tree = starter();
    tree.trunk.heightCm = 27;
    const labels = hotspotWorldPoints(tree, ui({ mode: 'wire' }))
      .filter((h) => h.kind === 'trunk')
      .map((h) => h.label);
    // 5.4, 10.8, 16.2, 21.6
    expect(labels).toEqual(['5', '11', '16', '22']);
  });

  it('filters wire hotspots as the prototype did', () => {
    const tree = VIEWER_FIXTURES.wired();
    const branchIds = (overrides: Partial<ViewerUiState>): number[] =>
      hotspotWorldPoints(tree, ui({ mode: 'wire', ...overrides }))
        .filter((h) => h.kind === 'branch')
        .map((h) => h.id);
    expect(branchIds({})).toEqual([0, 1, 2, 3]);
    expect(branchIds({ wireAction: 'remove' })).toEqual([WIRED_BRANCH_ID]);
    expect(branchIds({ showWired: false })).toEqual([0, 2, 3]);
    expect(branchIds({ showUnwired: false })).toEqual([WIRED_BRANCH_ID]);
    // Remove ignores the filters and never shows trunk hotspots.
    const remove = hotspotWorldPoints(
      tree,
      ui({ mode: 'wire', wireAction: 'remove', showWired: false }),
    );
    expect(kinds(remove)).toEqual(['branch1']);
  });

  it('ignores the wire filters outside wire mode', () => {
    const tree = VIEWER_FIXTURES.wired();
    const hs = hotspotWorldPoints(tree, ui({ mode: 'clip', showWired: false, showUnwired: false }));
    expect(hs).toHaveLength(4);
  });

  it('colours hotspots by mode, action and wired state', () => {
    const tree = VIEWER_FIXTURES.wired();
    const colors = (overrides: Partial<ViewerUiState>): unknown[] =>
      hotspotWorldPoints(tree, ui(overrides)).map((h) => h.color);
    expect(colors({ mode: 'clip' })).toEqual(Array(4).fill(CLIP_HOTSPOT_COLOR));
    expect(colors({ mode: 'prune' })).toEqual(Array(4).fill(PRUNE_HOTSPOT_COLOR));
    expect(colors({ mode: 'wire', wireAction: 'remove' })).toEqual([WIRE_REMOVE_HOTSPOT_COLOR]);
    expect(colors({ mode: 'wire' })).toEqual([
      WIRE_BEND_UNWIRED_HOTSPOT_COLOR,
      WIRE_BEND_WIRED_HOTSPOT_COLOR,
      WIRE_BEND_UNWIRED_HOTSPOT_COLOR,
      WIRE_BEND_UNWIRED_HOTSPOT_COLOR,
      ...Array<unknown>(4).fill(TRUNK_HOTSPOT_COLOR),
    ]);
  });
});

describe('trunkBendWorldAngle', () => {
  it('maps screen directions to world angles at yaw 0', () => {
    expect(trunkBendWorldAngle('right', 0)).toBe(-90);
    expect(trunkBendWorldAngle('left', 0)).toBe(90);
    expect(trunkBendWorldAngle('up', 0)).toBe(180);
    expect(trunkBendWorldAngle('down', 0)).toBe(-0);
  });

  it('maps screen directions to world angles at yaw 45', () => {
    // Right at yaw 45 is world (-1,-1,0), the fixtures' SCREEN_RIGHT_ANGLE.
    expect(trunkBendWorldAngle('right', 45)).toBe(-135);
    expect(trunkBendWorldAngle('left', 45)).toBe(45);
    expect(trunkBendWorldAngle('up', 45)).toBe(135);
    expect(trunkBendWorldAngle('down', 45)).toBe(-45);
  });
});

describe('branchBendSign', () => {
  // The starter's first branch leaves at 30 degrees, unbent. +bend sweeps it
  // counter-clockwise round world +z, so its tip's x falls; +bendV lifts it.
  const screenX = (p: Vec3): { x: number; y: number } => ({ x: p.x, y: 0 });
  const screenUp = (p: Vec3): { x: number; y: number } => ({ x: 0, y: -p.z });

  it('picks the horizontal sign from the tip motion', () => {
    const tree = starter();
    const branch = firstBranch(tree);
    expect(branchBendSign(tree, branch, 'right', 'h', screenX)).toBe(-1);
    expect(branchBendSign(tree, branch, 'left', 'h', screenX)).toBe(1);
  });

  it('picks the vertical sign from the tip motion, screen y down', () => {
    const tree = starter();
    const branch = firstBranch(tree);
    expect(branchBendSign(tree, branch, 'up', 'v', screenUp)).toBe(1);
    expect(branchBendSign(tree, branch, 'down', 'v', screenUp)).toBe(-1);
  });

  it('falls back to +1 when the tip does not project', () => {
    const tree = starter();
    const branch = firstBranch(tree);
    expect(branchBendSign(tree, branch, 'right', 'h', () => undefined)).toBe(1);
    let calls = 0;
    const secondOff = (p: Vec3): { x: number; y: number } | undefined =>
      calls++ === 0 ? screenX(p) : undefined;
    expect(branchBendSign(tree, branch, 'right', 'h', secondOff)).toBe(1);
  });

  it('never changes the real branch or the tree', () => {
    const tree = starter();
    const branch = firstBranch(tree);
    const before = JSON.stringify(tree);
    branchBendSign(tree, branch, 'up', 'v', screenUp);
    branchBendSign(tree, branch, 'right', 'h', screenX);
    expect(JSON.stringify(tree)).toBe(before);
  });
});

describe('branchBendTarget', () => {
  // Draw_64 `_draw_branch_hotspots`: delta = sign * 15 on the axis the
  // direction names; the other bend is passed through unchanged.
  const branch = { ...firstBranch(starter()), bend: 40, bendV: -10 };

  it('bends vertically for up and down, leaving bend alone', () => {
    expect(bendAxis('up')).toBe('v');
    expect(bendAxis('down')).toBe('v');
    expect(branchBendTarget(branch, 'up', 1)).toEqual({ bend: 40, bendV: 5 });
    expect(branchBendTarget(branch, 'down', -1)).toEqual({ bend: 40, bendV: -25 });
  });

  it('bends horizontally for left and right, leaving bendV alone', () => {
    expect(bendAxis('left')).toBe('h');
    expect(bendAxis('right')).toBe('h');
    expect(branchBendTarget(branch, 'left', 1)).toEqual({ bend: 55, bendV: -10 });
    expect(branchBendTarget(branch, 'right', -1)).toEqual({ bend: 25, bendV: -10 });
  });

  it('never changes the branch', () => {
    const copy = { ...branch };
    branchBendTarget(copy, 'up', 1);
    expect(copy).toEqual(branch);
  });
});

describe('hotspot arc fractions', () => {
  it('carries t for the trunk height a click wires at', () => {
    const hs = hotspotWorldPoints(starter(), ui({ mode: 'wire' }));
    expect(hs.filter((h) => h.kind === 'branch').map((h) => h.t)).toEqual(Array(4).fill(0.7));
    const trunk = hs.filter((h) => h.kind === 'trunk').map((h) => h.t);
    [0.2, 0.4, 0.6, 0.8].forEach((t, i) => {
      expect(trunk[i]).toBeCloseTo(t, 12);
    });
  });
});
