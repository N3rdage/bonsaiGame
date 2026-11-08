/**
 * The wire-removal confirmation, as plain data. Pure: no three.js or DOM
 * import; `ViewerModal.ts` draws it.
 *
 * Ported from `_draw_wire_removal_modal` in
 * archive/gamemaker/objects/obj_viewer_3d/Draw_64.gml; its buttons are
 * `ui_button`s, drawn with the toolbar's button look.
 */

import { WIRE_SET_DAYS, activeWireForBranch } from '../sim/training';
import type { BonsaiTree } from '../sim/types';
import type { Rgb } from './potPalette';
import { px, rgb } from './toolbar';

/** Black over the whole viewport at this alpha behind the box. */
export const MODAL_DIM_ALPHA = 0.55;
export const MODAL_WIDTH = 480;
export const MODAL_HEIGHT = 200;
export const MODAL_FILL: Rgb = { r: 40, g: 50, b: 40 };
export const MODAL_BORDER: Rgb = { r: 255, g: 255, b: 255 };
export const MODAL_TITLE_COLOR: Rgb = { r: 255, g: 255, b: 255 };
export const MODAL_DETAIL_COLOR: Rgb = { r: 220, g: 220, b: 220 };
/** Tops of the title and the detail lines, from the box's top edge. */
export const MODAL_TITLE_TOP = 18;
export const MODAL_DETAIL_TOP = 60;
export const MODAL_BUTTON_WIDTH = 120;
export const MODAL_BUTTON_HEIGHT = 36;
export const MODAL_BUTTON_GAP = 24;
/** The buttons' bottom edge sits this far above the box's bottom edge. */
export const MODAL_BUTTON_BOTTOM = 20;

export const MODAL_CANCEL_LABEL = 'Cancel';
export const MODAL_REMOVE_LABEL = 'Remove';

export interface WireRemovalModel {
  branchId: number;
  title: string;
  detail: readonly [string, string];
}

/** The confirmation for taking the wire off `branchId` on `day`. */
export function wireRemovalModel(
  tree: BonsaiTree,
  branchId: number,
  day: number,
): WireRemovalModel {
  const wire = activeWireForBranch(tree, branchId);
  const age = wire === undefined ? 0 : day - wire.appliedDay;
  const ageText = `Wire age: ${String(age)}d`;
  return {
    branchId,
    title: `Remove wire from branch ${String(branchId)}?`,
    detail:
      age < WIRE_SET_DAYS
        ? [`${ageText} (early)`, 'Bend will spring back to 30%.']
        : [`${ageText} (permanent)`, 'Bend will hold.'],
  };
}

/** The numbers above as CSS custom properties, for the `#viewer-modal` rules in index.html. */
export function modalCssVars(): Record<string, string> {
  return {
    '--modal-dim': `rgba(0, 0, 0, ${String(MODAL_DIM_ALPHA)})`,
    '--modal-width': px(MODAL_WIDTH),
    '--modal-height': px(MODAL_HEIGHT),
    '--modal-fill': rgb(MODAL_FILL),
    '--modal-border': rgb(MODAL_BORDER),
    '--modal-title': rgb(MODAL_TITLE_COLOR),
    '--modal-detail': rgb(MODAL_DETAIL_COLOR),
    '--modal-title-top': px(MODAL_TITLE_TOP),
    '--modal-detail-top': px(MODAL_DETAIL_TOP),
    '--modal-button-width': px(MODAL_BUTTON_WIDTH),
    '--modal-button-height': px(MODAL_BUTTON_HEIGHT),
    '--modal-button-gap': px(MODAL_BUTTON_GAP),
    '--modal-button-bottom': px(MODAL_BUTTON_BOTTOM),
  };
}
