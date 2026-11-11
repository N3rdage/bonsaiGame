/**
 * The tree inspector's sub-panels as PanelModels (Rename in PANEL, the
 * others in TALL_PANEL): Repot
 * (obj_ui_tree_repot_confirm), Sell (obj_ui_tree_sell_confirm), Set Style
 * (obj_ui_tree_style_picker) and Rename (obj_ui_tree_rename). Pure;
 * WorldScene draws them and maps their rows to the sim's actions.
 */

import { inventoryCount } from '../sim/inventory';
import { scoreTree } from '../sim/scoring';
import { sellPrice } from '../sim/shop';
import { getSpecies } from '../sim/species';
import { STYLE_KEYS, getStyle } from '../sim/styles';
import { MAX_TREE_NAME_LENGTH } from '../sim/tree';
import type { BonsaiTree, GameState } from '../sim/types';
import {
  PANEL,
  PANEL_INSET,
  TALL_PANEL,
  needsFit,
  rowY,
  rows,
  type PanelModel,
  type PanelRow,
} from './panels';
import { DESKTOP_UI, type UiMetrics } from './uiScale';

/** obj_ui_tree_sell_confirm's price colour, rgb(220, 200, 120). */
export const PRICE_COLOR = '#dcc878';

/** The prototype's `"<name>"`, or `(unnamed)`. */
function quoted(tree: BonsaiTree): string {
  return tree.name === '' ? '(unnamed)' : `"${tree.name}"`;
}

const species = (tree: BonsaiTree): string => `Species: ${getSpecies(tree.speciesKey).displayName}`;

/** Left edge of the second column (Fancy Pot, the right-hand styles) where the rows need a taller pitch. */
const SECOND_COLUMN_X = TALL_PANEL.x + 200;

/**
 * Repot: the tree's pot, vigor and days since the last repot, the premium
 * soil toggle while any is in stock, and one row per pot tier, greyed at 0.
 * Where the rows need a taller pitch (`needsFit`), the two pot rows share a
 * line, so the box still fits the canvas.
 */
export function repotPanel(
  tree: BonsaiTree,
  state: GameState,
  premiumSoil: boolean,
  ui: UiMetrics = DESKTOP_UI,
): PanelModel {
  const soil = inventoryCount(state.inventory, 'soil_premium');
  const pots = inventoryCount(state.inventory, 'pot');
  const fancy = inventoryCount(state.inventory, 'fancy_pot');
  const items: Omit<PanelRow, 'y'>[] = [
    { text: `Repot ${quoted(tree)}?`, id: '', color: '#ffffff' },
    { text: species(tree), id: '' },
    { text: `Current pot: ${tree.potTier === 1 ? 'Fancy' : 'Standard'}`, id: '' },
    { text: `Vigor: ${String(Math.floor(tree.vigor))} / 100 (resets to 50)`, id: '' },
    { text: `Days since last repot: ${String(state.day - tree.lastRepotDay)}`, id: '' },
    { text: `Akadama mix: ${String(soil)}`, id: '' },
  ];
  if (soil > 0) {
    items.push({
      text: `[${premiumSoil ? 'x' : ' '}] Use premium soil (slower vigor loss)`,
      id: 'panel-soil',
    });
  }
  const standard = {
    text: `Standard Pot (${String(pots)})`,
    id: 'panel-repot-standard',
    enabled: pots > 0,
  };
  const fancyPot = {
    text: `Fancy Pot (${String(fancy)})`,
    id: 'panel-repot-fancy',
    enabled: fancy > 0,
  };
  const potsY = rowY(TALL_PANEL, items.length);
  return {
    key: `repot:${String(tree.id)}`,
    title: 'Repot Tree',
    box: TALL_PANEL,
    rows: needsFit(TALL_PANEL, ui)
      ? [
          ...rows(items, TALL_PANEL),
          { ...standard, x: TALL_PANEL.x + PANEL_INSET, y: potsY },
          { ...fancyPot, x: SECOND_COLUMN_X, y: potsY },
        ]
      : rows([...items, standard, fancyPot], TALL_PANEL),
  };
}

/** Sell: the score and the price `sellTree` will bank, then the Sell row. */
export function sellPanel(tree: BonsaiTree): PanelModel {
  return {
    key: `sell:${String(tree.id)}`,
    title: 'Sell Tree',
    box: TALL_PANEL,
    rows: rows(
      [
        { text: `Sell ${quoted(tree)}?`, id: '', color: '#ffffff' },
        { text: species(tree), id: '' },
        { text: `Score: ${String(scoreTree(tree).total)} / 100`, id: '' },
        { text: `Sale price: ${String(sellPrice(tree))} coins`, id: '', color: PRICE_COLOR },
        { text: 'Sell', id: 'panel-sell' },
      ],
      TALL_PANEL,
    ),
  };
}

/**
 * Set Style: one row per style, the current one marked `>`, then `(none)`.
 * A tap sets it at once (the prototype selected, then saved); the
 * descriptions are left out to fit the width. Where the rows need a taller
 * pitch (`needsFit`), the choices run down two columns, the left one first,
 * so the box still fits the canvas.
 */
export function stylePanel(tree: BonsaiTree, ui: UiMetrics = DESKTOP_UI): PanelModel {
  const intro = { text: 'Pick a target style for this tree.', id: '' };
  const choices = [
    ...STYLE_KEYS.map((key) => ({
      text: `${tree.targetStyle === key ? '>' : ' '} ${getStyle(key).displayName}`,
      id: `panel-style-${key}`,
    })),
    { text: `${tree.targetStyle === '' ? '>' : ' '} (none)`, id: 'panel-style-none' },
  ];
  const perColumn = Math.ceil(choices.length / 2);
  return {
    key: `style:${String(tree.id)}`,
    title: 'Tree Style',
    box: TALL_PANEL,
    rows: needsFit(TALL_PANEL, ui)
      ? [
          ...rows([intro], TALL_PANEL),
          ...choices.map((choice, i) => ({
            ...choice,
            x: i < perColumn ? TALL_PANEL.x + PANEL_INSET : SECOND_COLUMN_X,
            y: rowY(TALL_PANEL, 1 + (i % perColumn)),
          })),
        ]
      : rows([intro, ...choices], TALL_PANEL),
  };
}

/** Rename: the second row's right part is where the scene puts the DOM input; the third is its counter. */
export function renamePanel(tree: BonsaiTree, typed: string): PanelModel {
  return {
    key: `rename:${String(tree.id)}`,
    title: 'Rename Tree',
    rows: rows([
      { text: `Current name: ${quoted(tree)}`, id: '' },
      { text: 'New name:', id: '', color: '#ffffff' },
      { text: renameCounter(typed), id: '' },
      { text: 'Save', id: 'panel-rename-save' },
    ]),
  };
}

/** The prototype's hint line with its `N/20` counter. */
export function renameCounter(typed: string): string {
  const n = Math.min(typed.length, MAX_TREE_NAME_LENGTH);
  return `Enter to save  |  Esc to cancel  |  ${String(n)}/${String(MAX_TREE_NAME_LENGTH)}`;
}

/**
 * The rename input box in logical px for the panel as drawn (`model` after
 * `fitRows`): right of `New name:` on its row, to the inset.
 */
export function renameInput(model: PanelModel): {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
} {
  const box = model.box ?? PANEL;
  return { x: box.x + 80, y: model.rows[1]?.y ?? rowY(box, 1), w: box.w - 90, h: 16 };
}
