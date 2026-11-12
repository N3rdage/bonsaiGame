import type { Page } from '@playwright/test';
import { holdUntilAtLeast, holdUntilAtMost, holdUntilNear, hook, interact, walkTo } from './drive';

// Walks between the shed and the house rooms (src/world/*Room.ts, pinned in
// world.test.ts). Shed lounge door (240, 56), in the top wall, to the lounge at
// (240, 190); lounge door (240, 216) back to the shed at (240, 82). The
// lounge's floor is x 64..416, y 112..208; its display spots are on its
// furniture, pedestal_1 lounge_mantel (240, 125) on the fireplace (x 224..256,
// y 112..136) straight above the landing, and pedestal_2 lounge_side_table
// (408, 122) on the side table (x 400..416, y 112..128) in the top-right
// corner; both pieces stop the player. Every door past the shed sits on the row y 190 in a side
// wall: the lounge's door_hallway (424, 190) to the hallway at (114, 190); the
// hallway's door_lounge (88, 190) back to the lounge at (398, 190) and
// door_study (392, 190) to the study at (162, 190); the study's door_hallway
// (136, 190) back to the hallway at (366, 190). The study's glass doors,
// door_garden (320, 216), 32x16 in its bottom wall, lead to the garden at
// (446, 190); the garden's door_study (472, 190), on its right fence, back to
// the study at (320, 190). Every walk ends against a wall or a solid piece of
// furniture, which stops the player in reach however late the key is released
// (backlog #81): from the study's hallway landing, right into the right wall
// (x 335.75) and down into the bottom wall (y 207.5), 17.9 px from the glass
// doors; from the garden's landing, right into the fence (x 463.5).

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

/**
 * From a study landing on the row y 190: right into the right wall unless
 * already above the glass doors (from the hallway's landing), then down into
 * the bottom wall, the doors in reach, and out into the garden.
 */
export async function studyToGarden(page: Page): Promise<void> {
  if ((await hook(page)).player.x < 300) await holdUntilAtLeast(page, 'ArrowRight', 'x', 330);
  await holdUntilNear(page, 'ArrowDown', 'door_garden');
  await throughDoor(page, 'garden');
}

/** From the garden's study-door landing (446, 190): right along the row into the fence, and into the study. */
export async function gardenToStudy(page: Page): Promise<void> {
  await holdUntilNear(page, 'ArrowRight', 'door_study');
  await throughDoor(page, 'study');
}

/** From anywhere in the garden: down or up to the doorway's row y 228, left to the shed door, and through it. */
export async function gardenToShed(page: Page): Promise<void> {
  await walkTo(page, 228, 'left', 'door');
  await throughDoor(page, 'shed');
}

/**
 * From the lounge's shed-door landing (240, 190): to the mantel straight up
 * into the fireplace; to the side table right into the right wall (by its
 * door), then up into the table.
 */
export async function toLoungePedestal(page: Page, pedestal: 1 | 2): Promise<void> {
  if (pedestal === 2) await holdUntilNear(page, 'ArrowRight', 'door_hallway');
  await holdUntilNear(page, 'ArrowUp', `pedestal_${String(pedestal)}`);
}
