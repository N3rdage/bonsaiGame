/**
 * The tutorial corner panel (obj_game_controller Draw_64), which also carries
 * the first-dormancy season tip (src/sim/seasonTip.ts), and its Skip
 * confirmation (obj_ui_tutorial_skip_confirm), in logical px on the 480x270
 * canvas. Pure; the texts come from src/sim/tutorial.ts and WorldScene draws
 * them, the corner panel at HUD depth and the confirmation as a modal panel.
 */

import { TUTORIAL_DONE, tutorialStepBody, tutorialStepLabel } from '../sim/tutorial';
import { INTERACT_BUTTON } from './menu';
import { PANEL_INSET, panelClose, rowY, wrapLines, type PanelModel } from './panels';
import { estimatedBox, hitRect, type UiMetrics } from './uiScale';

/**
 * The corner box's left edge, bottom and width; its height follows the body,
 * upward from the bottom (the prototype's 340 px box, 16 from the right,
 * halved and widened to fit the labels at 8 px). It sits bottom-right, just
 * above `Interact (E)`, where the prototype put it while the viewer was open:
 * the prototype's top-right spot covers the display pedestals (the prototype's
 * shed's, now the lounge's and the study's).
 */
export const TUTORIAL_BOX = { x: 282, bottom: 248, w: 190 } as const;
/** Left inset of the texts. */
export const TUTORIAL_INSET = 6;
/** Characters per body line at 8 px: the inner width in the monospace fallback (about 4.8 px a glyph; VT323 is 3.2). */
export const TUTORIAL_WRAP = 36;
/** Height of the hint and Skip line (Skip is a 10 px button). */
const SKIP_LINE_H = 12;
/**
 * Offset of the heading from the top; the step label sits a label and 1 px
 * below it, the body a line pitch below that (at 8 px: 4, 13, 23, the
 * prototype's 8, 26, 46 halved).
 */
const HEADING_DY = 4;
/** Gap above the hint and Skip line, and under it. */
const GAP = 4;

/** Pitch of the label-sized body lines: 10 at 8 px. */
export function tutorialLineH(ui: UiMetrics): number {
  return ui.label + 2;
}

/** Characters per body line at `ui`'s label size: TUTORIAL_WRAP at 8 px, fewer as the glyphs grow. */
export function tutorialWrap(ui: UiMetrics): number {
  return Math.floor((TUTORIAL_WRAP * 8) / ui.label);
}

/**
 * The lowest the box's bottom can sit for Skip's tap target to clear
 * `Interact (E)`'s: TUTORIAL_BOX.bottom while the targets are small, higher
 * where they are taller.
 */
function boxBottom(ui: UiMetrics): number {
  const interact = hitRect(
    estimatedBox('Interact (E)', INTERACT_BUTTON.right, INTERACT_BUTTON.bottom, 1, 1, ui),
    ui.hit,
  );
  // Skip's text sits SKIP_LINE_H + GAP above the bottom; its target reaches half a target below its centre.
  const below = ui.body / 2 + Math.max(ui.hit, ui.body) / 2;
  const skipY = Math.floor(interact.y - below);
  return Math.min(TUTORIAL_BOX.bottom, skipY + SKIP_LINE_H + GAP);
}

/** The prototype's heading green rgb(170, 200, 150), body grey rgb(190, 190, 190) and hint rgb(140, 160, 130). */
export const TUTORIAL_HEADING_COLOR = '#aac896';
const LABEL_COLOR = '#ffffff';
const BODY_COLOR = '#bebebe';
const HINT_COLOR = '#8ca082';

/** One 8 px line, origin top-left. */
export interface TutorialText {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly color: string;
}

export interface TutorialPanelModel {
  readonly box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  /** Heading, label, the wrapped body lines and the notebook hint. */
  readonly texts: readonly TutorialText[];
  /**
   * The button's top-right corner, its text and control id: `Skip`
   * (`tutorial-skip`) for a step, `Got it` (`tip-dismiss`) for the season tip;
   * disabled while a modal panel is open.
   */
  readonly button: {
    readonly x: number;
    readonly y: number;
    readonly enabled: boolean;
    readonly label: string;
    readonly id: string;
  };
}

/** The season tip split for the corner panel: its first sentence as the label, the rest as the body. */
export function seasonTipParts(tip: string): { label: string; body: string } {
  const end = tip.indexOf('. ');
  return end < 0
    ? { label: tip, body: '' }
    : { label: tip.slice(0, end + 1), body: tip.slice(end + 2) };
}

/**
 * The corner panel at `ui`'s sizes: the season `tip` while one is held
 * (heading `Seasons`, `Got it` in Skip's place, shown even once the tutorial
 * is done), else `step`'s, or undefined once the tutorial is done. The texts
 * are label-sized; the box rises where the button's tap target would reach
 * `Interact (E)`'s.
 */
export function tutorialPanel(
  step: number,
  modalOpen: boolean,
  ui: UiMetrics,
  tip?: string,
): TutorialPanelModel | undefined {
  if (tip === undefined && step === TUTORIAL_DONE) return undefined;
  const parts =
    tip === undefined
      ? { heading: 'Tutorial', label: tutorialStepLabel(step), body: tutorialStepBody(step) }
      : { heading: 'Seasons', ...seasonTipParts(tip) };
  // Wider in proportion to the label size, from the same right edge, so the longest step label still fits.
  const w = Math.round((TUTORIAL_BOX.w * ui.label) / 8);
  const x = TUTORIAL_BOX.x + TUTORIAL_BOX.w - w;
  const bottom = boxBottom(ui);
  const left = x + TUTORIAL_INSET;
  const lineH = tutorialLineH(ui);
  const labelDy = HEADING_DY + ui.label + 1;
  const bodyDy = labelDy + lineH;
  const body = wrapLines(parts.body, tutorialWrap(ui));
  const h = bodyDy + body.length * lineH + GAP + SKIP_LINE_H + GAP;
  const y = bottom - h;
  const skipY = y + bodyDy + body.length * lineH + GAP;
  return {
    box: { x, y, w, h },
    texts: [
      { text: parts.heading, x: left, y: y + HEADING_DY, color: TUTORIAL_HEADING_COLOR },
      { text: parts.label, x: left, y: y + labelDy, color: LABEL_COLOR },
      ...body.map((text, i) => ({
        text,
        x: left,
        y: y + bodyDy + i * lineH,
        color: BODY_COLOR,
      })),
      { text: 'Press J for notebook', x: left, y: skipY + 2, color: HINT_COLOR },
    ],
    button: {
      x: x + w - TUTORIAL_INSET,
      y: skipY,
      enabled: !modalOpen,
      ...(tip === undefined
        ? { label: 'Skip', id: 'tutorial-skip' }
        : { label: 'Got it', id: 'tip-dismiss' }),
    },
  };
}

/** The confirmation's box, centred: two wrapped lines above Cancel, Close and Skip. */
export const SKIP_CONFIRM_PANEL = { x: 90, y: 80, w: 300, h: 110, rowSpacing: 14 } as const;
/** Width of a 10 px glyph in the monospace fallback, an upper bound (VT323 is 4 px). */
const GLYPH_W = 6;
/** Characters per line inside SKIP_CONFIRM_PANEL at 10 px. */
const CONFIRM_WRAP = 46;
/** obj_ui_tutorial_skip_confirm's second line, rgb(180, 180, 180). */
const CONFIRM_NOTE_COLOR = '#b4b4b4';

/** obj_ui_tutorial_skip_confirm: Cancel closes, Skip calls `tutorialSkip`; both sit on Close's line. */
export function skipConfirmPanel(): PanelModel {
  const box = SKIP_CONFIRM_PANEL;
  const left = box.x + PANEL_INSET;
  const lines = [
    ...wrapLines("The corner prompts will go away and you'll be on your own.", CONFIRM_WRAP).map(
      (text) => ({ text, color: '#ffffff' }),
    ),
    ...wrapLines(
      'You can still figure things out by walking up to objects and pressing E.',
      CONFIRM_WRAP,
    ).map((text) => ({ text, color: CONFIRM_NOTE_COLOR })),
  ];
  const buttons = panelClose(box).y;
  return {
    key: 'tutorial-skip',
    title: 'Skip Tutorial?',
    box,
    rows: [
      ...lines.map((line, i) => ({ ...line, id: '', x: left, y: rowY(box, i) })),
      { text: 'Cancel', id: 'panel-cancel', x: left, y: buttons },
      {
        text: 'Skip',
        id: 'panel-skip',
        x: box.x + box.w - PANEL_INSET - 'Skip'.length * GLYPH_W,
        y: buttons,
      },
    ],
  };
}
