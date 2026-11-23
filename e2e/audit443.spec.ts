import type { Page } from '@playwright/test';
import { bootWorld, skipTutorial, test } from './drive';
import {
  frontToGate,
  gardenToGreenhouse,
  hallwayToFront,
  loungeToHallway,
  shedToLounge,
} from './rooms';

// Throwaway capture for backlog #445's audit: 3D world screenshots at the S22 landscape size.
const SETTINGS = JSON.stringify({ fullscreen: false, weather: false, world3d: true });
const OUT = 'docs/audit-443';

async function settle(page: Page, room: string): Promise<void> {
  await page.waitForFunction(
    (r) =>
      window.__bonsai?.world3d?.room === r &&
      window.__bonsai.world3d.floorSheet !== null &&
      window.__bonsai.world3d.wallSheets.length > 0,
    room,
  );
  await page.waitForTimeout(3000);
}

async function shot(page: Page, room: string, name: string): Promise<void> {
  await settle(page, room);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

test.use({ reducedMotion: 'reduce' });

test('audit 3D rooms', async ({ page }) => {
  test.setTimeout(500_000);
  await page.addInitScript((s) => {
    localStorage.setItem('bonsai.settings', s);
  }, SETTINGS);
  await bootWorld(page);
  await settle(page, 'shed');
  await skipTutorial(page, true);
  await shot(page, 'shed', 'shed');
  await shedToLounge(page);
  await shot(page, 'lounge', 'lounge');
  await loungeToHallway(page);
  await shot(page, 'hallway', 'hallway');
  await hallwayToFront(page);
  await shot(page, 'frontGarden', 'front-garden');
  await frontToGate(page);
  await shot(page, 'garden', 'garden');
  await gardenToGreenhouse(page);
  await shot(page, 'greenhouse', 'greenhouse');
});
