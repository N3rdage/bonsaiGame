import { describe, expect, it } from 'vitest';
import { BRANCH_BEND_PER_CLICK, TRUNK_BEND_PER_EVENT } from '../sim/geometry';
import { createNewGameState } from '../sim/state';
import { WIRE_SET_DAYS } from '../sim/training';
import type { BonsaiTree } from '../sim/types';
import { createViewerUiState, type ViewerUiState } from './hotspots';
import {
  ACTION_TOGGLE_WIDTH,
  BUTTON_BORDER,
  BUTTON_FILL,
  BUTTON_FILL_HOVER,
  BUTTON_HEIGHT,
  BUTTON_TEXT,
  BUTTON_TOP,
  CAMERA_BUTTONS,
  CAMERA_BUTTONS_RIGHT,
  CAMERA_BUTTON_GAP,
  CAMERA_BUTTON_SIZE,
  CAMERA_HELP,
  CAPTION_GAP,
  DIR_TOGGLE_WIDTH,
  EXIT_BUTTON_WIDTH,
  EXIT_GAP,
  EXIT_LABEL,
  EXIT_RIGHT,
  HELP_FROM_BOTTOM,
  HELP_WIRE_FROM_BOTTOM,
  INFO_LEFT,
  INFO_LINE_HEIGHT,
  INFO_TOP,
  LABEL_COLOR,
  MODE_BUTTON_GAP,
  MODE_BUTTON_WIDTH,
  SELECTED_OUTLINE,
  SELECTED_OUTLINE_WIDTH,
  SHOW_TOGGLE_WIDTH,
  SUBROW_GAP,
  SUBROW_HEIGHT,
  SUBROW_LABEL_WIDTH,
  SUBROW_ONE_LINE_WIDTH,
  SUBROW_SEPARATOR,
  SUBROW_SEPARATOR_NARROW,
  SUBROW_TOP,
  TOGGLE_FILL_HOVER,
  TOGGLE_TEXT,
  TOOLBAR_BG,
  TOOLBAR_BG_ALPHA,
  buildToolbarModel,
  subRowSeparator,
  toolbarCssVars,
  treeInfo,
  wireAgeCaption,
} from './toolbar';
import { VIEWER_FIXTURES, WIRED_BRANCH_ID } from './viewerFixtures';

function starter(): BonsaiTree {
  const tree = createNewGameState().trees[0];
  if (!tree) throw new Error('new game has no starter tree');
  return tree;
}

function ui(overrides: Partial<ViewerUiState>): ViewerUiState {
  return { ...createViewerUiState(), ...overrides };
}

describe('toolbar constants', () => {
  // archive/gamemaker/objects/obj_viewer_3d/Draw_64.gml lines 1-157.
  it('pins the toolbar layout', () => {
    expect(TOOLBAR_BG).toEqual({ r: 25, g: 30, b: 25 });
    expect(TOOLBAR_BG_ALPHA).toBe(0.85);
    expect([INFO_LEFT, INFO_TOP, INFO_LINE_HEIGHT]).toEqual([16, 10, 22]);
    expect([BUTTON_TOP, BUTTON_HEIGHT, MODE_BUTTON_WIDTH, MODE_BUTTON_GAP]).toEqual([
      12, 36, 84, 8,
    ]);
    expect([EXIT_BUTTON_WIDTH, EXIT_GAP, EXIT_RIGHT]).toEqual([100, 16, 20]);
    expect(SELECTED_OUTLINE).toEqual({ r: 100, g: 140, b: 80 });
    expect(SELECTED_OUTLINE_WIDTH).toBe(2);
    expect(EXIT_LABEL).toBe('Exit (Esc)');
  });

  it('pins the wire sub-row layout', () => {
    expect([SUBROW_TOP, SUBROW_HEIGHT, SUBROW_GAP, SUBROW_SEPARATOR]).toEqual([64, 28, 8, 24]);
    expect(SUBROW_LABEL_WIDTH).toBe(50);
    expect([ACTION_TOGGLE_WIDTH, DIR_TOGGLE_WIDTH, SHOW_TOGGLE_WIDTH]).toEqual([80, 56, 92]);
    expect(LABEL_COLOR).toEqual({ r: 180, g: 180, b: 180 });
  });

  it('narrows the sub-row separator below the one-line width', () => {
    expect(SUBROW_ONE_LINE_WIDTH).toBe(830);
    expect(SUBROW_SEPARATOR_NARROW).toBe(12);
    expect(subRowSeparator(1280)).toBe(SUBROW_SEPARATOR);
    expect(subRowSeparator(SUBROW_ONE_LINE_WIDTH)).toBe(SUBROW_SEPARATOR);
    expect(subRowSeparator(SUBROW_ONE_LINE_WIDTH - 1)).toBe(SUBROW_SEPARATOR_NARROW);
    // The S22 Ultra in landscape is 824 wide: the narrow row (806 px) fits on one line.
    expect(subRowSeparator(824)).toBe(SUBROW_SEPARATOR_NARROW);
    expect(SUBROW_ONE_LINE_WIDTH - 2 * (SUBROW_SEPARATOR - SUBROW_SEPARATOR_NARROW)).toBe(806);
  });

  // archive/gamemaker/scripts/scr_ui/scr_ui.gml: ui_button and ui_toggle.
  it('pins the button and toggle colours', () => {
    expect(BUTTON_FILL).toEqual({ r: 80, g: 110, b: 70 });
    expect(BUTTON_FILL_HOVER).toEqual({ r: 120, g: 150, b: 100 });
    expect(BUTTON_BORDER).toEqual({ r: 255, g: 255, b: 255 });
    expect(BUTTON_TEXT).toEqual({ r: 255, g: 255, b: 255 });
    expect(TOGGLE_TEXT).toEqual({ r: 180, g: 200, b: 170 });
    expect(TOGGLE_FILL_HOVER).toEqual({ r: 50, g: 70, b: 50 });
  });

  it('pins the help lines and caption offsets', () => {
    expect([HELP_WIRE_FROM_BOTTOM, HELP_FROM_BOTTOM]).toEqual([44, 24]);
    expect(CAPTION_GAP).toBe(4);
    expect(CAMERA_HELP).toBe('Drag to rotate  |  Pinch or scroll to zoom  |  Reset button or R');
  });

  it('pins the camera column', () => {
    expect([CAMERA_BUTTON_SIZE, CAMERA_BUTTON_GAP, CAMERA_BUTTONS_RIGHT]).toEqual([36, 8, 20]);
    expect(CAMERA_BUTTON_SIZE).toBe(BUTTON_HEIGHT);
    expect(CAMERA_BUTTONS_RIGHT).toBe(EXIT_RIGHT);
    expect(CAMERA_BUTTONS).toEqual([
      ['in', '+', 'Zoom in'],
      ['out', '−', 'Zoom out'],
      ['reset', 'R', 'Reset camera'],
    ]);
    // A true minus sign (U+2212), not a hyphen.
    expect(CAMERA_BUTTONS[1]?.[1].codePointAt(0)).toBe(0x2212);
  });

  it('exposes the numbers as CSS custom properties', () => {
    const vars = toolbarCssVars();
    expect(vars['--tb-bg']).toBe('rgba(25, 30, 25, 0.85)');
    expect(vars['--tb-mode-width']).toBe('84px');
    expect(vars['--tb-button-height']).toBe('36px');
    expect(vars['--tb-button-offset']).toBe('2px');
    expect(vars['--tb-exit-width']).toBe('100px');
    expect(vars['--tb-camera-size']).toBe('36px');
    expect(vars['--tb-camera-gap']).toBe('8px');
    expect(vars['--tb-camera-right']).toBe('20px');
    expect(vars['--tb-selected']).toBe('rgb(100, 140, 80)');
    expect(vars['--tb-fill']).toBe('rgb(80, 110, 70)');
    expect(vars['--tb-fill-hover']).toBe('rgb(120, 150, 100)');
    expect(vars['--tb-toggle-text']).toBe('rgb(180, 200, 170)');
    expect(vars['--tb-toggle-hover']).toBe('rgb(50, 70, 50)');
    expect(vars['--tb-label']).toBe('rgb(180, 180, 180)');
    // 10 + 2 * 22 = 54, so the sub-row starts at 64.
    expect(vars['--tb-subrow-offset']).toBe('10px');
    expect(vars['--tb-subrow-height']).toBe('28px');
    // 20 px lines: the bottom one's top at 24 from the bottom, the wire one's at 44.
    expect(vars['--tb-help-line']).toBe('20px');
    expect(vars['--tb-help-bottom']).toBe('4px');
  });
});

describe('tree info', () => {
  it('shows the species, the quoted name, age and height to one decimal', () => {
    expect(treeInfo(starter())).toEqual(['Juniper "Granny\'s"', 'Age: 0d  |  Height: 25.0cm']);
  });

  it('leaves the name out when it is empty', () => {
    const tree = VIEWER_FIXTURES.maple();
    tree.ageDays = 12;
    expect(treeInfo(tree)).toEqual(['Japanese Maple', 'Age: 12d  |  Height: 20.0cm']);
  });
});

describe('wireAgeCaption', () => {
  it('marks a wire early until it has set', () => {
    expect(WIRE_SET_DAYS).toBe(56);
    expect(wireAgeCaption(0)).toBe('0d (early)');
    expect(wireAgeCaption(55)).toBe('55d (early)');
    expect(wireAgeCaption(56)).toBe('56d');
    expect(wireAgeCaption(120)).toBe('120d');
  });
});

describe('buildToolbarModel', () => {
  it('is 60 px high with the view button selected and no sub-row by default', () => {
    const model = buildToolbarModel(starter(), createViewerUiState(), 10, 0);
    expect(model.height).toBe(60);
    expect(model.modes).toEqual([
      { mode: 'view', label: 'View (V)', selected: true },
      { mode: 'wire', label: 'Wire (W)', selected: false },
      { mode: 'clip', label: 'Clip (C)', selected: false },
      { mode: 'prune', label: 'Prune (P)', selected: false },
    ]);
    expect(model.subRow).toEqual([]);
    expect(model.help).toEqual([CAMERA_HELP]);
    expect(model.branchCaptions).toEqual(['', '', '', '']);
  });

  it('selects the current mode', () => {
    const model = buildToolbarModel(starter(), ui({ mode: 'prune' }), 10, 0);
    expect(model.modes.filter((m) => m.selected).map((m) => m.mode)).toEqual(['prune']);
    expect(model.height).toBe(60);
    expect(model.subRow).toEqual([]);
  });

  it('adds the action, bend and show groups in wire + bend', () => {
    const model = buildToolbarModel(starter(), ui({ mode: 'wire', showUnwired: false }), 10, 0);
    expect(model.height).toBe(110);
    expect(model.subRow.map((g) => [g.label, g.toggleWidth])).toEqual([
      ['Action:', 80],
      ['Bend:', 56],
      ['Show:', 92],
    ]);
    expect(
      model.subRow.map((g) => g.toggles.map((t) => [t.kind, t.value, t.label, t.selected])),
    ).toEqual([
      [
        ['action', 'bend', 'Bend', true],
        ['action', 'remove', 'Remove', false],
      ],
      [
        ['dir', 'up', 'Up', false],
        ['dir', 'left', 'Left', true],
        ['dir', 'down', 'Down', false],
        ['dir', 'right', 'Right', false],
      ],
      [
        ['show', 'wired', 'Wired', true],
        ['show', 'unwired', 'Unwired', false],
      ],
    ]);
  });

  it('keeps only the action group in wire + remove', () => {
    const model = buildToolbarModel(starter(), ui({ mode: 'wire', wireAction: 'remove' }), 10, 0);
    expect(model.height).toBe(110);
    expect(model.subRow).toHaveLength(1);
    expect(model.subRow[0]?.toggles.map((t) => t.selected)).toEqual([false, true]);
  });

  it('shows the bend help with the sim bend steps and the wire stock', () => {
    const model = buildToolbarModel(starter(), ui({ mode: 'wire' }), 10, 0);
    expect([BRANCH_BEND_PER_CLICK, TRUNK_BEND_PER_EVENT]).toEqual([15, 20]);
    expect(model.help).toEqual([
      `Click branch or trunk to bend (${String(BRANCH_BEND_PER_CLICK)}° per click on branches, ${String(TRUNK_BEND_PER_EVENT)}° on trunks)  |  Wire: 10`,
      CAMERA_HELP,
    ]);
    expect(model.help[0]).toBe(
      'Click branch or trunk to bend (15° per click on branches, 20° on trunks)  |  Wire: 10',
    );
  });

  it('shows the remove help, and marks the wire out at 0', () => {
    const remove = ui({ mode: 'wire', wireAction: 'remove' });
    expect(buildToolbarModel(starter(), remove, 3, 0).help[0]).toBe(
      'Click a wired branch to remove its wire  |  Wire: 3',
    );
    expect(buildToolbarModel(starter(), remove, 0, 0).help[0]).toBe(
      'Click a wired branch to remove its wire  |  Wire: 0  (out)',
    );
    expect(buildToolbarModel(starter(), ui({ mode: 'wire' }), 0, 0).help[0]).toMatch(
      /\| {2}Wire: 0 {2}\(out\)$/,
    );
  });

  it('captions wired branches with the wire age in wire mode only', () => {
    const tree = VIEWER_FIXTURES.wired();
    const expected = ['', '', '', ''];
    expected[WIRED_BRANCH_ID] = '0d (early)';
    expect(buildToolbarModel(tree, ui({ mode: 'wire' }), 10, 0).branchCaptions).toEqual(expected);
    expected[WIRED_BRANCH_ID] = '56d';
    expect(
      buildToolbarModel(tree, ui({ mode: 'wire', wireAction: 'remove' }), 10, 56).branchCaptions,
    ).toEqual(expected);
    expect(buildToolbarModel(tree, ui({ mode: 'clip' }), 10, 0).branchCaptions).toEqual([
      '',
      '',
      '',
      '',
    ]);
  });

  it('captions a wired branch with no active record as 0 days, like the prototype', () => {
    const tree = VIEWER_FIXTURES.wired();
    tree.wiresApplied = [];
    expect(
      buildToolbarModel(tree, ui({ mode: 'wire' }), 10, 90).branchCaptions[WIRED_BRANCH_ID],
    ).toBe('0d (early)');
  });
});
