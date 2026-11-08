/**
 * The viewer's interaction state and hotspots, as plain data. Pure: no three.js
 * import; screen projection is passed in where it is needed.
 *
 * Ported from archive/gamemaker/objects/obj_viewer_3d: Create_0 for the mode
 * defaults, Step_0 for the no-drag strip, and Draw_64 for the branch and trunk
 * hotspots (`_draw_branch_hotspots`, `_draw_trunk_hotspots`) and the two
 * direction helpers (`_branch_bend_sign`, `_trunk_bend_world_angle`). Nothing
 * here mutates the tree.
 */

import { branchPoint, trunkFrameAt } from '../sim/geometry';
import type { BonsaiTree, Branch, Vec3 } from '../sim/types';
import type { Rgb } from './potPalette';

export type ViewerMode = 'view' | 'wire' | 'clip' | 'prune';
/** What a click does in wire mode. */
export type WireAction = 'bend' | 'remove';
/** Screen-relative bend direction, shared by trunk and branch bends. */
export type BendDir = 'up' | 'left' | 'down' | 'right';

export interface ViewerUiState {
  mode: ViewerMode;
  wireAction: WireAction;
  bendDir: BendDir;
  /** Wire + bend: show hotspots on branches that already carry wire. */
  showWired: boolean;
  /** Wire + bend: show hotspots on branches without wire. */
  showUnwired: boolean;
}

export function createViewerUiState(): ViewerUiState {
  return { mode: 'view', wireAction: 'bend', bendDir: 'left', showWired: true, showUnwired: true };
}

/** CSS px at the top of the viewer where a pointer-down never starts a drag (the toolbar). */
export const UI_STRIP_HEIGHT = 60;
/** Wire mode adds a sub-row of toggles below the toolbar, so its strip is taller. */
export const UI_STRIP_HEIGHT_WIRE = 110;

export function uiStripHeight(mode: ViewerMode): number {
  return mode === 'wire' ? UI_STRIP_HEIGHT_WIRE : UI_STRIP_HEIGHT;
}

/** Branch hotspots sit this far along the branch. */
export const BRANCH_HOTSPOT_T = 0.7;
/** Trunk hotspots: this many, evenly spaced between the two arc fractions below. */
export const TRUNK_HOTSPOT_COUNT = 4;
export const TRUNK_HOTSPOT_T_LO = 0.2;
export const TRUNK_HOTSPOT_T_HI = 0.8;

/** Hotspot circle radius in CSS px, idle and hovered. */
export const HOTSPOT_RADIUS = 8;
export const HOTSPOT_RADIUS_HOVER = 12;
/** The prototype's hover distance in px; R3d-2 uses it for click targets. */
export const HOTSPOT_HIT_RADIUS = 16;
export const HOTSPOT_ALPHA = 0.6;
export const HOTSPOT_ALPHA_HOVER = 0.9;

export const CLIP_HOTSPOT_COLOR: Rgb = { r: 255, g: 200, b: 80 };
export const PRUNE_HOTSPOT_COLOR: Rgb = { r: 255, g: 100, b: 100 };
export const WIRE_REMOVE_HOTSPOT_COLOR: Rgb = { r: 255, g: 130, b: 40 };
/** Wire + bend on a branch that already carries wire. */
export const WIRE_BEND_WIRED_HOTSPOT_COLOR: Rgb = { r: 255, g: 180, b: 80 };
/** Wire + bend on a branch without wire. */
export const WIRE_BEND_UNWIRED_HOTSPOT_COLOR: Rgb = { r: 100, g: 200, b: 255 };
export const TRUNK_HOTSPOT_COLOR: Rgb = { r: 120, g: 220, b: 140 };

/** Degrees the branch's bend is nudged by to find which sign moves its tip the chosen way. */
export const BEND_SIGN_PROBE_DEG = 5;

/** A point on screen in CSS px, y growing downward. */
export interface ScreenPoint {
  x: number;
  y: number;
}

export interface WorldHotspot {
  kind: 'branch' | 'trunk';
  /** Branch index for a branch hotspot; 0-based slot up the trunk for a trunk one. */
  id: number;
  label: string;
  /** World position in display units (not yet mirrored into viewer space). */
  world: Vec3;
  color: Rgb;
}

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

function branchVisible(branch: Branch, ui: ViewerUiState): boolean {
  if (ui.mode !== 'wire') return true;
  if (ui.wireAction === 'remove') return branch.wired;
  return branch.wired ? ui.showWired : ui.showUnwired;
}

function branchColor(branch: Branch, ui: ViewerUiState): Rgb {
  if (ui.mode === 'clip') return CLIP_HOTSPOT_COLOR;
  if (ui.mode === 'prune') return PRUNE_HOTSPOT_COLOR;
  if (ui.wireAction === 'remove') return WIRE_REMOVE_HOTSPOT_COLOR;
  return branch.wired ? WIRE_BEND_WIRED_HOTSPOT_COLOR : WIRE_BEND_UNWIRED_HOTSPOT_COLOR;
}

/** Hotspots shown in the current mode, in world space, branch ones first. */
export function hotspotWorldPoints(tree: BonsaiTree, ui: ViewerUiState): WorldHotspot[] {
  if (ui.mode === 'view') return [];
  const hotspots: WorldHotspot[] = [];
  tree.branches.forEach((branch, i) => {
    if (!branchVisible(branch, ui)) return;
    hotspots.push({
      kind: 'branch',
      id: i,
      label: String(i),
      world: branchPoint(tree, branch, BRANCH_HOTSPOT_T),
      color: branchColor(branch, ui),
    });
  });
  if (ui.mode === 'wire' && ui.wireAction === 'bend') {
    for (let i = 0; i < TRUNK_HOTSPOT_COUNT; i++) {
      const t = lerp(TRUNK_HOTSPOT_T_LO, TRUNK_HOTSPOT_T_HI, i / (TRUNK_HOTSPOT_COUNT - 1));
      hotspots.push({
        kind: 'trunk',
        id: i,
        label: String(Math.round(t * tree.trunk.heightCm)),
        world: trunkFrameAt(tree, t).pos,
        color: TRUNK_HOTSPOT_COLOR,
      });
    }
  }
  return hotspots;
}

/**
 * World XY angle (degrees) for a trunk bend in a screen direction at camera
 * `yaw`. Up is away from the camera, down toward it; left and right are
 * swapped from the naive derivation by the prototype's left-handed view (see
 * `toViewerSpace`). Independent of pitch: trunk bends stay horizontal.
 */
export function trunkBendWorldAngle(dir: BendDir, yaw: number): number {
  switch (dir) {
    case 'right':
      return -90 - yaw;
    case 'left':
      return 90 - yaw;
    case 'up':
      return 180 - yaw;
    case 'down':
      return -yaw;
  }
}

const SCREEN_DIRECTION: Record<BendDir, ScreenPoint> = {
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  // Screen y grows downward.
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

/**
 * Sign of a branch bend increment that moves the tip toward `dir` on screen:
 * nudges the named bend (`h` for `bend`, `v` for `bendV`) on a copy of the
 * branch, projects the tip before and after, and compares the motion with the
 * direction. Falls back to +1 when either projection is off screen.
 */
export function branchBendSign(
  tree: BonsaiTree,
  branch: Branch,
  dir: BendDir,
  axis: 'h' | 'v',
  project: (p: Vec3) => ScreenPoint | undefined,
): 1 | -1 {
  const probe: Branch =
    axis === 'v'
      ? { ...branch, bendV: branch.bendV + BEND_SIGN_PROBE_DEG }
      : { ...branch, bend: branch.bend + BEND_SIGN_PROBE_DEG };
  const before = project(branchPoint(tree, branch, 1));
  const after = project(branchPoint(tree, probe, 1));
  if (before === undefined || after === undefined) return 1;
  const target = SCREEN_DIRECTION[dir];
  const dot = (after.x - before.x) * target.x + (after.y - before.y) * target.y;
  return dot >= 0 ? 1 : -1;
}
