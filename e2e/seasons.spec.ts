import type { Page } from '@playwright/test';
import { serializeState } from '../src/sim/save';
import { DAYS_PER_SEASON, SEASONS } from '../src/sim/seasons';
import { createNewGameState } from '../src/sim/state';
import { spawnTree } from '../src/sim/tree';
import { TUTORIAL_DONE } from '../src/sim/tutorial';
import type { SpeciesKey } from '../src/sim/types';
import { seasonTipParts } from '../src/world/tutorialPanel';
import {
  bootWorld,
  collectErrors,
  continueGame,
  expect,
  hook,
  openNotebook,
  tapControl,
  test,
  toTitle,
  turnNotebookPage,
} from './drive';

/** The first day of winter in years one and two. */
const WINTER = 3 * DAYS_PER_SEASON + 1;
const NEXT_WINTER = WINTER + DAYS_PER_SEASON * SEASONS.length;
/** The day the saves below start on: summer, 40 days before winter, so the turn into autumn passes first. */
const START = WINTER - 40;
/** A day every 30 ms of play, so winter is about 1.2 s away and the next winter about 3.4 s past it. */
const FAST = '/?timeScale=10000';

/**
 * A save with the tutorial done, on day START, owning one shed tree
 * of each of `species` (no Granny's juniper): written with the game's own
 * serializeState, since a new game has no way to own a maple yet.
 */
function saveOwning(...species: SpeciesKey[]): string {
  const state = createNewGameState();
  state.trees = [];
  for (const key of species) {
    const tree = spawnTree(state, key, 'seed');
    tree.location = 'shed';
    tree.trunk.heightCm = 20;
    tree.trunk.girthMm = 14;
    state.trees.push(tree);
  }
  state.day = START;
  state.tutorialStep = TUTORIAL_DONE;
  return serializeState(state, new Date(2026, 10, 11, 0, 0));
}

/** Continues `save` from slot 1 with the day clock at 10000x. */
async function continueFast(page: Page, save: string): Promise<void> {
  await page.goto('/');
  await page.evaluate((text) => {
    localStorage.clear();
    localStorage.setItem('bonsai.save.1', text);
  }, save);
  await toTitle(page, FAST);
  await continueGame(page);
  await page.waitForFunction(
    () => window.__bonsai?.ready === true && window.__bonsai.scene === 'world',
  );
}

const ids = (h: BonsaiTestHook): string[] => h.controls.map((c) => c.id);

test.describe('seasons', () => {
  test("Granny's notebook has a Seasons page after the steps", async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openNotebook(page);
    for (let turns = 0; turns < 10; turns++) {
      if ((await hook(page)).notebook?.title === 'Seasons') break;
      await turnNotebookPage(page, 'panel-next');
    }
    const h = await hook(page);
    expect(h.notebook).toEqual({ indicator: 'Page 6 / 6', title: 'Seasons', badge: '' });
    // The last page while the tutorial runs: Prev only.
    expect(ids(h)).toEqual(['panel-prev', 'panel-close']);
    expect(errors).toEqual([]);
  });

  test('a maple shows the dormancy tip once, on the first winter, until Got it', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await continueFast(page, saveOwning('maple'));
    let h = await hook(page);
    expect(h.day).toBeLessThan(WINTER);
    expect([h.seasonTip, h.tutorialLabel]).toEqual(['', '']);

    await page.waitForFunction(() => window.__bonsai?.seasonTip !== '');
    h = await hook(page);
    expect(h.day).toBeGreaterThanOrEqual(WINTER);
    expect(h.season).toBe('winter');
    const tip = h.seasonTip ?? '';
    expect(tip).toMatch(/^Winter: Japanese Maple is dormant\. .*until spring\./);
    // Shown though the tutorial is done, with Got it in Skip's place.
    expect(h.tutorialLabel).toBe(seasonTipParts(tip).label);
    expect(ids(h)).toContain('tip-dismiss');
    expect(ids(h)).not.toContain('tutorial-skip');

    await tapControl(page, 'tip-dismiss');
    await page.waitForFunction(() => window.__bonsai?.seasonTip === '');
    h = await hook(page);
    expect(h.tutorialLabel).toBe('');
    expect(ids(h)).not.toContain('tip-dismiss');

    // Through spring, summer and autumn into the next winter: it does not come back.
    await page.waitForFunction((day) => (window.__bonsai?.day ?? 0) > day, NEXT_WINTER, {
      timeout: 20_000,
    });
    h = await hook(page);
    expect([h.season, h.seasonTip, h.tutorialLabel]).toEqual(['winter', '', '']);
    expect(errors).toEqual([]);
  });

  test('a pine, awake all year, gets no tip in winter', async ({ page }) => {
    const errors = collectErrors(page);
    await continueFast(page, saveOwning('pine'));
    await page.waitForFunction((day) => (window.__bonsai?.day ?? 0) > day, WINTER + 2);
    const h = await hook(page);
    expect([h.season, h.seasonTip, h.tutorialLabel]).toEqual(['winter', '', '']);
    expect(errors).toEqual([]);
  });
});
