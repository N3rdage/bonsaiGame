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
// house off the garden's top fence, x 48..432 and y 48..240.

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
    await expectAt(page, 'garden', 50, 225);

    await gardenToGreenhouse(page);
    await expectAt(page, 'greenhouse', 240, 206);
    await greenhouseToGarden(page);
    await expectAt(page, 'garden', 448, 34);
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
    await expectAt(page, 'greenhouse', 240, 206);
    await expect(page).toHaveScreenshot('greenhouse-entry.png');
  });
});
