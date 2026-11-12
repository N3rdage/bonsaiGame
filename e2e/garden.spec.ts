import type { Page } from '@playwright/test';
import { serializeState } from '../src/sim/save';
import { DAYS_PER_SEASON, SEASONS, seasonForDay, seasonWaterMultiplier } from '../src/sim/seasons';
import { getSpecies } from '../src/sim/species';
import { createNewGameState } from '../src/sim/state';
import { TUTORIAL_DONE } from '../src/sim/tutorial';
import {
  bootWorld,
  closePanel,
  collectErrors,
  continueGame,
  expect,
  hook,
  interact,
  openInspector,
  openMenu,
  openSettingsFromMenu,
  skipTutorial,
  tapControl,
  test,
  toTitle,
  walkTo,
} from './drive';

// Shed door (240, 216), in the bottom wall, to the garden at (50, 225); garden
// door (16, 228) back to the shed at (240, 190). Source plants: juniper
// (140, 90), maple (260, 80).

async function throughDoor(page: Page, room: string): Promise<void> {
  await interact(page);
  await page.waitForFunction((r) => window.__bonsai?.room === r, room);
}

async function toGarden(page: Page): Promise<void> {
  await walkTo(page, 200, 'left', 'door');
  await throughDoor(page, 'garden');
}

test.describe('the garden', () => {
  test('the shed door leads to the garden and its door back', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    expect((await hook(page)).room).toBe('shed');

    await toGarden(page);
    let h = await hook(page);
    expect([h.room, h.player.x, h.player.y]).toEqual(['garden', 50, 225]);
    expect(h.near).toBe('');

    await walkTo(page, 228, 'left', 'door');
    await throughDoor(page, 'shed');
    h = await hook(page);
    expect([h.room, h.player.x, h.player.y]).toEqual(['shed', 240, 190]);
    // Landed on the floor above the shed door, just out of its reach; a step down reaches it.
    expect(h.near).toBe('');
    await walkTo(page, 200, 'left', 'door');
    expect(h.treeLocations).toEqual([{ id: 0, name: "Granny's", location: 'shed' }]);
    expect(errors).toEqual([]);
  });

  test('takes a juniper cutting; the maple refuses', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await toGarden(page);
    const before = (await hook(page)).inventory;
    expect(before.cutting_juniper).toBe(0);

    await walkTo(page, 90, 'right', 'source_juniper');
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.inventory.cutting_juniper === 1);
    expect((await hook(page)).toast).toBe('Took a Juniper cutting  (1 in inventory)');

    await walkTo(page, 80, 'right', 'source_maple');
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.toast.startsWith('Japanese Maple') === true);
    const h = await hook(page);
    expect(h.toast).toBe("Japanese Maple can't be grown from cuttings - try seeds");
    expect(h.inventory).toEqual({ ...before, cutting_juniper: 1 });
    expect(errors).toEqual([]);
  });

  test('in autumn the maple reads Take Seeds and gives one seed to the Inventory', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const state = createNewGameState();
    state.day = 60;
    state.tutorialStep = -1;
    await page.goto('/');
    await page.evaluate(
      (text) => {
        localStorage.setItem('bonsai.save.1', text);
      },
      serializeState(state, new Date(2026, 10, 11, 0, 0)),
    );
    await toTitle(page);
    await continueGame(page);
    await page.waitForFunction(
      () => window.__bonsai?.ready === true && window.__bonsai.scene === 'world',
    );
    expect((await hook(page)).season).toBe('autumn');
    await toGarden(page);
    await walkTo(page, 80, 'right', 'source_maple');
    expect((await hook(page)).prompt).toBe('E: Take Seeds');
    expect(await mapleSeeds(page)).toBe(1);

    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.inventory.seed_maple === 2);
    expect((await hook(page)).toast).toBe('Took a Japanese Maple seed  (2 in inventory)');
    expect(await mapleSeeds(page)).toBe(2);
    expect(errors).toEqual([]);
  });
});

test.describe('garden screenshot', () => {
  // The shed door's landing on the S22 in landscape: the garden door set in the
  // shed's back wall, as the phone's zoomed camera shows it. Weather off and
  // the tutorial skipped, as in interiors.spec.ts, so nothing moves or covers it.
  test("the garden's entry, its door in the shed's back wall", async ({ page }) => {
    test.skip(test.info().project.name !== 's22-landscape', 'S22 landscape baseline only');
    await bootWorld(page);
    await openSettingsFromMenu(page);
    await tapControl(page, 'panel-weather');
    await page.waitForFunction(() => window.__bonsai?.settings.weather === false);
    await tapControl(page, 'panel-close');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);

    await toGarden(page);
    const h = await hook(page);
    expect([h.room, h.player.x, h.player.y, h.near]).toEqual(['garden', 50, 225, '']);
    await expect(page).toHaveScreenshot('garden-entry.png');
  });

  // The garden's scenery tinted by the season (seasonTint), on each season's
  // first day at the base clock (a day is 300 s, so it cannot turn mid-capture).
  for (const [index, season] of SEASONS.entries()) {
    test(`the garden in ${season}`, async ({ page }) => {
      test.skip(test.info().project.name !== 's22-landscape', 'S22 landscape baseline only');
      const state = createNewGameState();
      state.day = 1 + index * DAYS_PER_SEASON;
      state.tutorialStep = TUTORIAL_DONE;
      await page.goto('/');
      await page.evaluate(
        (text) => {
          localStorage.clear();
          localStorage.setItem('bonsai.save.1', text);
        },
        serializeState(state, new Date(2026, 10, 11, 0, 0)),
      );
      await toTitle(page);
      await continueGame(page);
      await page.waitForFunction(
        () => window.__bonsai?.ready === true && window.__bonsai.scene === 'world',
      );
      expect((await hook(page)).season).toBe(season);
      await openSettingsFromMenu(page);
      await tapControl(page, 'panel-weather');
      await page.waitForFunction(() => window.__bonsai?.settings.weather === false);
      await tapControl(page, 'panel-close');
      await page.waitForFunction(() => window.__bonsai?.panel === '');

      await toGarden(page);
      const h = await hook(page);
      expect([h.room, h.player.x, h.player.y, h.near]).toEqual(['garden', 50, 225, '']);
      await expect(page).toHaveScreenshot(`garden-${season}.png`);
    });
  }
});

/** The Inventory panel's Japanese Maple seed count, opened from the menu and closed again. */
async function mapleSeeds(page: Page): Promise<number | undefined> {
  await openMenu(page);
  await tapControl(page, 'menu-inventory');
  await page.waitForFunction(() => window.__bonsai?.panel === 'inventory');
  const seeds = (await hook(page)).inventorySections?.find((s) => s.title === 'Seeds');
  await tapControl(page, 'panel-close');
  await page.waitForFunction(() => window.__bonsai?.panel === '');
  return seeds?.entries.find((e) => e.label === 'Japanese Maple')?.count;
}

test.describe('the day clock', () => {
  test('a displayed tree earns display revenue as the days pass', async ({ page }) => {
    const errors = collectErrors(page);
    // A new game with Granny's juniper on the lounge's mantel, continued at 150x (a day every 2 s).
    const state = createNewGameState();
    const [starter] = state.trees;
    if (!starter) throw new Error('no starter');
    starter.location = 'displayed:lounge_mantel';
    await page.goto('/');
    await page.evaluate(
      (text) => {
        localStorage.setItem('bonsai.save.1', text);
      },
      serializeState(state, new Date(2026, 10, 11, 0, 0)),
    );

    await toTitle(page, '/?timeScale=150');
    await continueGame(page);
    await page.waitForFunction(
      () => window.__bonsai?.ready === true && window.__bonsai.scene === 'world',
    );
    const before = await hook(page);
    expect(before.treeLocations).toEqual([
      { id: 0, name: "Granny's", location: 'displayed:lounge_mantel' },
    ]);
    const handle = await page.waitForFunction(
      (day) => {
        const h = window.__bonsai;
        return h && h.day > day
          ? { day: h.day, money: h.money, toast: h.toast, hud: h.hud }
          : false;
      },
      before.day,
      { timeout: 10_000 },
    );
    const after = await handle.jsonValue();
    if (!after) throw new Error('no day passed');
    expect(after.day).toBe(before.day + 1);
    // The toast is what advanceDayAllTrees paid; the money rose by exactly that.
    const paid = Number(/^Display revenue: \+\$(\d+)$/.exec(after.toast)?.[1]);
    expect(paid).toBeGreaterThan(0);
    expect(after.money - before.money).toBe(paid);
    expect(after.hud).toContain(`Day ${String(after.day)}  |  $${String(after.money)}`);
    expect(after.hud).not.toBe(before.hud);
    expect(errors).toEqual([]);
  });

  test('Sleep a week pays a displayed tree seven days of display revenue', async ({ page }) => {
    const errors = collectErrors(page);
    // A new game with Granny's juniper on the lounge's mantel, at the real clock's pace.
    const state = createNewGameState();
    const [starter] = state.trees;
    if (!starter) throw new Error('no starter');
    starter.location = 'displayed:lounge_mantel';
    await page.goto('/');
    await page.evaluate(
      (text) => {
        localStorage.setItem('bonsai.save.1', text);
      },
      serializeState(state, new Date(2026, 10, 11, 0, 0)),
    );
    await toTitle(page);
    await continueGame(page);
    await page.waitForFunction(
      () => window.__bonsai?.ready === true && window.__bonsai.scene === 'world',
    );
    const before = await hook(page);

    await openMenu(page);
    await tapControl(page, 'menu-sleep-week');
    await page.waitForFunction((d) => window.__bonsai?.day === d + 7, before.day);
    const after = await hook(page);
    const day = String(before.day + 7);
    const paid = Number(
      new RegExp(`^Day ${day}  \\|  Display revenue: \\+\\$(\\d+)$`).exec(after.toast)?.[1],
    );
    // Seven days' pay: at least 7 (a day pays at least $1 here).
    expect(paid).toBeGreaterThanOrEqual(7);
    expect(after.money - before.money).toBe(paid);
    expect(after.hud).toContain(`Day ${day}  |  $${String(after.money)}`);
    expect(after.lastSound).toBe('coin');
    expect(errors).toEqual([]);
  });

  test("Sleep a week drinks the starter tree's water", async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await walkTo(page, 160, 'left', 'tree:0');
    await openInspector(page);
    const before = await hook(page);
    const water = before.inspected?.waterLevel ?? -1;
    expect(water).toBeGreaterThan(0);
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');

    await openMenu(page);
    await tapControl(page, 'menu-sleep-week');
    await page.waitForFunction((d) => window.__bonsai?.day === d + 7, before.day);
    await openInspector(page);
    const [starter] = createNewGameState().trees;
    if (!starter) throw new Error('no starter');
    const species = getSpecies(starter.speciesKey);
    let expected = water;
    for (let d = before.day + 1; d <= before.day + 7; d++) {
      expected = Math.max(
        0,
        expected - species.waterNeed * 5 * seasonWaterMultiplier(seasonForDay(d)),
      );
    }
    expect((await hook(page)).inspected?.waterLevel).toBeCloseTo(expected);
    expect(expected).toBeLessThan(water);
    expect(errors).toEqual([]);
  });
});
