import { describe, expect, it } from 'vitest';
import {
  MODAL_BORDER,
  MODAL_BUTTON_BOTTOM,
  MODAL_BUTTON_GAP,
  MODAL_BUTTON_HEIGHT,
  MODAL_BUTTON_WIDTH,
  MODAL_CANCEL_LABEL,
  MODAL_DETAIL_COLOR,
  MODAL_DETAIL_TOP,
  MODAL_DIM_ALPHA,
  MODAL_FILL,
  MODAL_HEIGHT,
  MODAL_REMOVE_LABEL,
  MODAL_TITLE_COLOR,
  MODAL_TITLE_TOP,
  MODAL_WIDTH,
  modalCssVars,
  wireRemovalModel,
} from './modal';
import { VIEWER_FIXTURES, WIRED_BRANCH_ID } from './viewerFixtures';

describe('wire-removal modal constants', () => {
  // archive/gamemaker/objects/obj_viewer_3d/Draw_64.gml `_draw_wire_removal_modal`.
  it('pins the prototype numbers, colours and labels', () => {
    expect(MODAL_DIM_ALPHA).toBe(0.55);
    expect([MODAL_WIDTH, MODAL_HEIGHT]).toEqual([480, 200]);
    expect(MODAL_FILL).toEqual({ r: 40, g: 50, b: 40 });
    expect(MODAL_BORDER).toEqual({ r: 255, g: 255, b: 255 });
    expect(MODAL_TITLE_COLOR).toEqual({ r: 255, g: 255, b: 255 });
    expect(MODAL_DETAIL_COLOR).toEqual({ r: 220, g: 220, b: 220 });
    expect([MODAL_TITLE_TOP, MODAL_DETAIL_TOP]).toEqual([18, 60]);
    expect([MODAL_BUTTON_WIDTH, MODAL_BUTTON_HEIGHT]).toEqual([120, 36]);
    expect([MODAL_BUTTON_GAP, MODAL_BUTTON_BOTTOM]).toEqual([24, 20]);
    expect([MODAL_CANCEL_LABEL, MODAL_REMOVE_LABEL]).toEqual(['Cancel', 'Remove']);
  });

  it('publishes them as CSS custom properties', () => {
    expect(modalCssVars()).toEqual({
      '--modal-dim': 'rgba(0, 0, 0, 0.55)',
      '--modal-width': '480px',
      '--modal-height': '200px',
      '--modal-fill': 'rgb(40, 50, 40)',
      '--modal-border': 'rgb(255, 255, 255)',
      '--modal-title': 'rgb(255, 255, 255)',
      '--modal-detail': 'rgb(220, 220, 220)',
      '--modal-title-top': '18px',
      '--modal-detail-top': '60px',
      '--modal-button-width': '120px',
      '--modal-button-height': '36px',
      '--modal-button-gap': '24px',
      '--modal-button-bottom': '20px',
    });
  });
});

describe('wireRemovalModel', () => {
  // The fixture's wire went on at day 0.
  const tree = VIEWER_FIXTURES.wired();

  it('warns of spring-back before the wire has set', () => {
    expect(wireRemovalModel(tree, WIRED_BRANCH_ID, 0)).toEqual({
      branchId: 1,
      title: 'Remove wire from branch 1?',
      detail: ['Wire age: 0d (early)', 'Bend will spring back to 30%.'],
    });
    expect(wireRemovalModel(tree, WIRED_BRANCH_ID, 55).detail).toEqual([
      'Wire age: 55d (early)',
      'Bend will spring back to 30%.',
    ]);
  });

  it('says the bend holds from day 56 on', () => {
    expect(wireRemovalModel(tree, WIRED_BRANCH_ID, 56).detail).toEqual([
      'Wire age: 56d (permanent)',
      'Bend will hold.',
    ]);
  });

  it('reads age 0 when the branch has no wire record', () => {
    expect(wireRemovalModel(tree, 2, 100)).toEqual({
      branchId: 2,
      title: 'Remove wire from branch 2?',
      detail: ['Wire age: 0d (early)', 'Bend will spring back to 30%.'],
    });
  });
});
