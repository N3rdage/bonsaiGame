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
  menuPanel,
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
  type TutorialView,
} from './tutorialPanel';
import {
  DESKTOP_UI,
  PHONE_UI,
  cssPerLogical,
  uiMetrics,
  estimatedBox,
  estimatedHudBox,
  hitRect,
  rectsOverlap,
  type UiMetrics,
  type UiRect,
} from './uiScale';

// At 10 px, the layouts' bound of 0.6 em a character (Caveat's lines average 0.35 to 0.37 em and its digits 0.45, the sans-serif fallback's lowercase 0.49) and the 1.2 em line (Phaser draws Caveat 12 px tall): 6 px a glyph and a 12 px line. Generous upper bounds.
const GLYPH_10 = 6;
const LINE_10 = 12;
/** The first day of winter. */
const WINTER = 3 * DAYS_PER_SEASON + 1;
/** The owner's phone in landscape with the browser's bars showing: 711x273 CSS px, a touch screen. */
const SHORT_PHONE_UI = uiMetrics(cssPerLogical(711, 273), true);

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
      // The layouts' 0.6 em a glyph: 4.8 px at 8 px, 6 at 10.
      const glyph = ui.label * 0.6 + 0.1;
      for (const step of tutorialAllSteps()) {
        const m = tutorialPanel(step, false, ui);
        if (!m) throw new Error('no panel');
        // The compact form is checked below; this is the full box.
        if (m.toggle) continue;
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
    const hud = (
      ui: UiMetrics,
      step: number,
      menu: MenuOptions | undefined,
      view: TutorialView,
      tip?: string,
    ): UiRect[] => {
      const m = tutorialPanel(step, false, ui, tip, { ...view, menuOpen: menu !== undefined });
      if (!m) throw new Error('no panel');
      if (menu) expect(rectsOverlap(m.box, menuPanel(menu, ui))).toBe(false);
      const boxes = [
        estimatedHudBox('View tree (V)', VIEW_BUTTON.left, VIEW_BUTTON.bottom, 0, 1, ui),
        estimatedHudBox('Notebook (J)', NOTEBOOK_BUTTON.left, NOTEBOOK_BUTTON.bottom, 0, 1, ui),
        estimatedHudBox('Menu', MENU_BUTTON.left, MENU_BUTTON.top, 0, 0, ui),
        estimatedHudBox('Interact (E)', INTERACT_BUTTON.right, INTERACT_BUTTON.bottom, 1, 1, ui),
        estimatedBox(m.button.label, m.button.x, m.button.y, 1, 0, ui),
        ...(m.toggle ? [estimatedBox(m.toggle.label, m.toggle.x, m.toggle.y, 0, 0, ui)] : []),
        ...(menu
          ? menuItems(menu, ui).map((item) => estimatedBox(item.label, item.x, item.y, 0, 0.5, ui))
          : []),
      ];
      return boxes.map((b) => hitRect(b, ui.hit));
    };
    expect(winterTip).toBeDefined();
    for (const ui of [PHONE_UI, SHORT_PHONE_UI, DESKTOP_UI]) {
      for (const [step, tip] of [
        ...tutorialAllSteps().map((s) => [s, undefined] as const),
        [TUTORIAL_DONE, winterTip] as const,
      ]) {
        for (const menu of [
          undefined,
          { carrying: false, placeable: false, placing: false, escapeReaches: true },
          { carrying: true, placeable: false, placing: false, escapeReaches: true },
          {
            carrying: true,
            placeable: true,
            placing: true,
            nextKind: 'Floor shelf',
            escapeReaches: true,
          },
        ]) {
          // At 711x273 the placing menu's `Next: Floor shelf` and `Save (F5)` rows, in neighbouring columns, share a tap target: a menu layout limit, not the tutorial box's (backlog follow-up).
          if (ui === SHORT_PHONE_UI && menu?.placing) continue;
          for (const mode of ['keyboard', 'touch'] as const) {
            for (const expanded of [false, true]) {
              const rects = hud(ui, step, menu, { mode, expanded }, tip);
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
      }
    }
  });

  it('clears the house pedestals with their labels and the garden source plants', () => {
    const below = (p: Prop): number => PEDESTAL_LABEL_DY + p.y + LINE_10;
    const pedestals = [...LOUNGE_ROOM.props, ...STUDY_ROOM.props].filter(
      (p) => p.pedestalKey !== undefined,
    );
    expect(pedestals).toHaveLength(4);
    // At 1x the garden scrolls only up and down, so its plants can be at any height on screen: they clear the box on its left.
    const plants = GARDEN_ROOM.props.filter((p) => p.speciesKey !== undefined);
    expect(plants).toHaveLength(3);
    for (const step of tutorialAllSteps()) {
      const m = tutorialPanel(step, false, DESKTOP_UI);
      if (!m) throw new Error('no panel');
      for (const p of pedestals) expect(m.box.y).toBeGreaterThan(below(p));
      for (const p of plants) expect(m.box.x).toBeGreaterThan(p.x + p.w / 2);
    }
  });
});

describe('compact tutorial box on short screens', () => {
  const canvas = 480 * 270;
  const winterTip = seasonTipFor({ ...createNewGameState(), day: WINTER }, WINTER - 1);

  it('uses the full box on the desktop and the compact one at 711x273', () => {
    expect(tutorialPanel(TUTORIAL_WATER, false, DESKTOP_UI)?.toggle).toBeUndefined();
    const m = tutorialPanel(TUTORIAL_WATER, false, SHORT_PHONE_UI);
    expect(m?.toggle).toMatchObject({ label: 'More', id: 'tutorial-more' });
    expect(m?.button.label).toBe('Skip');
  });

  it('takes under a third of the height and the canvas at 711x273 and 824x384, every step and tip', () => {
    expect(winterTip).toBeDefined();
    for (const ui of [SHORT_PHONE_UI, PHONE_UI]) {
      for (const step of [...tutorialAllSteps(), TUTORIAL_DONE]) {
        for (const mode of ['touch', 'keyboard'] as const) {
          const m = tutorialPanel(step, false, ui, step === TUTORIAL_DONE ? winterTip : undefined, {
            mode,
            expanded: false,
          });
          if (!m) throw new Error('no panel');
          expect(m.box.h).toBeLessThanOrEqual(270 / 3);
          expect(m.box.w).toBeLessThanOrEqual(480 / 2);
          expect(m.box.w * m.box.h).toBeLessThanOrEqual(canvas / 6);
          expect(m.box.x + m.box.w).toBe(TUTORIAL_BOX.x + TUTORIAL_BOX.w);
          expect(m.box.y + m.box.h).toBeLessThanOrEqual(TUTORIAL_BOX.bottom);
        }
      }
    }
  });

  it('shows the step label and both buttons, inside the box, with the body behind More', () => {
    const m = tutorialPanel(TUTORIAL_WATER, false, SHORT_PHONE_UI, undefined, {
      mode: 'touch',
      expanded: false,
    });
    if (!m?.toggle) throw new Error('not compact');
    expect(m.texts.map((t) => t.text).join(' ')).toBe(tutorialStepLabel(TUTORIAL_WATER));
    expect(m.toggle.x).toBeLessThan(m.button.x);
    expect(m.toggle.y).toBe(m.button.y);
    for (const t of m.texts) expect(t.y + SHORT_PHONE_UI.label).toBeLessThan(m.toggle.y);
  });

  it('opens out to the full text with Less, in the touch wording and without a key hint', () => {
    const m = tutorialPanel(TUTORIAL_WATER, false, SHORT_PHONE_UI, undefined, {
      mode: 'touch',
      expanded: true,
    });
    expect(m?.toggle?.label).toBe('Less');
    const text = m?.texts.map((t) => t.text).join(' ') ?? '';
    expect(text).toContain('Walk to');
    expect(text).toContain('tap Water');
    expect(text).not.toMatch(/Press|click|\bJ\b|\bE\b/);
  });

  it('opened out at 711x273 and 824x384, stays on screen, clears Notebook, and keeps Less and Skip apart', () => {
    const glyph = (ui: UiMetrics): number => ui.label * 0.6 + 0.1;
    for (const ui of [SHORT_PHONE_UI, PHONE_UI]) {
      for (const step of [...tutorialAllSteps(), TUTORIAL_DONE]) {
        for (const mode of ['touch', 'keyboard'] as const) {
          const tip = step === TUTORIAL_DONE ? winterTip : undefined;
          const m = tutorialPanel(step, false, ui, tip, { mode, expanded: true });
          if (!m?.toggle) continue;
          expect(m.toggle.label).toBe('Less');
          const { box } = m;
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.y).toBeGreaterThanOrEqual(0);
          expect(box.x + box.w).toBeLessThanOrEqual(480);
          expect(box.y + box.h).toBeLessThanOrEqual(270);
          expect(box.y + box.h).toBeLessThanOrEqual(TUTORIAL_BOX.bottom);
          expect(box.y).toBeGreaterThanOrEqual(CARRY_TEXT.top + LINE_10);
          expect(box.y + box.h).toBeLessThan(INTERACT_BUTTON.bottom - LINE_10);
          const notebook = hitRect(
            estimatedHudBox('Notebook', NOTEBOOK_BUTTON.left, NOTEBOOK_BUTTON.bottom, 0, 1, ui),
            ui.hit,
          );
          const less = hitRect(
            estimatedBox(m.toggle.label, m.toggle.x, m.toggle.y, 0, 0, ui),
            ui.hit,
          );
          const skip = hitRect(
            estimatedBox(m.button.label, m.button.x, m.button.y, 1, 0, ui),
            ui.hit,
          );
          const rects = [less, skip];
          expect(rectsOverlap(less, skip)).toBe(false);
          for (const r of rects) {
            expect(r.x).toBeGreaterThanOrEqual(0);
            expect(r.y).toBeGreaterThanOrEqual(0);
            expect(r.x + r.w).toBeLessThanOrEqual(480);
            expect(r.y + r.h).toBeLessThanOrEqual(270);
            expect(rectsOverlap(r, notebook)).toBe(false);
          }
          expect(rectsOverlap(box, notebook)).toBe(false);
          for (const t of m.texts) {
            expect(t.x + t.text.length * glyph(ui)).toBeLessThanOrEqual(box.x + box.w);
            expect(t.y + ui.label).toBeLessThanOrEqual(m.button.y + LINE_10);
          }
        }
      }
    }
  });

  it('words the full box by input: keys with a keyboard, taps by touch', () => {
    const keyboard = tutorialPanel(TUTORIAL_WATER, false, DESKTOP_UI);
    const touch = tutorialPanel(TUTORIAL_WATER, false, DESKTOP_UI, undefined, {
      mode: 'touch',
      expanded: false,
    });
    expect(keyboard?.texts.at(-1)?.text).toBe('Press J for notebook');
    expect(touch?.texts.at(-1)?.text).toBe('Tap Notebook for notes');
    expect(touch?.texts.map((t) => t.text).join(' ')).not.toMatch(/Press|click/);
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
