import type { Page } from '@playwright/test';
import { holdUntilAtMost, holdUntilNear, hook, interact } from './drive';

// Walks between the shed and the lounge, where the display pedestals are.
// Shed lounge door (240, 56), in the top wall, to the lounge at (240, 190);
// lounge door (240, 216) back to the shed at (240, 82). Lounge pedestals:
// pedestal_1 lounge_mantel (100, 80) and pedestal_2 lounge_side_table
// (380, 80), in the top corners. Every walk ends against a wall, which stops
// the player in reach however late the key is released (backlog #81).

/** Uses the door in reach and waits for `room`. */
export async function throughDoor(page: Page, room: string): Promise<void> {
  await interact(page);
  await page.waitForFunction((r) => window.__bonsai?.room === r, room);
}

/**
 * From the shed floor: up into the top wall, then along it to the lounge door
 * and back (the return pass covers a release that carried past the door; it
 * does nothing while the door is in reach), and through it.
 */
export async function shedToLounge(page: Page): Promise<void> {
  await holdUntilAtMost(page, 'ArrowUp', 'y', 66);
  const fromLeft = (await hook(page)).player.x < 240;
  await holdUntilNear(page, fromLeft ? 'ArrowRight' : 'ArrowLeft', 'door_lounge');
  await holdUntilNear(page, fromLeft ? 'ArrowLeft' : 'ArrowRight', 'door_lounge');
  await throughDoor(page, 'lounge');
}

/** From the lounge's landing: up into the top wall, then along it into the pedestal's corner. */
export async function toLoungePedestal(page: Page, pedestal: 1 | 2): Promise<void> {
  await holdUntilAtMost(page, 'ArrowUp', 'y', 66);
  await holdUntilNear(
    page,
    pedestal === 1 ? 'ArrowLeft' : 'ArrowRight',
    `pedestal_${String(pedestal)}`,
  );
}
