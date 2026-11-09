/**
 * The tree inspector (obj_ui_tree_inspector/Create_0.gml) as plain data: the
 * stat lines, status notes, score breakdown, bars, buttons and footer, laid
 * out in logical px on the 480x270 canvas, and the dispatch of its care
 * actions. Pure; WorldScene draws the model and owns Pick up and View in 3D.
 *
 * The prototype's inspector filled its screen in one column; at 270 px the
 * stats run full width on top, then two columns (bars left, score right),
 * then the buttons and the footer.
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

/** Days the Skip button fast-forwards. */
export const SKIP_DAYS = 7;

/** The box, centred on the canvas; the 400x150 PANEL stays for the other panels. */
export const INSPECTOR_PANEL = { x: 20, y: 10, w: 440, h: 250 } as const;
/** Height of the title bar (obj_ui_panel's darker band). */
export const INSPECTOR_TITLE_H = 22;
/** Left and right inset of the content. */
export const INSPECTOR_INSET = 10;
/** Row pitch of the 8 px text. */
export const INSPECTOR_LINE = 11;
/** Upper bounds of a glyph's width: 8 px text (stats, notes, score, bars, footer) and 10 px (title, buttons). */
export const SMALL_GLYPH_W = 5;
export const GLYPH_W = 6;

const LEFT = INSPECTOR_PANEL.x + INSPECTOR_INSET;
const RIGHT = INSPECTOR_PANEL.x + INSPECTOR_PANEL.w - INSPECTOR_INSET;
const TOP = INSPECTOR_PANEL.y + INSPECTOR_TITLE_H + 8;
/** At most two notes: dormancy only outside spring, and one repot or low-vigor note. */
const NOTE_ROWS = 2;
const LOWER_TOP = TOP + (5 + NOTE_ROWS) * INSPECTOR_LINE + 6;
/** Bars: label, track and `N/100` columns (the GML's _x, _x + 120, _x + 330 scaled down). */
const BAR_TRACK_X = LEFT + 48;
const BAR_TRACK_W = 100;
const BAR_TEXT_X = BAR_TRACK_X + BAR_TRACK_W + 6;
/** Score column, and the breakdown's value column within it. */
const SCORE_X = INSPECTOR_PANEL.x + 220;
const SCORE_VALUE_X = SCORE_X + 125;
const BUTTON_Y = INSPECTOR_PANEL.y + INSPECTOR_PANEL.h - 30;
const FOOTER_Y = INSPECTOR_PANEL.y + INSPECTOR_PANEL.h - 12;

export const NOTE_COLOR = '#dcb450';
export const FOOTER_COLOR = '#969696';
export const DISABLED_COLOR = '#6e7a68';

/** One line of 8 px text; text origin (0, 0.5), so `y` is its vertical centre. */
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
export type InspectorButtonId = InspectorCare | 'pickup' | 'view';

export interface InspectorButton {
  /** The control id is `panel-<id>`. */
  readonly id: InspectorButtonId;
  readonly label: string;
  readonly enabled: boolean;
  /** Left edge and vertical centre, 10 px text. */
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

const row = (i: number): number => TOP + i * INSPECTOR_LINE;

export function inspectorPanel(tree: BonsaiTree, state: GameState): InspectorModel {
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
    `Pot: ${pot}  |  Soil: ${soil}`,
  ];

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
    y: LOWER_TOP + i * INSPECTOR_LINE,
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
    notes: notes.map((text, i) => ({ text, x: LEFT, y: row(5 + i) })),
    score: { text: `Score: ${String(score.total)} / 100`, x: SCORE_X, y: LOWER_TOP },
    breakdown: score.breakdown.map((c, i) => {
      const y = LOWER_TOP + (i + 1) * INSPECTOR_LINE;
      const value = c.isMultiplier ? `x ${c.value.toFixed(2)}` : `${c.points.toFixed(1)} pts`;
      return {
        label: { text: c.label, x: SCORE_X, y },
        value: { text: value, x: SCORE_VALUE_X, y },
      };
    }),
    bars,
    buttons: spread([
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
    footer: {
      text:
        `Fertilizer: ${String(fertilizer)}  |  Wire: ${String(state.inventory.wire)}` +
        `  |  Day: ${String(state.day)}  |  $${String(state.money)}${fed}`,
      x: LEFT,
      y: FOOTER_Y,
    },
  };
}

/** One row of buttons from the left inset to the right one, equal gaps between them. */
function spread(items: readonly [InspectorButtonId, string, boolean][]): InspectorButton[] {
  const widths = items.map(([, label]) => label.length * GLYPH_W);
  const gap = (RIGHT - LEFT - widths.reduce((a, b) => a + b, 0)) / (items.length - 1);
  let x = LEFT;
  return items.map(([id, label, enabled], i) => {
    const button = { id, label, enabled, x, y: BUTTON_Y };
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
