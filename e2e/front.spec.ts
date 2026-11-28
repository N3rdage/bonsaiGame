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
import {
  frontToGate,
  frontToHallway,
  gardenGateToFront,
  hallwayToFront,
  loungeToHallway,
  shedToLounge,
} from './rooms';

// Plan B3's front garden (frontGardenRoom.ts): in from the hallway's front
// door, east along the lawn through the side gate into the back garden's
// passage and back, then west to the front door and into the hallway. Every
// landing is 26 px from the door leading back, facing into the room
// (rooms.ts has the coordinates).

async function expectAt(
  page: Page,
  room: string,
  x: number,
  y: number,
  facing: string,
): Promise<void> {
  const h = await hook(page);
  expect([h.room, h.player.x, h.player.y, h.player.facing, h.near]).toEqual([
    room,
    x,
    y,
    facing,
    '',
  ]);
}

test.describe('the front garden', () => {
  test('the front door leads out to it, the side gate round to the back garden and back', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await shedToLounge(page);
    await loungeToHallway(page);

    await hallwayToFront(page);
    // Just inside the south edge, above the front door, facing up the path.
    await expectAt(page, 'frontGarden', 336, 190, 'up');
    // Outdoors: the garden's music, and the season's weather rather than the indoor motes.
    const out = await hook(page);
    expect(out.track).toBe('garden');
    expect(out.weather?.kind).not.toBe('motes');

    await frontToGate(page);
    // In the passage just below the gate in its north fence, facing down it.
    await expectAt(page, 'garden', 432, 34, 'down');

    await gardenGateToFront(page);
    await expectAt(page, 'frontGarden', 544, 190, 'up');

    await frontToHallway(page);
    // Just below the front door in the hallway's top wall, facing down.
    await expectAt(page, 'hallway', 240, 162, 'down');
    expect(errors).toEqual([]);
  });
});

test.describe('front garden screenshot', () => {
  // The front door's landing: the house's front face with its door and
  // windows, the path, the lawn and the beds, and on a desktop the road and
  // the garage's roller door too. Weather off first, as in camera.spec.ts, so
  // no petals move between runs, and the tutorial skipped so its corner box
  // does not cover the room.
  test('the front garden at the front door', async ({ page }) => {
    await bootWorld(page);
    await openSettingsFromMenu(page);
    await tapControl(page, 'panel-weather');
    await page.waitForFunction(() => window.__bonsai?.settings.weather === false);
    await tapControl(page, 'panel-close');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);

    await shedToLounge(page);
    await loungeToHallway(page);
    await hallwayToFront(page);
    await expectAt(page, 'frontGarden', 336, 190, 'up');
    await expect(page).toHaveScreenshot('front-garden.png');
  });
});
