import type { Page } from '@playwright/test';
import { serializeState } from '../src/sim/save';
import { createNewGameState } from '../src/sim/state';
import { TUTORIAL_DONE, TUTORIAL_TAKE_CUTTING } from '../src/sim/tutorial';
import type { GameState } from '../src/sim/types';
import {
  bootWorld,
  closePanel,
  collectErrors,
  continueGame,
  expect,
  hook,
  interact,
  openPlanting,
  tapControl,
  test,
  toTitle,
  walkTo,
} from './drive';

// Shed: workbench (125, 90), planting table (165, 90), door (232, 208) to the
// garden at (42, 228); garden: juniper (140, 90), door (16, 228) back to (240, 190).

const ids = (h: BonsaiTestHook): string[] => h.controls.map((c) => c.id);

async function throughDoor(page: Page, room: string): Promise<void> {
  await interact(page);
  await page.waitForFunction((r) => window.__bonsai?.room === r, room);
}

/** A new game, changed by `edit`, saved in slot 1 and continued into the shed. */
async function continueWith(page: Page, edit: (state: GameState) => void): Promise<void> {
  const state = createNewGameState();
  edit(state);
  await page.goto('/');
  await page.evaluate(
    (save) => {
      localStorage.setItem('bonsai.save.1', save);
    },
    serializeState(state, new Date()),
  );
  await toTitle(page);
  await continueGame(page);
  await page.waitForFunction(() => window.__bonsai?.scene === 'world');
}

/** A new game saved in slot 1 one step before the tutorial's Plant step, continued into the shed. */
const continueBeforePlantStep = (page: Page): Promise<void> =>
  continueWith(page, (state) => {
    state.tutorialStep = TUTORIAL_TAKE_CUTTING;
  });

test.describe('workbench and planting table', () => {
  test('makes a pot, takes a juniper cutting and plants it in the shed', async ({ page }) => {
    const errors = collectErrors(page);
    await continueBeforePlantStep(page);
    const start = (await hook(page)).inventory;
    expect([start.clay, start.pot, start.cutting_juniper]).toEqual([5, 2, 0]);

    await walkTo(page, 90, 'left', 'workbench');
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.inventory.pot === 3);
    let h = await hook(page);
    expect(h.toast).toBe('Made a pot  (3 pots, 4 clay left)');
    expect([h.inventory.clay, h.panel]).toEqual([4, '']);

    await walkTo(page, 200, 'right', 'door');
    await throughDoor(page, 'garden');
    await walkTo(page, 90, 'right', 'source_juniper');
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.inventory.cutting_juniper === 1);
    await walkTo(page, 228, 'left', 'door');
    await throughDoor(page, 'shed');
    h = await hook(page);
    expect(h.tutorialStep).toBe(TUTORIAL_TAKE_CUTTING + 1);
    const before = h.inventory;

    await openPlanting(page);
    // The new game's two seeds sit beside the cutting.
    expect(ids(await hook(page))).toEqual([
      'panel-select-juniper',
      'panel-select-seed-juniper',
      'panel-select-seed-maple',
      'panel-close',
    ]);
    await tapControl(page, 'panel-select-juniper');
    await page.waitForFunction(
      () => window.__bonsai?.controls.some((c) => c.id === 'panel-plant') === true,
    );
    h = await hook(page);
    expect([h.panel, ids(h)]).toEqual([
      'plant',
      ['panel-select-seed-juniper', 'panel-select-seed-maple', 'panel-plant', 'panel-close'],
    ]);

    await tapControl(page, 'panel-plant');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    h = await hook(page);
    expect(h.toast).toBe('Planted a Juniper.');
    expect(h.treeLocations).toEqual([
      { id: 0, name: "Granny's", location: 'shed' },
      { id: 1, name: 'New Juniper', location: 'shed' },
    ]);
    expect(h.inventory).toEqual({ ...before, pot: (before.pot ?? NaN) - 1, cutting_juniper: 0 });
    expect(h.tutorialStep).toBe(TUTORIAL_DONE);
    expect(errors).toEqual([]);
  });

  test('a new game plants its starting maple seed in the shed', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openPlanting(page);
    let h = await hook(page);
    const before = h.inventory;
    expect([before.seed_maple, before.cutting_juniper]).toEqual([1, 0]);
    expect(ids(h)).toEqual(['panel-select-seed-juniper', 'panel-select-seed-maple', 'panel-close']);

    await tapControl(page, 'panel-select-seed-maple');
    await page.waitForFunction(
      () => window.__bonsai?.controls.some((c) => c.id === 'panel-plant') === true,
    );
    h = await hook(page);
    expect(ids(h)).toEqual(['panel-select-seed-juniper', 'panel-plant', 'panel-close']);

    await tapControl(page, 'panel-plant');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    h = await hook(page);
    expect(h.toast).toBe('Planted a Japanese Maple seed.');
    expect(h.treeLocations).toEqual([
      { id: 0, name: "Granny's", location: 'shed' },
      { id: 1, name: 'New Japanese Maple', location: 'shed' },
    ]);
    expect(h.inventory).toEqual({ ...before, pot: (before.pot ?? NaN) - 1, seed_maple: 0 });
    expect(errors).toEqual([]);
  });

  test('a seed chosen with no pot offers no Plant', async ({ page }) => {
    const errors = collectErrors(page);
    await continueWith(page, (state) => {
      state.inventory.pot = 0;
    });
    await openPlanting(page);
    await tapControl(page, 'panel-select-seed-maple');
    await page.waitForFunction(
      () => window.__bonsai?.controls.some((c) => c.id === 'panel-select-seed-maple') === false,
    );
    const h = await hook(page);
    // Selected, and Plant Seed greyed beside or under `You need a pot.` (not a control).
    expect([h.panel, ids(h)]).toEqual(['plant', ['panel-select-seed-juniper', 'panel-close']]);
    expect(h.treeLocations).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('with no cuttings or seeds the panel offers nothing to plant', async ({ page }) => {
    const errors = collectErrors(page);
    await continueWith(page, (state) => {
      state.inventory.seed_juniper = 0;
      state.inventory.seed_maple = 0;
    });
    await openPlanting(page);
    const h = await hook(page);
    expect([h.inventory.cutting_juniper, h.inventory.seed_maple]).toEqual([0, 0]);
    // No Select rows, no toggles at 0 stock, and Plant Cutting greyed (not a control).
    expect(ids(h)).toEqual(['panel-close']);
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect((await hook(page)).treeLocations).toHaveLength(1);
    expect(errors).toEqual([]);
  });
});
