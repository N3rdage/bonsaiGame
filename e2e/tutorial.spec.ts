import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TUTORIAL_SKIP_WEEK, TUTORIAL_WATER, tutorialStepLabel } from '../src/sim/tutorial';
import {
  bootWorld,
  closePanel,
  collectErrors,
  continueGame,
  expect,
  hook,
  inspectorAction,
  openInspector,
  openNotebook,
  skipTutorial,
  test,
  toTitle,
  turnNotebookPage,
  walkTo,
} from './drive';

const ids = (h: BonsaiTestHook): string[] => h.controls.map((c) => c.id);

/** A real GameMaker save with the tutorial done (`tutorial_step` -1). */
const PROTOTYPE_SAVE = readFileSync(
  path.join(import.meta.dirname, '../src/sim/__fixtures__/prototype-save-v1-day14.json'),
  'utf8',
);

test.describe('tutorial', () => {
  test('a new game shows the corner panel, and watering the juniper moves it on', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    let h = await hook(page);
    expect([h.tutorialStep, h.tutorialLabel]).toEqual([0, tutorialStepLabel(TUTORIAL_WATER)]);
    expect(ids(h)).toEqual(['view', 'notebook', 'menu', 'tutorial-skip']);

    await walkTo(page, 160, 'left', 'tree:0');
    await openInspector(page);
    h = await hook(page);
    // Still shown over the inspector, its Skip disabled.
    expect(h.tutorialLabel).toBe(tutorialStepLabel(TUTORIAL_WATER));
    expect(ids(h)).not.toContain('tutorial-skip');

    await inspectorAction(page, 'water');
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === 1);
    expect((await hook(page)).tutorialLabel).toBe(tutorialStepLabel(TUTORIAL_SKIP_WEEK));
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect(ids(await hook(page))).toContain('tutorial-skip');
    expect(errors).toEqual([]);
  });

  test("Granny's notebook opens on the active step and pages with Next and Prev", async ({
    page,
    tapRoute,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openNotebook(page);
    let h = await hook(page);
    expect(h.notebook).toEqual({
      indicator: 'Page 1 / 5',
      title: tutorialStepLabel(TUTORIAL_WATER),
      badge: 'in progress',
    });
    expect(ids(h)).toEqual(['panel-next', 'panel-close']);

    await turnNotebookPage(page, 'panel-next');
    h = await hook(page);
    expect(h.notebook).toEqual({
      indicator: 'Page 2 / 5',
      title: tutorialStepLabel(TUTORIAL_SKIP_WEEK),
      badge: 'not yet',
    });
    expect(ids(h)).toEqual(['panel-prev', 'panel-next', 'panel-close']);
    await turnNotebookPage(page, 'panel-prev');
    expect((await hook(page)).notebook?.indicator).toBe('Page 1 / 5');

    // J toggles it shut; the tap route closes it with Close.
    if (tapRoute) await closePanel(page);
    else await page.keyboard.press('j');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect((await hook(page)).notebook).toBeUndefined();
    expect(errors).toEqual([]);
  });

  test('Skip then Cancel keeps the step; Skip then Skip ends the tutorial', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await skipTutorial(page, false);
    let h = await hook(page);
    expect([h.tutorialStep, h.tutorialLabel]).toEqual([0, tutorialStepLabel(TUTORIAL_WATER)]);

    await skipTutorial(page, true);
    h = await hook(page);
    expect([h.tutorialStep, h.tutorialLabel]).toEqual([-1, '']);
    expect(ids(h)).toEqual(['view', 'notebook', 'menu']);
    await openNotebook(page);
    expect((await hook(page)).notebook).toEqual({
      indicator: 'Page 6 / 6',
      title: 'All caught up',
      badge: '',
    });
    expect(errors).toEqual([]);
  });

  test('a prototype save with the tutorial done shows no corner panel and opens on the finale', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await page.evaluate((save) => {
      localStorage.setItem('bonsai.save.1', save);
    }, PROTOTYPE_SAVE);
    await toTitle(page);
    await continueGame(page);
    await page.waitForFunction(() => window.__bonsai?.scene === 'world');
    let h = await hook(page);
    expect([h.tutorialStep, h.tutorialLabel]).toEqual([-1, '']);
    expect(ids(h)).not.toContain('tutorial-skip');

    await openNotebook(page);
    h = await hook(page);
    expect(h.notebook?.indicator).toBe('Page 6 / 6');
    expect(h.notebook?.title).toBe('All caught up');
    expect(ids(h)).toEqual(['panel-prev', 'panel-close']);
    await turnNotebookPage(page, 'panel-prev');
    expect((await hook(page)).notebook?.badge).toBe('done');
    expect(errors).toEqual([]);
  });
});
