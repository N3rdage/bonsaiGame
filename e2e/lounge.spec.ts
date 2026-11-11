import type { Page } from '@playwright/test';
import {
  bootWorld,
  collectErrors,
  continueGame,
  expect,
  hook,
  interact,
  pickUpTree,
  placeTree,
  saveGame,
  test,
  toTitle,
  walkTo,
} from './drive';

// Shed lounge door (240, 56), in the top wall, to the lounge at (240, 190);
// lounge door (240, 216) back to the shed at (240, 82). Lounge pedestals:
// lounge_main (200, 85) and lounge_window (280, 85).

async function throughDoor(page: Page, room: string): Promise<void> {
  await interact(page);
  await page.waitForFunction((r) => window.__bonsai?.room === r, room);
}

async function toLounge(page: Page): Promise<void> {
  await walkTo(page, 70, 'right', 'door_lounge');
  await throughDoor(page, 'lounge');
}

test.describe('the lounge', () => {
  test("the shed's top door leads to the lounge and its door back", async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    expect((await hook(page)).room).toBe('shed');

    await toLounge(page);
    let h = await hook(page);
    expect([h.room, h.player.x, h.player.y]).toEqual(['lounge', 240, 190]);
    expect(h.near).toBe('');

    await walkTo(page, 200, 'left', 'door');
    await throughDoor(page, 'shed');
    h = await hook(page);
    expect([h.room, h.player.x, h.player.y]).toEqual(['shed', 240, 82]);
    // Landed below the lounge door, just out of its reach.
    expect(h.near).toBe('');
    expect(h.treeLocations).toEqual([{ id: 0, name: "Granny's", location: 'shed' }]);
    expect(errors).toEqual([]);
  });

  test('a tree displayed in the lounge survives save and reload', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await walkTo(page, 160, 'left', 'tree:0');
    await pickUpTree(page);
    await toLounge(page);
    await walkTo(page, 85, 'left', 'pedestal_1');
    await placeTree(page);
    let h = await hook(page);
    expect(h.carrying).toBe('');
    expect(h.treeLocations).toEqual([
      { id: 0, name: "Granny's", location: 'displayed:lounge_main' },
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
      { id: 0, name: "Granny's", location: 'displayed:lounge_main' },
    ]);
    expect(errors).toEqual([]);
  });
});
