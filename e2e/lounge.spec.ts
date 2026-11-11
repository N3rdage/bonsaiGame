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
// lounge_main (100, 80) and lounge_window (380, 80), in the top corners.

async function throughDoor(page: Page, room: string): Promise<void> {
  await interact(page);
  await page.waitForFunction((r) => window.__bonsai?.room === r, room);
}

/**
 * Walks straight up or down until `key` is in reach. Both doors here sit in
 * the wall the player walks into, right above or below where the player
 * stands, so the wall stops the walk inside the door's reach however late the
 * key is released; walkTo's row-then-along approach would release the along
 * key with the door already in reach and let a slow runner carry the player
 * past it (backlog #81).
 */
async function walkInto(page: Page, dy: 'up' | 'down', key: string): Promise<void> {
  const vertical = dy === 'up' ? 'ArrowUp' : 'ArrowDown';
  await page.keyboard.down(vertical);
  await page.waitForFunction((k) => window.__bonsai?.near === k, key);
  await page.keyboard.up(vertical);
}

/** Walks left until the player's x is at most `x`; the left wall bounds a late release the same way. */
async function walkLeftTo(page: Page, x: number): Promise<void> {
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction((limit) => (window.__bonsai?.player.x ?? NaN) <= limit, x);
  await page.keyboard.up('ArrowLeft');
}

async function toLounge(page: Page): Promise<void> {
  await walkInto(page, 'up', 'door_lounge');
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

    await walkInto(page, 'down', 'door');
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
    // Into the top-left corner: the left wall then the top wall stop the walk with the pedestal in reach.
    await walkLeftTo(page, 110);
    await walkInto(page, 'up', 'pedestal_1');
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
