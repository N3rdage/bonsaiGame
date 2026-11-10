import { describe, expect, it } from 'vitest';
import {
  TUTORIAL_DONE,
  TUTORIAL_TRAIN,
  TUTORIAL_WATER,
  tutorialAllSteps,
  tutorialStepBody,
  tutorialStepLabel,
} from '../sim/tutorial';
import { GARDEN_ROOM } from './gardenRoom';
import { CARRY_TEXT, INTERACT_BUTTON } from './menu';
import { PEDESTAL_LABEL_DY } from './roomArt';
import { SHED_ROOM, type Prop } from './shedRoom';
import { PANEL_INSET, panelClose, panelTitleY } from './panels';
import {
  SKIP_CONFIRM_PANEL,
  TUTORIAL_BOX,
  TUTORIAL_LINE_H,
  skipConfirmPanel,
  tutorialPanel,
} from './tutorialPanel';

// 8 px monospace: about 0.6 em a glyph (4.8 px) and a 10 px line; 10 px: 6 and 12. Generous upper bounds.
const GLYPH_8 = 4.9;
const GLYPH_10 = 6;
const LINE_10 = 12;

describe('tutorial corner panel', () => {
  it('shows the heading, the step label, the wrapped body and the hint while a step is active', () => {
    const m = tutorialPanel(TUTORIAL_WATER, false);
    expect(m?.texts.map((t) => t.text)).toEqual([
      'Tutorial',
      "Water Granny's juniper",
      "Press E on Granny's juniper to",
      'inspect it, then click Water.',
      'Press J for notebook',
    ]);
    expect(m?.skip.enabled).toBe(true);
  });

  it('is hidden once the tutorial is done', () => {
    expect(tutorialPanel(TUTORIAL_DONE, false)).toBeUndefined();
  });

  it('disables Skip while a modal panel is open', () => {
    expect(tutorialPanel(TUTORIAL_WATER, true)?.skip.enabled).toBe(false);
  });

  it('grows upward with the body: one line pitch per extra body line, Skip where it was', () => {
    const two = tutorialPanel(TUTORIAL_WATER, false);
    const three = tutorialPanel(TUTORIAL_TRAIN, false);
    expect(two?.texts).toHaveLength(5);
    expect(three?.texts).toHaveLength(6);
    expect((three?.box.h ?? 0) - (two?.box.h ?? 0)).toBe(TUTORIAL_LINE_H);
    expect(three?.box.y).toBe((two?.box.y ?? 0) - TUTORIAL_LINE_H);
    expect(three?.skip.y).toBe(two?.skip.y);
  });

  it('fits every step inside its box, bottom-right, under the carry line and above Interact', () => {
    const { x, bottom, w } = TUTORIAL_BOX;
    expect(x + w).toBeLessThanOrEqual(480 - 8);
    for (const step of tutorialAllSteps()) {
      const m = tutorialPanel(step, false);
      if (!m) throw new Error('no panel');
      expect(m.box.y + m.box.h).toBe(bottom);
      expect(m.box.y).toBeGreaterThanOrEqual(CARRY_TEXT.top + LINE_10);
      for (const t of m.texts) {
        expect(t.x + t.text.length * GLYPH_8).toBeLessThanOrEqual(x + w);
        expect(t.y + TUTORIAL_LINE_H).toBeLessThanOrEqual(m.skip.y + LINE_10);
      }
      const hint = m.texts.at(-1);
      expect((hint?.x ?? 0) + 'Press J for notebook'.length * GLYPH_8).toBeLessThan(
        m.skip.x - 'Skip'.length * GLYPH_10,
      );
      expect(m.skip.y + LINE_10).toBeLessThanOrEqual(m.box.y + m.box.h);
      expect(m.box.y + m.box.h).toBeLessThan(INTERACT_BUTTON.bottom - LINE_10);
      expect(m.texts[1]?.text).toBe(tutorialStepLabel(step));
      expect(
        m.texts
          .slice(2, -1)
          .map((t) => t.text)
          .join(' '),
      ).toBe(tutorialStepBody(step));
    }
  });

  it('clears the shed pedestals with their labels and the garden source plants', () => {
    const below = (p: Prop): number =>
      p.pedestalKey === undefined ? p.y + p.h / 2 : PEDESTAL_LABEL_DY + p.y + LINE_10;
    const props = [...SHED_ROOM.props, ...GARDEN_ROOM.props].filter(
      (p) => p.pedestalKey !== undefined || p.speciesKey !== undefined,
    );
    expect(props).toHaveLength(5);
    for (const step of tutorialAllSteps()) {
      const m = tutorialPanel(step, false);
      if (!m) throw new Error('no panel');
      for (const p of props) expect(m.box.y).toBeGreaterThan(below(p));
    }
  });
});

describe('skip confirmation', () => {
  it('has the two lines verbatim, Cancel and Skip', () => {
    const m = skipConfirmPanel();
    expect([m.key, m.title]).toEqual(['tutorial-skip', 'Skip Tutorial?']);
    const plain = m.rows.filter((r) => r.id === '').map((r) => r.text);
    expect(plain.join(' ')).toBe(
      "The corner prompts will go away and you'll be on your own. " +
        'You can still figure things out by walking up to objects and pressing E.',
    );
    expect(m.rows.filter((r) => r.id !== '').map((r) => [r.id, r.text])).toEqual([
      ['panel-cancel', 'Cancel'],
      ['panel-skip', 'Skip'],
    ]);
  });

  it('fits the 480x270 canvas, the buttons on the line of Close and clear of it', () => {
    const box = SKIP_CONFIRM_PANEL;
    expect(box.x * 2 + box.w).toBe(480);
    expect(box.y * 2 + box.h).toBe(270);
    const close = panelClose(box);
    const closeHalf = ('Close (Esc)'.length * GLYPH_10) / 2;
    let above = panelTitleY(box);
    for (const row of skipConfirmPanel().rows) {
      const left = row.x ?? box.x + PANEL_INSET;
      expect(left + row.text.length * GLYPH_10).toBeLessThanOrEqual(box.x + box.w - PANEL_INSET);
      if (row.id === '') {
        expect(row.y - above).toBeGreaterThanOrEqual(LINE_10);
        above = row.y;
      } else {
        expect(row.y).toBe(close.y);
        const right = left + row.text.length * GLYPH_10;
        expect(right < close.x - closeHalf || left > close.x + closeHalf).toBe(true);
      }
    }
    expect(above + LINE_10 / 2).toBeLessThanOrEqual(close.y - LINE_10 / 2);
  });
});
