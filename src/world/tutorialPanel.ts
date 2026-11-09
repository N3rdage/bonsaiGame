/**
 * The tutorial corner panel (obj_game_controller Draw_64) and its Skip
 * confirmation (obj_ui_tutorial_skip_confirm), in logical px on the 480x270
 * canvas. Pure; the texts come from src/sim/tutorial.ts and WorldScene draws
 * them, the corner panel at HUD depth and the confirmation as a modal panel.
 */

import { TUTORIAL_DONE, tutorialStepBody, tutorialStepLabel } from '../sim/tutorial';
import { PANEL_INSET, panelClose, rowY, wrapLines, type PanelModel } from './panels';

/** The corner box's left edge, top and width; its height follows the body (prototype 340 wide, 16 from the right, 32 down, halved and widened to fit the labels at 8 px). */
export const TUTORIAL_BOX = { x: 282, y: 28, w: 190 } as const;
/** Left inset of the texts. */
export const TUTORIAL_INSET = 6;
/** Pitch of the 8 px body lines. */
export const TUTORIAL_LINE_H = 10;
/** Characters per body line: the inner width at 8 px monospace (about 4.8 px a glyph). */
export const TUTORIAL_WRAP = 36;
/** Height of the hint and Skip line (Skip is a 10 px button). */
const SKIP_LINE_H = 12;
/** Offsets from the top: the heading, the step label, the first body line (prototype 8, 26, 46, halved). */
const HEADING_DY = 4;
const LABEL_DY = 13;
const BODY_DY = 23;
/** Gap above the hint and Skip line, and under it. */
const GAP = 4;

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
  /** Heading, step label, the wrapped body lines and the notebook hint. */
  readonly texts: readonly TutorialText[];
  /** The `Skip` button's top-right corner; disabled while a modal panel is open. */
  readonly skip: { readonly x: number; readonly y: number; readonly enabled: boolean };
}

/** The corner panel for `step`, or undefined once the tutorial is done. */
export function tutorialPanel(step: number, modalOpen: boolean): TutorialPanelModel | undefined {
  if (step === TUTORIAL_DONE) return undefined;
  const { x, y, w } = TUTORIAL_BOX;
  const left = x + TUTORIAL_INSET;
  const body = wrapLines(tutorialStepBody(step), TUTORIAL_WRAP);
  const skipY = y + BODY_DY + body.length * TUTORIAL_LINE_H + GAP;
  return {
    box: { x, y, w, h: skipY + SKIP_LINE_H + GAP - y },
    texts: [
      { text: 'Tutorial', x: left, y: y + HEADING_DY, color: TUTORIAL_HEADING_COLOR },
      { text: tutorialStepLabel(step), x: left, y: y + LABEL_DY, color: LABEL_COLOR },
      ...body.map((text, i) => ({
        text,
        x: left,
        y: y + BODY_DY + i * TUTORIAL_LINE_H,
        color: BODY_COLOR,
      })),
      { text: 'Press J for notebook', x: left, y: skipY + 2, color: HINT_COLOR },
    ],
    skip: { x: x + w - TUTORIAL_INSET, y: skipY, enabled: !modalOpen },
  };
}

/** The confirmation's box, centred: two wrapped lines above Cancel, Close and Skip. */
export const SKIP_CONFIRM_PANEL = { x: 90, y: 80, w: 300, h: 110, rowSpacing: 14 } as const;
/** Width of a 10 px monospace glyph, an upper bound. */
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
