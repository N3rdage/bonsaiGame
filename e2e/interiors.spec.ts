import type { Page } from '@playwright/test';
import {
  bootWorld,
  expect,
  hook,
  openSettingsFromMenu,
  skipTutorial,
  tapControl,
  test,
} from './drive';
import { hallwayToStudy, loungeToHallway, shedToLounge } from './rooms';

// One baseline per house room on the S22 in landscape, taken at the spot the
// walk from the shed lands on: each room's own shape and windows (the lounge
// two, the study one, the hallway's corridor with dark space above and below)
// and furniture (the lounge's fireplace and side table, the hallway's runner
// and console table, the study's desk and bookcase) as the phone's zoomed
// world camera shows them. Weather is off first, as in
// camera.spec.ts, so the dust motes cannot move between runs, and the
// tutorial is skipped so its corner box does not cover the room.

async function expectEntry(page: Page, room: string, x: number, y: number): Promise<void> {
  const h = await hook(page);
  expect([h.room, h.player.x, h.player.y, h.near]).toEqual([room, x, y, '']);
  await expect(page).toHaveScreenshot(`${room}-entry.png`);
}

test.describe('house interiors screenshot', () => {
  test('the lounge, the hallway and the study at their entry points', async ({ page }) => {
    test.skip(test.info().project.name !== 's22-landscape', 'S22 landscape baselines only');
    // Three rooms' walks and captures in one test take about a minute on software GL, the default budget.
    test.setTimeout(120_000);
    await bootWorld(page);
    await openSettingsFromMenu(page);
    await tapControl(page, 'panel-weather');
    await page.waitForFunction(() => window.__bonsai?.settings.weather === false);
    await tapControl(page, 'panel-close');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);

    await shedToLounge(page);
    await expectEntry(page, 'lounge', 240, 190);
    await loungeToHallway(page);
    await expectEntry(page, 'hallway', 114, 190);
    await hallwayToStudy(page);
    await expectEntry(page, 'study', 162, 190);
  });
});
