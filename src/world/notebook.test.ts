import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../sim/state';
import {
  TUTORIAL_DONE,
  TUTORIAL_PLANT,
  TUTORIAL_SKIP_WEEK,
  TUTORIAL_TRAIN,
  TUTORIAL_WATER,
  tutorialAllSteps,
  tutorialStepBody,
  tutorialStepFlavour,
} from '../sim/tutorial';
import { PANEL_INSET, panelClose, panelTitleY, type PanelModel } from './panels';
import {
  NOTEBOOK_PANEL,
  notebookHeader,
  notebookOpeningPage,
  notebookPages,
  notebookPanel,
} from './notebook';

// 10 px monospace, the fallback and the widest face text can draw in (VT323 is 0.4 em): about 0.6 em a glyph and a 12 px line. Generous upper bounds.
const GLYPH_W = 6;
const LINE_H = 12;

const at = (step: number) => {
  const state = createNewGameState();
  state.tutorialStep = step;
  return state;
};
const texts = (m: PanelModel) => m.rows.filter((r) => r.id === '').map((r) => r.text);
const enabled = (m: PanelModel) =>
  m.rows.filter((r) => r.id !== '' && r.enabled !== false).map((r) => r.id);

describe("Granny's notebook", () => {
  it('pages through every step, with the finale only once the tutorial is done', () => {
    expect(notebookPages(TUTORIAL_WATER)).toEqual(tutorialAllSteps());
    expect(notebookPages(TUTORIAL_PLANT)).toEqual(tutorialAllSteps());
    expect(notebookPages(TUTORIAL_DONE)).toEqual([...tutorialAllSteps(), TUTORIAL_DONE]);
  });

  it("opens on the active step's page, or the finale when done", () => {
    expect(notebookOpeningPage(TUTORIAL_WATER)).toBe(0);
    expect(notebookOpeningPage(TUTORIAL_TRAIN)).toBe(2);
    expect(notebookOpeningPage(TUTORIAL_DONE)).toBe(5);
  });

  it('shows a reached page with its badge, flavour and quick prompt', () => {
    const state = at(TUTORIAL_SKIP_WEEK);
    const m = notebookPanel(state, 0);
    expect([m.key, m.title]).toEqual(['notebook', "Granny's Notebook"]);
    expect(notebookHeader(state, 0)).toEqual({
      indicator: 'Page 1 / 5',
      title: "Water Granny's juniper",
      badge: 'done',
    });
    const lines = texts(m);
    expect(lines.slice(0, 3)).toEqual(["Water Granny's juniper", 'Page 1 / 5', 'done']);
    const prompt = lines.indexOf('Quick prompt:');
    expect(lines.slice(3, prompt).join(' ')).toBe(tutorialStepFlavour(TUTORIAL_WATER));
    expect(lines.slice(prompt + 1).join(' ')).toBe(tutorialStepBody(TUTORIAL_WATER));
    expect(notebookHeader(state, 1).badge).toBe('in progress');
  });

  it('leaves a page not yet reached blank', () => {
    const state = at(TUTORIAL_SKIP_WEEK);
    expect(texts(notebookPanel(state, 2))).toEqual([
      'Train a branch in the 3D viewer',
      'Page 3 / 5',
      'not yet',
      'Granny left this page blank for now.',
    ]);
  });

  it('ends on the finale with its flavour alone once done', () => {
    const state = at(TUTORIAL_DONE);
    expect(notebookHeader(state, 4).badge).toBe('done');
    expect(notebookHeader(state, 5)).toEqual({
      indicator: 'Page 6 / 6',
      title: 'All caught up',
      badge: '',
    });
    const lines = texts(notebookPanel(state, 5));
    expect(lines.slice(0, 2)).toEqual(['All caught up', 'Page 6 / 6']);
    expect(lines.slice(2).join(' ')).toBe(tutorialStepFlavour(TUTORIAL_DONE));
  });

  it('enables Prev except on the first page and Next except on the last', () => {
    const state = at(TUTORIAL_WATER);
    expect(enabled(notebookPanel(state, 0))).toEqual(['panel-next']);
    expect(enabled(notebookPanel(state, 2))).toEqual(['panel-prev', 'panel-next']);
    expect(enabled(notebookPanel(state, 4))).toEqual(['panel-prev']);
    expect(enabled(notebookPanel(at(TUTORIAL_DONE), 4))).toEqual(['panel-prev', 'panel-next']);
  });

  it('fits every page inside 480x270: lines inside the box and above Prev, Next and Close', () => {
    const box = NOTEBOOK_PANEL;
    expect(box.x * 2 + box.w).toBe(480);
    expect(box.y * 2 + box.h).toBe(270);
    const close = panelClose(box);
    const closeHalf = ('Close (Esc)'.length * GLYPH_W) / 2;
    for (const step of [...tutorialAllSteps(), TUTORIAL_DONE]) {
      const state = at(step);
      notebookPages(step).forEach((_, page) => {
        const m = notebookPanel(state, page);
        let above = panelTitleY(box);
        for (const row of m.rows) {
          const left = row.x ?? NaN;
          const right = left + row.text.length * GLYPH_W;
          expect(right).toBeLessThanOrEqual(box.x + box.w - PANEL_INSET);
          if (row.id === '') {
            expect(row.y - above === 0 || row.y - above >= LINE_H).toBe(true);
            above = row.y;
          } else {
            expect(row.y).toBe(close.y);
            expect(right).toBeLessThan(close.x - closeHalf);
          }
        }
        expect(above + LINE_H / 2).toBeLessThanOrEqual(close.y - LINE_H / 2);
      });
    }
    // The page title stays clear of the indicator on its line.
    const title = notebookPanel(at(TUTORIAL_WATER), 3).rows.slice(0, 2);
    expect((title[0]?.x ?? 0) + (title[0]?.text.length ?? 0) * GLYPH_W).toBeLessThan(
      title[1]?.x ?? 0,
    );
  });
});
