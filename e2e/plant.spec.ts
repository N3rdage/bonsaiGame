import type { Page } from '@playwright/test';
import { serializeState } from '../src/sim/save';
import { createNewGameState } from '../src/sim/state';
import { TUTORIAL_DONE, TUTORIAL_TAKE_CUTTING } from '../src/sim/tutorial';
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
// garden at (50, 225); garden: juniper (140, 90), door (16, 228) back to (240, 190).

const ids = (h: BonsaiTestHook): string[] => h.controls.map((c) => c.id);

async function throughDoor(page: Page, room: string): Promise<void> {
  await interact(page);
  await page.waitForFunction((r) => window.__bonsai?.room === r, room);
}

/** A new game saved in slot 1 one step before the tutorial's Plant step, continued into the shed. */
async function continueBeforePlantStep(page: Page): Promise<void> {
  const state = createNewGameState();
  state.tutorialStep = TUTORIAL_TAKE_CUTTING;
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
    expect(ids(await hook(page))).toEqual(['panel-select-juniper', 'panel-close']);
    await tapControl(page, 'panel-select-juniper');
    await page.waitForFunction(
      () => window.__bonsai?.controls.some((c) => c.id === 'panel-plant') === true,
    );
    h = await hook(page);
    expect([h.panel, ids(h)]).toEqual(['plant', ['panel-plant', 'panel-close']]);

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

  test('with no cuttings the panel offers nothing to plant', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openPlanting(page);
    const h = await hook(page);
    expect(h.inventory.cutting_juniper).toBe(0);
    // No Select rows, no toggles at 0 stock, and Plant Cutting greyed (not a control).
    expect(ids(h)).toEqual(['panel-close']);
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect((await hook(page)).treeLocations).toHaveLength(1);
    expect(errors).toEqual([]);
  });
});
