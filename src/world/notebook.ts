/**
 * Granny's notebook (obj_ui_notebook) as a PanelModel: one page per tutorial
 * step, a Seasons page with the season rules (new in the port), and a finale
 * once the tutorial is done, each step page with its title, status
 * badge and texts from src/sim/tutorial.ts, and `< Prev` / `Next >` on
 * Close's line. Pure; WorldScene keeps the page index and reopens the panel
 * on the new page.
 */

import {
  TUTORIAL_DONE,
  tutorialAllSteps,
  tutorialStepBody,
  tutorialStepFlavour,
  tutorialStepLabel,
  tutorialStepStatus,
} from '../sim/tutorial';
import { REPOT_COOLDOWN_DAYS, REPOT_SEASONS } from '../sim/growth';
import { isDormant } from '../sim/seasonTip';
import {
  DAYS_PER_SEASON,
  SEASONS,
  seasonGrowthMultiplier,
  seasonLabel,
  seasonWaterMultiplier,
  type Season,
} from '../sim/seasons';
import { CUTTING_SEASONS } from '../sim/sourcePlant';
import { SPECIES_KEYS, getSpecies } from '../sim/species';
import { PRUNE_SEASONS } from '../sim/training';
import type { GameState } from '../sim/types';
import { PANEL_INSET, panelClose, rowY, wrapLines, type PanelModel, type PanelRow } from './panels';

/** The hook's `panel` while the notebook is open. */
export const NOTEBOOK_KEY = 'notebook';

/** The notebook's box, centred on the canvas. */
export const NOTEBOOK_PANEL = { x: 20, y: 25, w: 440, h: 220, rowSpacing: 14 } as const;
/** Characters per line at 10 px (about 6 px a glyph) inside the box; the quick prompt is indented. */
export const NOTEBOOK_WRAP = 68;
const PROMPT_INDENT = 12;
const PROMPT_WRAP = 66;
/** Left edge of `Page i / n`, room for `Page 10 / 10` before the box's inset. */
const INDICATOR_X = NOTEBOOK_PANEL.x + NOTEBOOK_PANEL.w - PANEL_INSET - 72;

/** obj_ui_notebook's colours: title rgb(220, 220, 180), indicator rgb(140, 140, 140), prompt heading rgb(170, 200, 150), prompt rgb(220, 220, 220). */
const TITLE_COLOR = '#dcdcb4';
const INDICATOR_COLOR = '#8c8c8c';
const FLAVOUR_COLOR = '#ffffff';
const PROMPT_HEADING_COLOR = '#aac896';
const PROMPT_COLOR = '#dcdcdc';
const BADGES = {
  completed: { text: 'done', color: '#8cc878' },
  active: { text: 'in progress', color: '#dcc878' },
  locked: { text: 'not yet', color: '#787878' },
} as const;

/** The Seasons page's entry in `notebookPages`; tutorial steps are 0 and up, TUTORIAL_DONE -1. */
export const SEASONS_PAGE = -2;
export const SEASONS_PAGE_TITLE = 'Seasons';

/** A multiplier as the page prints it: 1.3x, 1.0x. */
export function multiplierText(m: number): string {
  return `${m.toFixed(1)}x`;
}

/** Every species' name, and whether it ever rests. */
function dormancyText(): string {
  const resting: string[] = [];
  const awake: string[] = [];
  for (const key of SPECIES_KEYS) {
    const species = getSpecies(key);
    const seasons = SEASONS.filter((s) => isDormant(species, s));
    if (seasons.length > 0) resting.push(`${species.displayName} in ${seasons.join(' and ')}`);
    else awake.push(species.displayName);
  }
  const grows = awake.length > 0 ? ` ${awake.join(' and ')} grows all year.` : '';
  return `Dormant (no growth, no fertilising): ${resting.join(', ')}.${grows}`;
}

/**
 * The Seasons page's paragraphs, '' for a blank line: the season length,
 * each season's growth multiplier (for a species awake then) and water use
 * with what can be done in it, the repot cooldown and each species' dormancy.
 * Built from the sim's exports, so the page cannot drift from the rules.
 */
export function seasonsPageParagraphs(): string[] {
  const year = DAYS_PER_SEASON * SEASONS.length;
  const actions = (season: Season): string[] => [
    ...(REPOT_SEASONS.includes(season) ? ['repot'] : []),
    ...(CUTTING_SEASONS.includes(season) ? ['take cuttings'] : []),
    ...(PRUNE_SEASONS.includes(season) ? ['prune'] : []),
  ];
  return [
    `Each season lasts ${String(DAYS_PER_SEASON)} days, so a year is ${String(year)}; day 1 is spring.`,
    '',
    ...SEASONS.map((season) => {
      const can = actions(season);
      return (
        `${seasonLabel(season)}: growth ${multiplierText(seasonGrowthMultiplier(SEASONS, season))}, ` +
        `water use ${multiplierText(seasonWaterMultiplier(season))}` +
        (can.length > 0 ? `; ${can.join(', ')}` : '')
      );
    }),
    '',
    `Repots are ${String(REPOT_COOLDOWN_DAYS)} days apart. Wire and clip in any season.`,
    dormancyText(),
  ];
}

/** The pages the notebook turns through: every tutorial step, Seasons, then the finale once done. */
export function notebookPages(tutorialStep: number): number[] {
  const pages = [...tutorialAllSteps(), SEASONS_PAGE];
  return tutorialStep === TUTORIAL_DONE ? [...pages, TUTORIAL_DONE] : pages;
}

/** The page it opens on: the active step's, or the last once the tutorial is done. */
export function notebookOpeningPage(tutorialStep: number): number {
  const pages = notebookPages(tutorialStep);
  return tutorialStep === TUTORIAL_DONE
    ? pages.length - 1
    : Math.max(0, pages.indexOf(tutorialStep));
}

/** What page `page` shows at the top: the indicator, the title and the badge ('' on Seasons and the finale). */
export function notebookHeader(
  state: GameState,
  page: number,
): { indicator: string; title: string; badge: string } {
  const pages = notebookPages(state.tutorialStep);
  const step = pages[page] ?? TUTORIAL_DONE;
  const indicator = `Page ${String(page + 1)} / ${String(pages.length)}`;
  if (step === SEASONS_PAGE) return { indicator, title: SEASONS_PAGE_TITLE, badge: '' };
  if (step === TUTORIAL_DONE) return { indicator, title: 'All caught up', badge: '' };
  return {
    indicator,
    title: tutorialStepLabel(step),
    badge: BADGES[tutorialStepStatus(state, step)].text,
  };
}

/** Page `page` (an index into `notebookPages`) of the notebook over `state`. */
export function notebookPanel(state: GameState, page: number): PanelModel {
  const box = NOTEBOOK_PANEL;
  const left = box.x + PANEL_INSET;
  const pages = notebookPages(state.tutorialStep);
  const step = pages[page] ?? TUTORIAL_DONE;
  const header = notebookHeader(state, page);
  const line = (i: number, text: string, color: string, x = left): PanelRow => ({
    text,
    id: '',
    x,
    y: rowY(box, i),
    color,
  });
  const paragraph = (from: number, text: string, color: string): PanelRow[] =>
    wrapLines(text, NOTEBOOK_WRAP).map((t, i) => line(from + i, t, color));

  let content: PanelRow[];
  if (step === SEASONS_PAGE) {
    content = [];
    let i = 1;
    for (const text of seasonsPageParagraphs()) {
      const lines = text === '' ? [] : paragraph(i, text, FLAVOUR_COLOR);
      content.push(...lines);
      i += Math.max(1, lines.length);
    }
  } else if (step === TUTORIAL_DONE) {
    content = paragraph(2, tutorialStepFlavour(TUTORIAL_DONE), FLAVOUR_COLOR);
  } else {
    const status = tutorialStepStatus(state, step);
    const badge = line(1, header.badge, BADGES[status].color);
    if (status === 'locked') {
      content = [badge, line(3, 'Granny left this page blank for now.', BADGES.locked.color)];
    } else {
      const flavour = paragraph(3, tutorialStepFlavour(step), FLAVOUR_COLOR);
      const prompt = 4 + flavour.length;
      content = [
        badge,
        ...flavour,
        line(prompt, 'Quick prompt:', PROMPT_HEADING_COLOR),
        ...wrapLines(tutorialStepBody(step), PROMPT_WRAP).map((t, i) =>
          line(prompt + 1 + i, t, PROMPT_COLOR, left + PROMPT_INDENT),
        ),
      ];
    }
  }

  const footer = panelClose(box).y;
  return {
    key: NOTEBOOK_KEY,
    title: "Granny's Notebook",
    box,
    rows: [
      line(0, header.title, TITLE_COLOR),
      line(0, header.indicator, INDICATOR_COLOR, INDICATOR_X),
      ...content,
      { text: '< Prev', id: 'panel-prev', x: left, y: footer, enabled: page > 0 },
      {
        text: 'Next >',
        id: 'panel-next',
        x: left + 54,
        y: footer,
        enabled: page < pages.length - 1,
      },
    ],
  };
}
