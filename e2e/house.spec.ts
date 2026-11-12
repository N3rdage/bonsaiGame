import type { Page } from '@playwright/test';
import {
  bootWorld,
  collectErrors,
  continueGame,
  expect,
  holdUntilAtMost,
  holdUntilNear,
  hook,
  pickUpTree,
  placeTree,
  saveGame,
  test,
  toTitle,
  walkTo,
} from './drive';
import {
  gardenToShed,
  gardenToStudy,
  hallwayToStudy,
  loungeToHallway,
  shedToLounge,
  studyToGarden,
  throughDoor,
} from './rooms';

// The doors and landings are in rooms.ts. The hallway is a corridor, x 80..400
// and y 160..224: its floor is y 176..208, so a walk up or down it stops at
// y 176.25 or 207.5 on the 1.25 px step grid. The study's floor is x 144..336,
// y 112..208; its display spots are on the furniture in its top corners,
// study_desk (160, 123) on the desk (x 144..176, y 112..128) and
// study_bookshelf (328, 120.5) on the bookcase (x 288..336, y 112..128).

async function expectAt(page: Page, room: string, x: number, y: number): Promise<void> {
  const h = await hook(page);
  expect([h.room, h.player.x, h.player.y]).toEqual([room, x, y]);
  // Landed 26 px from the door just used, out of its reach.
  expect(h.near).toBe('');
}

/** From the lounge's landing: right along the row into the right wall, then on to the study. */
async function loungeToStudy(page: Page): Promise<void> {
  await loungeToHallway(page);
  await expectAt(page, 'hallway', 114, 190);
  await hallwayToStudy(page);
  await expectAt(page, 'study', 162, 190);
}

/** Holds `arrow` until the player reaches `wallY`, then 60 frames more, and expects the wall to have kept it there. */
async function holdAgainstWall(
  page: Page,
  arrow: 'ArrowUp' | 'ArrowDown',
  wallY: number,
): Promise<void> {
  await page.keyboard.down(arrow);
  await page.waitForFunction((y) => window.__bonsai?.player.y === y, wallY);
  const frames = (await hook(page)).frames;
  await page.waitForFunction((n) => (window.__bonsai?.frames ?? 0) >= n + 60, frames);
  await page.keyboard.up(arrow);
  const h = await hook(page);
  expect([h.room, h.player.x, h.player.y]).toEqual(['hallway', 114, wallY]);
}

test.describe('the house', () => {
  test('the lounge leads through the hallway to the study and back', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await shedToLounge(page);

    await loungeToStudy(page);

    await holdUntilNear(page, 'ArrowLeft', 'door_hallway');
    await throughDoor(page, 'hallway');
    await expectAt(page, 'hallway', 366, 190);
    await holdUntilNear(page, 'ArrowLeft', 'door_lounge');
    await throughDoor(page, 'lounge');
    await expectAt(page, 'lounge', 398, 190);
    expect(errors).toEqual([]);
  });

  test("the study's glass doors lead out to the garden and back, and the garden home to the shed", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await shedToLounge(page);
    await loungeToStudy(page);

    await studyToGarden(page);
    await expectAt(page, 'garden', 446, 190);
    await gardenToStudy(page);
    await expectAt(page, 'study', 320, 190);
    await studyToGarden(page);
    await expectAt(page, 'garden', 446, 190);

    await gardenToShed(page);
    await expectAt(page, 'shed', 240, 190);
    expect(errors).toEqual([]);
  });

  test('the hallway is a corridor: a walk up or down it stops at its walls', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await shedToLounge(page);
    await loungeToHallway(page);
    await expectAt(page, 'hallway', 114, 190);
    await holdAgainstWall(page, 'ArrowUp', 176.25);
    await holdAgainstWall(page, 'ArrowDown', 207.5);
    expect(errors).toEqual([]);
  });

  test('a tree displayed in the study survives save and reload', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await walkTo(page, 160, 'left', 'tree:0');
    await pickUpTree(page);
    await shedToLounge(page);
    await loungeToStudy(page);
    // Into the left wall (past the study's door, in reach on the way), then up: the desk stops
    // the walk at y 128.75 with its spot in reach.
    await holdUntilAtMost(page, 'ArrowLeft', 'x', 150);
    await holdUntilNear(page, 'ArrowUp', 'pedestal_1');
    await placeTree(page);
    let h = await hook(page);
    expect(h.carrying).toBe('');
    expect(h.treeLocations).toEqual([
      { id: 0, name: "Granny's", location: 'displayed:study_desk' },
    ]);
    await saveGame(page);
    await page.waitForFunction(() => window.__bonsai?.toast === 'Saved to slot 1');

    await toTitle(page);
    await continueGame(page);
    await page.waitForFunction(
      () => window.__bonsai?.ready === true && window.__bonsai.scene === 'world',
    );
    h = await hook(page);
    expect(h.room).toBe('shed');
    expect(h.treeLocations).toEqual([
      { id: 0, name: "Granny's", location: 'displayed:study_desk' },
    ]);
    expect(errors).toEqual([]);
  });
});
