/**
 * The viewer's toolbar, wire sub-row, help lines and wire-age captions, as
 * plain data. Pure: no three.js or DOM import; `ViewerToolbar.ts` draws it.
 *
 * Ported from archive/gamemaker/objects/obj_viewer_3d/Draw_64.gml (toolbar,
 * sub-row, help text and the hotspot age caption) and the `ui_button` and
 * `ui_toggle` looks in archive/gamemaker/scripts/scr_ui/scr_ui.gml.
 */

import { BRANCH_BEND_PER_CLICK, TRUNK_BEND_PER_EVENT } from '../sim/geometry';
import { getSpecies } from '../sim/species';
import { WIRE_SET_DAYS, activeWireForBranch } from '../sim/training';
import type { BonsaiTree } from '../sim/types';
import {
  uiStripHeight,
  type BendDir,
  type ViewerMode,
  type ViewerUiState,
  type WireAction,
} from './hotspots';
import type { Rgb } from './potPalette';

export const TOOLBAR_BG: Rgb = { r: 25, g: 30, b: 25 };
export const TOOLBAR_BG_ALPHA = 0.85;

/** Tree info: left edge, first line's top, and the second line 22 px below (y 10 and 32). */
export const INFO_LEFT = 16;
export const INFO_TOP = 10;
export const INFO_LINE_HEIGHT = 22;

export const BUTTON_TOP = 12;
export const BUTTON_HEIGHT = 36;
export const MODE_BUTTON_WIDTH = 84;
export const MODE_BUTTON_GAP = 8;
export const EXIT_BUTTON_WIDTH = 100;
/** The mode group ends this far before the Exit button. */
export const EXIT_GAP = 16;
/** Exit sits at `width - 120` and is 100 wide, so 20 px from the right edge. */
export const EXIT_RIGHT = 20;
/**
 * The camera column (zoom in, zoom out, reset) at the right edge, vertically
 * centred: square buttons as tall as the toolbar's, in line with Exit.
 */
export const CAMERA_BUTTON_SIZE = BUTTON_HEIGHT;
export const CAMERA_BUTTON_GAP = 8;
export const CAMERA_BUTTONS_RIGHT = EXIT_RIGHT;
export const SELECTED_OUTLINE: Rgb = { r: 100, g: 140, b: 80 };
export const SELECTED_OUTLINE_WIDTH = 2;

/** `ui_button`, and `ui_toggle` when selected. */
export const BUTTON_FILL: Rgb = { r: 80, g: 110, b: 70 };
export const BUTTON_FILL_HOVER: Rgb = { r: 120, g: 150, b: 100 };
export const BUTTON_BORDER: Rgb = { r: 255, g: 255, b: 255 };
export const BUTTON_TEXT: Rgb = { r: 255, g: 255, b: 255 };
/** `ui_toggle` when not selected: outline only, tinted text, a faint fill on hover. */
export const TOGGLE_TEXT: Rgb = { r: 180, g: 200, b: 170 };
export const TOGGLE_FILL_HOVER: Rgb = { r: 50, g: 70, b: 50 };

export const SUBROW_TOP = 64;
export const SUBROW_HEIGHT = 28;
export const SUBROW_GAP = 8;
export const SUBROW_SEPARATOR = 24;
export const SUBROW_LABEL_WIDTH = 50;
export const ACTION_TOGGLE_WIDTH = 80;
export const DIR_TOGGLE_WIDTH = 56;
export const SHOW_TOGGLE_WIDTH = 92;
/** The group separator on viewports narrower than `SUBROW_ONE_LINE_WIDTH`. */
export const SUBROW_SEPARATOR_NARROW = 12;
/**
 * The bend sub-row (Action, Bend and Show groups) on one line at
 * `SUBROW_SEPARATOR`, edge to edge: 830 px. Below it the narrow separator
 * keeps the row on one line down to 806 px, so the toolbar stays 110 px tall
 * on a phone in landscape (the S22 Ultra is 824 px wide).
 */
export const SUBROW_ONE_LINE_WIDTH =
  3 * SUBROW_LABEL_WIDTH +
  2 * (SUBROW_GAP + ACTION_TOGGLE_WIDTH) +
  4 * (SUBROW_GAP + DIR_TOGGLE_WIDTH) +
  2 * (SUBROW_GAP + SHOW_TOGGLE_WIDTH) +
  2 * SUBROW_SEPARATOR;

/** The sub-row's group separator for a viewport `viewportWidth` CSS px wide. */
export function subRowSeparator(viewportWidth: number): number {
  return viewportWidth < SUBROW_ONE_LINE_WIDTH ? SUBROW_SEPARATOR_NARROW : SUBROW_SEPARATOR;
}

/** Sub-row labels and the help lines. */
export const LABEL_COLOR: Rgb = { r: 180, g: 180, b: 180 };

/** Tops of the help lines, measured up from the bottom edge. */
export const HELP_WIRE_FROM_BOTTOM = 44;
export const HELP_FROM_BOTTOM = 24;

/** The wire-age caption's top sits this far below the hotspot circle. */
export const CAPTION_GAP = 4;

export const EXIT_LABEL = 'Exit (Esc)';
export const CAMERA_HELP = 'Drag to rotate  |  Pinch or scroll to zoom  |  Reset button or R';

export type CameraAction = 'in' | 'out' | 'reset';

/** The camera column, top to bottom: label, accessible name and `data-camera` value. */
export const CAMERA_BUTTONS: readonly (readonly [CameraAction, string, string])[] = [
  ['in', '+', 'Zoom in'],
  ['out', '−', 'Zoom out'],
  ['reset', 'R', 'Reset camera'],
];

export interface ModeButton {
  mode: ViewerMode;
  label: string;
  selected: boolean;
}

export type ShowFilter = 'wired' | 'unwired';

interface Toggle<K extends string, V extends string> {
  kind: K;
  value: V;
  label: string;
  selected: boolean;
}

/** A sub-row toggle; `kind` names its data attribute (`data-action`, `data-dir`, `data-show`). */
export type ToolbarToggle =
  Toggle<'action', WireAction> | Toggle<'dir', BendDir> | Toggle<'show', ShowFilter>;

export interface SubRowGroup {
  label: string;
  toggleWidth: number;
  toggles: ToolbarToggle[];
}

export interface ToolbarModel {
  /** The background strip's height: the canvas's no-drag strip. */
  height: number;
  info: readonly [string, string];
  modes: ModeButton[];
  /** Wire mode only; empty otherwise. */
  subRow: SubRowGroup[];
  /** Bottom help lines, top to bottom. */
  help: string[];
  /** Caption under each branch's hotspot, by branch index; '' for none. */
  branchCaptions: string[];
}

const MODES: readonly (readonly [ViewerMode, string])[] = [
  ['view', 'View (V)'],
  ['wire', 'Wire (W)'],
  ['clip', 'Clip (C)'],
  ['prune', 'Prune (P)'],
];

const DIRS: readonly (readonly [BendDir, string])[] = [
  ['up', 'Up'],
  ['left', 'Left'],
  ['down', 'Down'],
  ['right', 'Right'],
];

/** `Nd`, marked early while the wire has not set. */
export function wireAgeCaption(ageDays: number): string {
  return ageDays < WIRE_SET_DAYS ? `${String(ageDays)}d (early)` : `${String(ageDays)}d`;
}

export function treeInfo(tree: BonsaiTree): readonly [string, string] {
  const name = getSpecies(tree.speciesKey).displayName;
  return [
    tree.name === '' ? name : `${name} "${tree.name}"`,
    `Age: ${String(tree.ageDays)}d  |  Height: ${tree.trunk.heightCm.toFixed(1)}cm`,
  ];
}

function subRow(ui: ViewerUiState): SubRowGroup[] {
  if (ui.mode !== 'wire') return [];
  const action: SubRowGroup = {
    label: 'Action:',
    toggleWidth: ACTION_TOGGLE_WIDTH,
    toggles: [
      { kind: 'action', value: 'bend', label: 'Bend', selected: ui.wireAction === 'bend' },
      { kind: 'action', value: 'remove', label: 'Remove', selected: ui.wireAction === 'remove' },
    ],
  };
  if (ui.wireAction !== 'bend') return [action];
  return [
    action,
    {
      label: 'Bend:',
      toggleWidth: DIR_TOGGLE_WIDTH,
      toggles: DIRS.map(([value, label]) => ({
        kind: 'dir',
        value,
        label,
        selected: ui.bendDir === value,
      })),
    },
    {
      label: 'Show:',
      toggleWidth: SHOW_TOGGLE_WIDTH,
      toggles: [
        { kind: 'show', value: 'wired', label: 'Wired', selected: ui.showWired },
        { kind: 'show', value: 'unwired', label: 'Unwired', selected: ui.showUnwired },
      ],
    },
  ];
}

function helpLines(ui: ViewerUiState, wireStock: number): string[] {
  if (ui.mode !== 'wire') return [CAMERA_HELP];
  const what =
    ui.wireAction === 'bend'
      ? `Click branch or trunk to bend (${String(BRANCH_BEND_PER_CLICK)}° per click on branches, ${String(TRUNK_BEND_PER_EVENT)}° on trunks)`
      : 'Click a wired branch to remove its wire';
  const out = wireStock <= 0 ? '  (out)' : '';
  return [`${what}  |  Wire: ${String(wireStock)}${out}`, CAMERA_HELP];
}

function branchCaptions(tree: BonsaiTree, ui: ViewerUiState, day: number): string[] {
  return tree.branches.map((branch, i) => {
    if (ui.mode !== 'wire' || !branch.wired) return '';
    const wire = activeWireForBranch(tree, i);
    return wireAgeCaption(wire === undefined ? 0 : day - wire.appliedDay);
  });
}

export function buildToolbarModel(
  tree: BonsaiTree,
  ui: ViewerUiState,
  wireStock: number,
  day: number,
): ToolbarModel {
  return {
    height: uiStripHeight(ui.mode),
    info: treeInfo(tree),
    modes: MODES.map(([mode, label]) => ({ mode, label, selected: ui.mode === mode })),
    subRow: subRow(ui),
    help: helpLines(ui, wireStock),
    branchCaptions: branchCaptions(tree, ui, day),
  };
}

export function rgb({ r, g, b }: Rgb): string {
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

export function px(n: number): string {
  return `${String(n)}px`;
}

/** The numbers above as CSS custom properties, for the rules in index.html. */
export function toolbarCssVars(): Record<string, string> {
  const { r, g, b } = TOOLBAR_BG;
  const helpLine = HELP_WIRE_FROM_BOTTOM - HELP_FROM_BOTTOM;
  return {
    '--tb-bg': `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(TOOLBAR_BG_ALPHA)})`,
    '--tb-info-left': px(INFO_LEFT),
    '--tb-info-top': px(INFO_TOP),
    '--tb-info-line': px(INFO_LINE_HEIGHT),
    '--tb-button-offset': px(BUTTON_TOP - INFO_TOP),
    '--tb-button-height': px(BUTTON_HEIGHT),
    '--tb-mode-width': px(MODE_BUTTON_WIDTH),
    '--tb-mode-gap': px(MODE_BUTTON_GAP),
    '--tb-exit-width': px(EXIT_BUTTON_WIDTH),
    '--tb-exit-gap': px(EXIT_GAP),
    '--tb-exit-right': px(EXIT_RIGHT),
    '--tb-camera-size': px(CAMERA_BUTTON_SIZE),
    '--tb-camera-gap': px(CAMERA_BUTTON_GAP),
    '--tb-camera-right': px(CAMERA_BUTTONS_RIGHT),
    '--tb-selected': rgb(SELECTED_OUTLINE),
    '--tb-selected-width': px(SELECTED_OUTLINE_WIDTH),
    '--tb-fill': rgb(BUTTON_FILL),
    '--tb-fill-hover': rgb(BUTTON_FILL_HOVER),
    '--tb-border': rgb(BUTTON_BORDER),
    '--tb-text': rgb(BUTTON_TEXT),
    '--tb-toggle-text': rgb(TOGGLE_TEXT),
    '--tb-toggle-hover': rgb(TOGGLE_FILL_HOVER),
    // The info block ends at INFO_TOP + 2 lines; the sub-row starts at SUBROW_TOP.
    '--tb-subrow-offset': px(SUBROW_TOP - INFO_TOP - 2 * INFO_LINE_HEIGHT),
    '--tb-subrow-height': px(SUBROW_HEIGHT),
    '--tb-subrow-gap': px(SUBROW_GAP),
    '--tb-subrow-separator': px(SUBROW_SEPARATOR),
    '--tb-label-width': px(SUBROW_LABEL_WIDTH),
    '--tb-label': rgb(LABEL_COLOR),
    // Help lines stack upward from the bottom one, whose top is HELP_FROM_BOTTOM up.
    '--tb-help-line': px(helpLine),
    '--tb-help-bottom': px(HELP_FROM_BOTTOM - helpLine),
  };
}
