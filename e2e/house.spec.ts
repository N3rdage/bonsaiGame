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
import { shedToLounge, throughDoor } from './rooms';

// Every door past the shed sits on the row y 190, in a side wall: the lounge's
// door_hallway (392, 190) to the hallway at (114, 190); the hallway's
// door_lounge (88, 190) back to the lounge at (366, 190) and door_study
// (392, 190) to the study at (114, 190); the study's door_hallway (88, 190)
// back to the hallway at (366, 190). Each walk to a door is straight along the
// row into its wall, which stops the player in reach however late the key is
// released. Study pedestals: study_desk (100, 80) and study_bookshelf (380, 80).

async function expectAt(page: Page, room: string, x: number, y: number): Promise<void> {
  const h = await hook(page);
  expect([h.room, h.player.x, h.player.y]).toEqual([room, x, y]);
  // Landed 26 px from the door just used, out of its reach.
  expect(h.near).toBe('');
}

/** From the lounge's landing: right along the row into the right wall, then on to the study. */
async function loungeToStudy(page: Page): Promise<void> {
  await holdUntilNear(page, 'ArrowRight', 'door_hallway');
  await throughDoor(page, 'hallway');
  await expectAt(page, 'hallway', 114, 190);
  await holdUntilNear(page, 'ArrowRight', 'door_study');
  await throughDoor(page, 'study');
  await expectAt(page, 'study', 114, 190);
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
    await expectAt(page, 'lounge', 366, 190);
    expect(errors).toEqual([]);
  });

  test('a tree displayed in the study survives save and reload', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await walkTo(page, 160, 'left', 'tree:0');
    await pickUpTree(page);
    await shedToLounge(page);
    await loungeToStudy(page);
    // Into the top-left corner (past the study's door, in reach on the way): the left wall then
    // the top wall stop the walk with the pedestal in reach.
    await holdUntilAtMost(page, 'ArrowLeft', 'x', 110);
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
