import type { Page } from '@playwright/test';
import { holdUntilAtMost, holdUntilNear, hook, interact } from './drive';

// Walks between the shed and the house rooms (src/world/*Room.ts, pinned in
// world.test.ts). Shed lounge door (240, 56), in the top wall, to the lounge at
// (240, 190); lounge door (240, 216) back to the shed at (240, 82). The
// lounge's floor is x 64..416, y 112..208; its pedestals, pedestal_1
// lounge_mantel (68, 128) and pedestal_2 lounge_side_table (412, 128), stand in
// its top corners. Every door past the shed sits on the row y 190 in a side
// wall: the lounge's door_hallway (424, 190) to the hallway at (114, 190); the
// hallway's door_lounge (88, 190) back to the lounge at (398, 190) and
// door_study (392, 190) to the study at (162, 190); the study's door_hallway
// (136, 190) back to the hallway at (366, 190). Every walk ends against a
// wall, which stops the player in reach however late the key is released
// (backlog #81).

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

/** From a lounge landing on the row y 190: right along the row into the right wall, and through its door. */
export async function loungeToHallway(page: Page): Promise<void> {
  await holdUntilNear(page, 'ArrowRight', 'door_hallway');
  await throughDoor(page, 'hallway');
}

/** From the hallway's lounge-door landing: right along the corridor into its right wall, and into the study. */
export async function hallwayToStudy(page: Page): Promise<void> {
  await holdUntilNear(page, 'ArrowRight', 'door_study');
  await throughDoor(page, 'study');
}

/** From the lounge's landing: up into the top wall (the floor's top is y 112), then along it into the pedestal's corner. */
export async function toLoungePedestal(page: Page, pedestal: 1 | 2): Promise<void> {
  await holdUntilAtMost(page, 'ArrowUp', 'y', 114);
  await holdUntilNear(
    page,
    pedestal === 1 ? 'ArrowLeft' : 'ArrowRight',
    `pedestal_${String(pedestal)}`,
  );
}
