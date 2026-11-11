/**
 * The tree inspector (obj_ui_tree_inspector/Create_0.gml) as plain data: the
 * stat lines, status notes, score breakdown, bars, buttons and footer, laid
 * out in logical px on the 480x270 canvas, and the dispatch of its care
 * actions. Pure; WorldScene draws the model and owns Pick up and View in 3D.
 *
 * The prototype's inspector filled its screen in one column; at 270 px the
 * stats run full width on top, then two columns (bars left, score right),
 * then the buttons and the footer. Where that does not fit the box at the
 * screen's UI metrics (the phone's 10 px labels and 31 px tap targets), the
 * stats and notes join the bars in the left column and the score column
 * starts at the top (backlog #88).
 */

import {
  REPOT_COOLDOWN_DAYS,
  fertilizeTree,
  repotCheck,
  skipTimeCost,
  skipTreeTime,
  waterTree,
} from '../sim/growth';
import { inventoryHas } from '../sim/inventory';
import { scoreTree } from '../sim/scoring';
import { seasonForDay, seasonGrowthMultiplier, seasonLabel } from '../sim/seasons';
import { getSpecies } from '../sim/species';
import { findStyle } from '../sim/styles';
import { TUTORIAL_SKIP_WEEK, TUTORIAL_WATER, tutorialAdvanceIf } from '../sim/tutorial';
import type { BonsaiTree, GameState, Rng } from '../sim/types';
import { treeLabel } from './treeSprites';
import type { UiMetrics } from './uiScale';

/** Days the Skip button fast-forwards. */
export const SKIP_DAYS = 7;

/** The box, centred on the canvas; the 400x150 PANEL stays for the other panels. */
export const INSPECTOR_PANEL = { x: 20, y: 4, w: 440, h: 262 } as const;
/** Height of the title bar (obj_ui_panel's darker band). */
export const INSPECTOR_TITLE_H = 22;
/** Left and right inset of the content. */
export const INSPECTOR_INSET = 10;
/** Upper bounds of a glyph's width in the monospace fallback at the desktop sizes (VT323 is 0.4 em, 3.2 and 4 px): 8 px text (stats, notes, score, bars, footer) and 10 px (title, buttons). */
export const SMALL_GLYPH_W = 5;
export const GLYPH_W = 6;

const LEFT = INSPECTOR_PANEL.x + INSPECTOR_INSET;
const RIGHT = INSPECTOR_PANEL.x + INSPECTOR_PANEL.w - INSPECTOR_INSET;
/** Centre of the first line, under the title bar. */
export const INSPECTOR_TOP = INSPECTOR_PANEL.y + INSPECTOR_TITLE_H + 8;
/** Stat lines in one row each; the two-column layout splits `Pot | Soil` into two. */
const STAT_ROWS = 5;
/** At most two notes: dormancy only outside spring, and one repot or low-vigor note. */
const NOTE_ROWS = 2;
/** `Score: N / 100` and the breakdown: six criteria, the style's, the vitality multiplier. */
const SCORE_ROWS = 9;
/** Extra space between the stats and notes and the bars under them. */
const LOWER_GAP = 6;
/** Bars: label, track and `N/100` columns (the GML's _x, _x + 120, _x + 330 scaled down). */
const BAR_TRACK_X = LEFT + 48;
const BAR_TRACK_W = 100;
const BAR_TEXT_X = BAR_TRACK_X + BAR_TRACK_W + 6;
/** The score column, and the breakdown's value column within it. */
const SCORE_X = INSPECTOR_PANEL.x + 220;
const SCORE_VALUE_X = SCORE_X + 125;
/** The two columns, left edge and width: the bars (and, in two columns, the stats and notes) left, the score right. */
export const INSPECTOR_LEFT_COLUMN = { x: LEFT, w: SCORE_X - 10 - LEFT } as const;
export const INSPECTOR_SCORE_COLUMN = { x: SCORE_X, w: RIGHT - SCORE_X } as const;
/** Centre of the grey footer line. */
export const INSPECTOR_FOOTER_Y = INSPECTOR_PANEL.y + INSPECTOR_PANEL.h - 12;

/** The close hint, right-aligned in the title bar opposite the tree's label (text origin 1, 0.5). */
export const INSPECTOR_CLOSE_LABEL = '[ESC] Close';
export const INSPECTOR_CLOSE = {
  x: RIGHT,
  y: INSPECTOR_PANEL.y + INSPECTOR_TITLE_H / 2,
} as const;

/** Row pitch of the label-sized lines: the size plus 2, at least the desktop's 11 (11 at 8 px, 12 at 10 px). */
export function inspectorLine(ui: UiMetrics): number {
  return Math.max(11, ui.label + 2);
}

/** Half the height of a button's tap target, centred on its row. */
const hitHalf = (ui: UiMetrics): number => Math.max(ui.hit, ui.body) / 2;

/**
 * Centres of the two button rows (care and carrying, then the sub-panels):
 * the second as close over the footer as its tap targets allow, at least
 * 18 px; the first `max(14, hit)` above it, so the rows' targets never overlap.
 */
export function inspectorButtonRows(ui: UiMetrics): readonly [number, number] {
  const second = INSPECTOR_FOOTER_Y - Math.max(18, Math.ceil(ui.label / 2 + hitHalf(ui)));
  return [second - Math.max(14, ui.hit), second];
}

/**
 * Whether the one-column layout fits at `ui`: the stats and notes full width,
 * then the score column's nine lines, all above the first button row's tap
 * targets. True at the desktop metrics, false at the phone's.
 */
export function inspectorFitsOneColumn(ui: UiMetrics): boolean {
  const line = inspectorLine(ui);
  const last = INSPECTOR_TOP + (STAT_ROWS + NOTE_ROWS) * line + LOWER_GAP + (SCORE_ROWS - 1) * line;
  return last + line / 2 <= inspectorButtonRows(ui)[0] - hitHalf(ui);
}

export const NOTE_COLOR = '#dcb450';
export const FOOTER_COLOR = '#969696';
export const DISABLED_COLOR = '#6e7a68';

/** One line of label-sized text; text origin (0, 0.5), so `y` is its vertical centre. */
export interface InspectorText {
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

/** ui_bar: a dark track, the filled fraction in `color`, then `N/100`. */
export interface InspectorBar {
  readonly label: string;
  readonly value: number;
  readonly max: 100;
  readonly text: string;
  readonly color: number;
  readonly x: number;
  readonly y: number;
  readonly trackX: number;
  readonly trackW: number;
  readonly textX: number;
}

/** The inspector's own care actions; Pick up and View in 3D are the scene's. */
export type InspectorCare = 'water' | 'fertilise' | 'skip';
export type InspectorButtonId = InspectorCare | 'pickup' | 'view' | InspectorSubPanel;
/** The buttons that open a sub-panel (treePanels.ts). */
export type InspectorSubPanel = 'rename' | 'style' | 'sell' | 'repot';

export interface InspectorButton {
  /** The control id is `panel-<id>`. */
  readonly id: InspectorButtonId;
  readonly label: string;
  readonly enabled: boolean;
  /** Left edge and vertical centre, body-sized text. */
  readonly x: number;
  readonly y: number;
}

export interface InspectorModel {
  /** The hook's `panel`, `tree:<id>`. */
  readonly key: string;
  readonly title: string;
  readonly stats: readonly InspectorText[];
  /** The prototype's status notes (dormancy, repot season or cooldown, low vigor), drawn in NOTE_COLOR; at most NOTE_ROWS. */
  readonly notes: readonly InspectorText[];
  readonly score: InspectorText;
  readonly breakdown: readonly { readonly label: InspectorText; readonly value: InspectorText }[];
  readonly bars: readonly InspectorBar[];
  readonly buttons: readonly InspectorButton[];
  readonly footer: InspectorText;
}

/** The inspector of `tree` laid out at the screen's metrics `ui`. */
export function inspectorPanel(tree: BonsaiTree, state: GameState, ui: UiMetrics): InspectorModel {
  const line = inspectorLine(ui);
  const columns = !inspectorFitsOneColumn(ui);
  const row = (i: number): number => INSPECTOR_TOP + i * line;
  const species = getSpecies(tree.speciesKey);
  const season = seasonForDay(state.day);
  const dormant = seasonGrowthMultiplier(species.seasonsActive, season) <= 0;
  const repot = repotCheck(tree, state);
  const style = tree.targetStyle === '' ? undefined : findStyle(tree.targetStyle);
  const pot = tree.potTier === 1 ? 'Fancy (+25% display)' : 'Standard';
  const soil = tree.soilTier === 1 ? 'Akadama (slower vigor loss)' : 'Basic';

  const stats = [
    `Species: ${species.displayName}`,
    `Age: ${String(tree.ageDays)} days  |  Origin: ${tree.origin}`,
    `Trunk: ${tree.trunk.heightCm.toFixed(1)} cm tall, ${tree.trunk.girthMm.toFixed(1)} mm thick`,
    `Branches: ${String(tree.branches.length)}  |  Style: ${style?.displayName ?? '(none)'}`,
    // In two columns the full line (63 glyphs, 252 px at 10 px) is wider than the left one's 200.
    ...(columns ? [`Pot: ${pot}`, `Soil: ${soil}`] : [`Pot: ${pot}  |  Soil: ${soil}`]),
  ];
  const barsTop = row(stats.length + NOTE_ROWS) + LOWER_GAP;
  const scoreTop = columns ? INSPECTOR_TOP : barsTop;
  const [buttonY, button2Y] = inspectorButtonRows(ui);

  const notes: string[] = [];
  if (dormant) notes.push(`Dormant - ${seasonLabel(season)} operations limited`);
  if (repot === 'out_of_season') notes.push('Repot: requires spring');
  else if (repot === 'cooldown') {
    const wait = REPOT_COOLDOWN_DAYS - (state.day - tree.lastRepotDay);
    notes.push(`Repot: cooldown - wait ${String(wait)}d`);
  }
  if (tree.vigor <= 30 && repot === 'ok') notes.push('Low vigor - repotting would refresh it');

  const score = scoreTree(tree);
  const bars = (
    [
      ['Vitality', tree.vitality, 0x78c864],
      ['Water', tree.waterLevel, 0x64a0dc],
      ['Vigor', tree.vigor, 0xdcb450],
    ] as const
  ).map(([label, value, color], i) => ({
    label,
    value,
    max: 100 as const,
    text: `${String(Math.floor(value))}/100`,
    color,
    x: LEFT,
    y: barsTop + i * line,
    trackX: BAR_TRACK_X,
    trackW: BAR_TRACK_W,
    textX: BAR_TEXT_X,
  }));

  const skipCost = skipTimeCost(SKIP_DAYS);
  const fertilizer = state.inventory.fertilizer;
  const fed =
    state.day < tree.fertilizedUntilDay
      ? `  |  Fertilized: ${String(tree.fertilizedUntilDay - state.day)}d left`
      : '';

  return {
    key: `tree:${String(tree.id)}`,
    title: treeLabel(tree),
    stats: stats.map((text, i) => ({ text, x: LEFT, y: row(i) })),
    notes: notes.map((text, i) => ({ text, x: LEFT, y: row(stats.length + i) })),
    score: { text: `Score: ${String(score.total)} / 100`, x: SCORE_X, y: scoreTop },
    breakdown: score.breakdown.map((c, i) => {
      const y = scoreTop + (i + 1) * line;
      const value = c.isMultiplier ? `x ${c.value.toFixed(2)}` : `${c.points.toFixed(1)} pts`;
      return {
        label: { text: c.label, x: SCORE_X, y },
        value: { text: value, x: SCORE_VALUE_X, y },
      };
    }),
    bars,
    buttons: [
      ...spread(buttonY, [
        ['water', 'Water', true],
        ['fertilise', 'Fertilise', inventoryHas(state.inventory, 'fertilizer', 1) && !dormant],
        [
          'skip',
          `Skip ${String(SKIP_DAYS)}d (${String(skipCost)}f)`,
          inventoryHas(state.inventory, 'fertilizer', skipCost),
        ],
        ['pickup', 'Pick up', true],
        ['view', 'View in 3D', true],
      ]),
      // The prototype's second row; Repot needs repot_check ok and a pot of either tier.
      ...spread(button2Y, [
        ['rename', 'Rename', true],
        ['style', 'Set Style', true],
        ['sell', 'Sell', true],
        [
          'repot',
          'Repot',
          repot === 'ok' &&
            (inventoryHas(state.inventory, 'pot', 1) ||
              inventoryHas(state.inventory, 'fancy_pot', 1)),
        ],
      ]),
    ],
    footer: {
      text:
        `Fertilizer: ${String(fertilizer)}  |  Wire: ${String(state.inventory.wire)}` +
        `  |  Day: ${String(state.day)}  |  $${String(state.money)}${fed}`,
      x: LEFT,
      y: INSPECTOR_FOOTER_Y,
    },
  };
}

/** One row of buttons at `y` from the left inset to the right one, equal gaps between them. */
function spread(
  y: number,
  items: readonly [InspectorButtonId, string, boolean][],
): InspectorButton[] {
  const widths = items.map(([, label]) => label.length * GLYPH_W);
  const gap = (RIGHT - LEFT - widths.reduce((a, b) => a + b, 0)) / (items.length - 1);
  let x = LEFT;
  return items.map(([id, label, enabled], i) => {
    const button = { id, label, enabled, x, y };
    x += (widths[i] ?? 0) + gap;
    return button;
  });
}

/**
 * The inspector's Water, Fertilise and Skip buttons; false when refused. The
 * button is already greyed in that case: the Dormant note explains a dormant
 * Fertilise, and the footer's `Fertilizer: N` count a shortage, as in the
 * prototype, which had no out-of-fertiliser note. Water and a successful Skip
 * advance the tutorial as the prototype's buttons did.
 */
export function inspectorAction(
  state: GameState,
  tree: BonsaiTree,
  id: InspectorCare,
  rng: Rng = Math.random,
): boolean {
  switch (id) {
    case 'water':
      waterTree(tree, state);
      tutorialAdvanceIf(state, TUTORIAL_WATER);
      return true;
    case 'fertilise':
      return fertilizeTree(tree, state);
    case 'skip':
      if (!skipTreeTime(tree, state, SKIP_DAYS, rng)) return false;
      tutorialAdvanceIf(state, TUTORIAL_SKIP_WEEK);
      return true;
  }
}
