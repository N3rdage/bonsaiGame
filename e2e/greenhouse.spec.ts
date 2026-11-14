import type { Page } from '@playwright/test';
import {
  bootWorld,
  collectErrors,
  expect,
  hook,
  openSettingsFromMenu,
  skipTutorial,
  tapControl,
  test,
} from './drive';
import { gardenToGreenhouse, greenhouseToGarden, shedToGarden } from './rooms';

// The doors and landings are in rooms.ts. The greenhouse is an empty glass
// house off the garden's top fence, 5 x 3.5 m: x 144..336 and y 64..208 with
// its glass, a 10x7-tile floor x 160..320, y 80..192, its door at (240, 200)
// in the bottom wall.

async function expectAt(page: Page, room: string, x: number, y: number): Promise<void> {
  const h = await hook(page);
  expect([h.room, h.player.x, h.player.y]).toEqual([room, x, y]);
  // Landed 26 px from the door just used, out of its reach.
  expect(h.near).toBe('');
}

/** Back in the garden, out of the door's reach; the garden's door is pinned by the garden's own specs. */
async function expectInGarden(page: Page): Promise<void> {
  const h = await hook(page);
  expect([h.room, h.near]).toEqual(['garden', '']);
}

test.describe('the greenhouse', () => {
  test("the garden's top fence leads into the greenhouse and its bottom door back out", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await shedToGarden(page);
    await expectAt(page, 'garden', 42, 228);

    await gardenToGreenhouse(page);
    await expectAt(page, 'greenhouse', 240, 174);
    await greenhouseToGarden(page);
    await expectInGarden(page);
    expect(errors).toEqual([]);
  });
});

test.describe('greenhouse screenshot', () => {
  // The garden door's landing on the S22 in landscape: the empty glass house as
  // the phone's zoomed camera shows it. Weather off and the tutorial skipped, as
  // in garden.spec.ts, so nothing moves or covers it.
  test("the greenhouse's entry, empty", async ({ page }) => {
    test.skip(test.info().project.name !== 's22-landscape', 'S22 landscape baseline only');
    await bootWorld(page);
    await openSettingsFromMenu(page);
    await tapControl(page, 'panel-weather');
    await page.waitForFunction(() => window.__bonsai?.settings.weather === false);
    await tapControl(page, 'panel-close');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);

    await shedToGarden(page);
    await gardenToGreenhouse(page);
    await expectAt(page, 'greenhouse', 240, 174);
    await expect(page).toHaveScreenshot('greenhouse-entry.png');
  });
});
