import { describe, expect, it } from 'vitest';
import {
  TUTORIAL_DONE,
  TUTORIAL_TRAIN,
  TUTORIAL_WATER,
  tutorialAllSteps,
  tutorialStepBody,
  tutorialStepLabel,
} from '../sim/tutorial';
import { DAYS_PER_SEASON } from '../sim/seasons';
import { seasonTipFor } from '../sim/seasonTip';
import { SPECIES, SPECIES_KEYS } from '../sim/species';
import { createNewGameState } from '../sim/state';
import { createTree } from '../sim/tree';
import { GARDEN_ROOM } from './gardenRoom';
import {
  CARRY_TEXT,
  INTERACT_BUTTON,
  MENU_BUTTON,
  NOTEBOOK_BUTTON,
  VIEW_BUTTON,
  menuItems,
  type MenuOptions,
} from './menu';
import { PEDESTAL_LABEL_DY } from './roomArt';
import { LOUNGE_ROOM } from './loungeRoom';
import type { Prop } from './shedRoom';
import { STUDY_ROOM } from './studyRoom';
import { PANEL_INSET, panelClose, panelTitleY } from './panels';
import {
  SKIP_CONFIRM_PANEL,
  TUTORIAL_BOX,
  seasonTipParts,
  skipConfirmPanel,
  tutorialLineH,
  tutorialPanel,
  tutorialWrap,
} from './tutorialPanel';
import {
  DESKTOP_UI,
  PHONE_UI,
  estimatedBox,
  hitRect,
  rectsOverlap,
  type UiMetrics,
  type UiRect,
} from './uiScale';

// 10 px monospace, the fallback and the widest face text can draw in (VT323 is 0.4 em): about 0.6 em a glyph (6 px) and a 12 px line. Generous upper bounds.
const GLYPH_10 = 6;
const LINE_10 = 12;
/** The first day of winter. */
const WINTER = 3 * DAYS_PER_SEASON + 1;

describe('tutorial corner panel', () => {
  it('shows the heading, the step label, the wrapped body and the hint while a step is active', () => {
    const m = tutorialPanel(TUTORIAL_WATER, false, DESKTOP_UI);
    expect(m?.texts.map((t) => t.text)).toEqual([
      'Tutorial',
      "Water Granny's juniper",
      "Press E on Granny's juniper to",
      'inspect it, then click Water.',
      'Press J for notebook',
    ]);
    expect(m?.button.enabled).toBe(true);
  });

  it('is hidden once the tutorial is done', () => {
    expect(tutorialPanel(TUTORIAL_DONE, false, DESKTOP_UI)).toBeUndefined();
  });

  it('disables Skip while a modal panel is open', () => {
    expect(tutorialPanel(TUTORIAL_WATER, true, DESKTOP_UI)?.button.enabled).toBe(false);
  });

  it('grows upward with the body: one line pitch per extra body line, Skip where it was', () => {
    const two = tutorialPanel(TUTORIAL_WATER, false, DESKTOP_UI);
    const three = tutorialPanel(TUTORIAL_TRAIN, false, DESKTOP_UI);
    expect(two?.texts).toHaveLength(5);
    expect(three?.texts).toHaveLength(6);
    expect((three?.box.h ?? 0) - (two?.box.h ?? 0)).toBe(tutorialLineH(DESKTOP_UI));
    expect(three?.box.y).toBe((two?.box.y ?? 0) - tutorialLineH(DESKTOP_UI));
    expect(three?.button.y).toBe(two?.button.y);
  });

  it('fits every step inside its box, bottom-right, under the carry line and above Interact', () => {
    const { bottom } = TUTORIAL_BOX;
    const right = TUTORIAL_BOX.x + TUTORIAL_BOX.w;
    expect(right).toBeLessThanOrEqual(480 - 8);
    for (const ui of [DESKTOP_UI, PHONE_UI]) {
      // 0.6 em a glyph in the monospace fallback: 4.8 px at 8 px, 6 at 10.
      const glyph = ui.label * 0.6 + 0.1;
      for (const step of tutorialAllSteps()) {
        const m = tutorialPanel(step, false, ui);
        if (!m) throw new Error('no panel');
        expect(m.box.y + m.box.h).toBeLessThanOrEqual(bottom);
        expect(m.box.x + m.box.w).toBe(right);
        // Clear of the Notebook button's tap target to its left.
        expect(m.box.x).toBeGreaterThan(NOTEBOOK_BUTTON.left + 'Notebook (J)'.length * GLYPH_10);
        expect(m.box.y).toBeGreaterThanOrEqual(CARRY_TEXT.top + LINE_10);
        let above = -Infinity;
        for (const t of m.texts) {
          expect(t.x + t.text.length * glyph).toBeLessThanOrEqual(right);
          expect(t.y + ui.label).toBeLessThanOrEqual(m.button.y + LINE_10);
          expect(t.y - above).toBeGreaterThanOrEqual(ui.label);
          above = t.y;
        }
        const hint = m.texts.at(-1);
        expect((hint?.x ?? 0) + 'Press J for notebook'.length * glyph).toBeLessThan(
          m.button.x - 'Skip'.length * GLYPH_10,
        );
        expect(m.button.y + LINE_10).toBeLessThanOrEqual(m.box.y + m.box.h);
        expect(m.box.y + m.box.h).toBeLessThan(INTERACT_BUTTON.bottom - LINE_10);
        expect(m.texts[1]?.text).toBe(tutorialStepLabel(step));
        expect(
          m.texts
            .slice(2, -1)
            .map((t) => t.text)
            .join(' '),
        ).toBe(tutorialStepBody(step));
      }
    }
  });

  it('is laid out as before at the desktop scale and wraps shorter at 10 px', () => {
    expect(tutorialLineH(DESKTOP_UI)).toBe(10);
    expect(tutorialWrap(DESKTOP_UI)).toBe(36);
    expect(tutorialWrap(PHONE_UI)).toBe(28);
    expect(tutorialLineH(PHONE_UI)).toBe(12);
    const m = tutorialPanel(TUTORIAL_WATER, false, DESKTOP_UI);
    expect(m?.box).toEqual({ x: 282, y: 185, w: 190, h: 63 });
    expect(m?.texts.map((t) => t.y)).toEqual([189, 198, 208, 218, 234]);
    expect(m?.button).toEqual({
      x: 466,
      y: 232,
      enabled: true,
      label: 'Skip',
      id: 'tutorial-skip',
    });
  });

  it("keeps the HUD's visible tap targets apart and inside the canvas on the phone", () => {
    const winterTip = seasonTipFor({ ...createNewGameState(), day: WINTER }, WINTER - 1);
    const hud = (ui: UiMetrics, step: number, menu: MenuOptions, tip?: string): UiRect[] => {
      const m = tutorialPanel(step, false, ui, tip);
      if (!m) throw new Error('no panel');
      const boxes = [
        estimatedBox('View tree (V)', VIEW_BUTTON.left, VIEW_BUTTON.bottom, 0, 1, ui),
        estimatedBox('Notebook (J)', NOTEBOOK_BUTTON.left, NOTEBOOK_BUTTON.bottom, 0, 1, ui),
        estimatedBox('Menu', MENU_BUTTON.left, MENU_BUTTON.top, 0, 0, ui),
        estimatedBox('Interact (E)', INTERACT_BUTTON.right, INTERACT_BUTTON.bottom, 1, 1, ui),
        estimatedBox(m.button.label, m.button.x, m.button.y, 1, 0, ui),
        ...menuItems(menu, ui).map((item) => estimatedBox(item.label, item.x, item.y, 0, 0.5, ui)),
      ];
      return boxes.map((b) => hitRect(b, ui.hit));
    };
    expect(winterTip).toBeDefined();
    for (const ui of [PHONE_UI, DESKTOP_UI]) {
      for (const [step, tip] of [
        ...tutorialAllSteps().map((s) => [s, undefined] as const),
        [TUTORIAL_DONE, winterTip] as const,
      ]) {
        for (const menu of [
          { carrying: false, placeable: false, placing: false },
          { carrying: true, placeable: false, placing: false },
          { carrying: true, placeable: true, placing: true, nextKind: 'Floor shelf' },
        ]) {
          const rects = hud(ui, step, menu, tip);
          rects.forEach((a, i) => {
            expect(a.w).toBeGreaterThanOrEqual(ui.hit);
            expect(a.h).toBeGreaterThanOrEqual(ui.hit);
            expect(a.x).toBeGreaterThanOrEqual(0);
            expect(a.y).toBeGreaterThanOrEqual(0);
            expect(a.x + a.w).toBeLessThanOrEqual(480);
            expect(a.y + a.h).toBeLessThanOrEqual(270);
            for (const b of rects.slice(i + 1)) expect(rectsOverlap(a, b)).toBe(false);
          });
        }
      }
    }
  });

  it('clears the house pedestals with their labels and the garden source plants', () => {
    const below = (p: Prop): number =>
      p.pedestalKey === undefined ? p.y + p.h / 2 : PEDESTAL_LABEL_DY + p.y + LINE_10;
    const props = [...LOUNGE_ROOM.props, ...STUDY_ROOM.props, ...GARDEN_ROOM.props].filter(
      (p) => p.pedestalKey !== undefined || p.speciesKey !== undefined,
    );
    expect(props).toHaveLength(7);
    for (const step of tutorialAllSteps()) {
      const m = tutorialPanel(step, false, DESKTOP_UI);
      if (!m) throw new Error('no panel');
      for (const p of props) expect(m.box.y).toBeGreaterThan(below(p));
    }
  });
});

describe('season tip in the corner panel', () => {
  const tip = (state = createNewGameState()): string => {
    state.day = WINTER;
    const text = seasonTipFor(state, WINTER - 1);
    if (text === undefined) throw new Error('no tip');
    return text;
  };

  it('splits the tip into its first sentence and the rest', () => {
    expect(seasonTipParts('Winter: Pine is dormant. Growth pauses. Watch.')).toEqual({
      label: 'Winter: Pine is dormant.',
      body: 'Growth pauses. Watch.',
    });
    expect(seasonTipParts('One line')).toEqual({ label: 'One line', body: '' });
  });

  it('shows the tip under a Seasons heading with Got it, even once the tutorial is done', () => {
    const text = tip();
    for (const step of [TUTORIAL_WATER, TUTORIAL_DONE]) {
      const m = tutorialPanel(step, false, DESKTOP_UI, text);
      if (!m) throw new Error('no panel');
      const { label, body } = seasonTipParts(text);
      expect(m.texts.slice(0, 2).map((t) => t.text)).toEqual(['Seasons', label]);
      expect(
        m.texts
          .slice(2, -1)
          .map((t) => t.text)
          .join(' '),
      ).toBe(body);
      expect(m.texts.at(-1)?.text).toBe('Press J for notebook');
      expect([m.button.label, m.button.id, m.button.enabled]).toEqual([
        'Got it',
        'tip-dismiss',
        true,
      ]);
    }
    expect(tutorialPanel(TUTORIAL_DONE, true, DESKTOP_UI, text)?.button.enabled).toBe(false);
  });

  it("puts Got it where Skip was and fits the box, on desktop and the phone, for every species' tip", () => {
    const right = TUTORIAL_BOX.x + TUTORIAL_BOX.w;
    const tips = SPECIES_KEYS.filter((k) => !SPECIES[k].seasonsActive.includes('winter')).map(
      (key) => {
        const state = createNewGameState();
        state.trees = [{ ...createTree(key, 'seed', 0), location: 'shed' }];
        return tip(state);
      },
    );
    expect(tips.length).toBeGreaterThan(0);
    for (const ui of [DESKTOP_UI, PHONE_UI]) {
      const glyph = ui.label * 0.6 + 0.1;
      const step = tutorialPanel(TUTORIAL_WATER, false, ui);
      if (!step) throw new Error('no panel');
      const stepBottom = step.box.y + step.box.h;
      for (const text of tips) {
        const m = tutorialPanel(TUTORIAL_WATER, false, ui, text);
        if (!m) throw new Error('no panel');
        // The same bottom edge, and the button the same distance above it: where Skip was.
        expect(m.box.y + m.box.h).toBe(stepBottom);
        expect([m.button.x, m.button.y - stepBottom]).toEqual([
          step.button.x,
          step.button.y - stepBottom,
        ]);
        expect(m.box.x + m.box.w).toBe(right);
        expect(m.box.y).toBeGreaterThanOrEqual(CARRY_TEXT.top + LINE_10);
        for (const t of m.texts) {
          expect(t.x + t.text.length * glyph).toBeLessThanOrEqual(right);
          expect(t.y + ui.label).toBeLessThanOrEqual(m.button.y + LINE_10);
        }
        const hint = m.texts.at(-1);
        expect((hint?.x ?? 0) + 'Press J for notebook'.length * glyph).toBeLessThan(
          m.button.x - 'Got it'.length * GLYPH_10,
        );
        expect(m.button.y + LINE_10).toBeLessThanOrEqual(m.box.y + m.box.h);
        expect(m.box.y + m.box.h).toBeLessThan(INTERACT_BUTTON.bottom - LINE_10);
      }
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
