import type { Page } from '@playwright/test';
import { serializeState } from '../src/sim/save';
import { createNewGameState } from '../src/sim/state';
import { DISPLAYED_PREFIX } from '../src/sim/tree';
import {
  bootWorld,
  collectErrors,
  continueGame,
  expect,
  hook,
  openSettingsFromMenu,
  skipTutorial,
  tapControl,
  test,
  toTitle,
} from './drive';
import { gardenToGreenhouse, greenhouseToGarden, shedToGarden } from './rooms';

// The doors and landings are in rooms.ts. The greenhouse is a glass house
// standing in the back garden's lawn, 5 x 3.5 m: x 144..336 and y 64..208 with
// its walls, a 10x7-tile floor x 160..320, y 80..192, its door at (240, 200)
// in the bottom wall.

async function expectAt(page: Page, room: string, x: number, y: number): Promise<void> {
  const h = await hook(page);
  expect([h.room, h.player.x, h.player.y]).toEqual([room, x, y]);
  // Landed 26 px from the door just used, out of its reach.
  expect(h.near).toBe('');
}

test.describe('the greenhouse', () => {
  test("the garden's top fence leads into the greenhouse and its bottom door back out", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await shedToGarden(page);
    await expectAt(page, 'garden', 80, 274);

    await gardenToGreenhouse(page);
    await expectAt(page, 'greenhouse', 240, 174);
    await greenhouseToGarden(page);
    await expectAt(page, 'garden', 336, 434);
    expect(errors).toEqual([]);
  });
});

/** Weather off and the tutorial skipped, as in garden.spec.ts, so nothing moves or covers the screenshot. */
async function stillWorld(page: Page): Promise<void> {
  await openSettingsFromMenu(page);
  await tapControl(page, 'panel-weather');
  await page.waitForFunction(() => window.__bonsai?.settings.weather === false);
  await tapControl(page, 'panel-close');
  await page.waitForFunction(() => window.__bonsai?.panel === '');
  await skipTutorial(page, true);
  await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
}

test.describe('greenhouse screenshot', () => {
  // The garden door's landing on the S22 in landscape: the empty glass house as
  // the phone's zoomed camera shows it.
  test("the greenhouse's entry, empty", async ({ page }) => {
    test.skip(test.info().project.name !== 's22-landscape', 'S22 landscape baseline only');
    await bootWorld(page);
    await stillWorld(page);

    await shedToGarden(page);
    await gardenToGreenhouse(page);
    await expectAt(page, 'greenhouse', 240, 174);
    await expect(page).toHaveScreenshot('greenhouse-entry.png');
  });

  // The same landing with the placeables down, seeded as placed.spec.ts seeds them: a version-6
  // save with a pedestal (id 0) at (240, 128) and a floor shelf (id 1) at (288, 128), Granny's
  // juniper displayed on the pedestal's spot.
  test("the greenhouse's entry, a tree on a placed pedestal beside a floor shelf", async ({
    page,
  }) => {
    test.skip(test.info().project.name !== 's22-landscape', 'S22 landscape baseline only');
    const state = createNewGameState();
    state.placed = [
      { id: 0, kind: 'pedestal', room: 'greenhouse', x: 240, y: 128 },
      { id: 1, kind: 'floor_shelf', room: 'greenhouse', x: 288, y: 128 },
    ];
    state.nextPlacedId = 2;
    const [starter] = state.trees;
    if (!starter) throw new Error('no starter');
    starter.location = `${DISPLAYED_PREFIX}placed_0`;
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
    await stillWorld(page);

    await shedToGarden(page);
    await gardenToGreenhouse(page);
    await expectAt(page, 'greenhouse', 240, 174);
    const h = await hook(page);
    expect(h.placed?.map((p) => [p.kind, p.x, p.y])).toEqual([
      ['pedestal', 240, 128],
      ['floor_shelf', 288, 128],
    ]);
    expect(h.treeLocations).toEqual([{ id: 0, name: "Granny's", location: 'displayed:placed_0' }]);
    await expect(page).toHaveScreenshot('greenhouse-placed.png');
  });
});
