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

type Arrow = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

/**
 * Holds `arrow` until `key` is in reach, or not at all if it already is. The
 * walks here end against the wall the player walks into (both doors sit in
 * one, the pedestals in a corner), so the wall stops the walk inside reach
 * however late the key is released; walkTo's row-then-along approach would
 * release the along key with the target already in reach and let a slow
 * runner carry the player past it (backlog #81).
 */
async function holdUntilNear(page: Page, arrow: Arrow, key: string): Promise<void> {
  if ((await hook(page)).near === key) return;
  await page.keyboard.down(arrow);
  await page.waitForFunction((k) => window.__bonsai?.near === k, key);
  await page.keyboard.up(arrow);
}

/** Holds `arrow` (up or left) until the player's coordinate on `axis` is at most `max`; a late release ends at the wall. */
async function holdUntilAtMost(
  page: Page,
  arrow: Arrow,
  axis: 'x' | 'y',
  max: number,
): Promise<void> {
  await page.keyboard.down(arrow);
  await page.waitForFunction(([a, limit]) => (window.__bonsai?.player[a] ?? NaN) <= limit, [
    axis,
    max,
  ] as const);
  await page.keyboard.up(arrow);
}

/** From under the door (a new game starts at (240, 135)): straight up into the top wall. */
async function toLounge(page: Page): Promise<void> {
  await holdUntilNear(page, 'ArrowUp', 'door_lounge');
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

    await holdUntilNear(page, 'ArrowDown', 'door');
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
    // From the tree's spot (x about 190): up into the top wall, then right along it until the door
    // is in reach. Along the wall row the door's reach spans 36 px, wider than the release lag seen
    // on CI; the pass back left covers a longer one (it does nothing while the door is in reach).
    await holdUntilAtMost(page, 'ArrowUp', 'y', 66);
    await holdUntilNear(page, 'ArrowRight', 'door_lounge');
    await holdUntilNear(page, 'ArrowLeft', 'door_lounge');
    await throughDoor(page, 'lounge');
    // Into the top-left corner: the left wall then the top wall stop the walk with the pedestal in reach.
    await holdUntilAtMost(page, 'ArrowLeft', 'x', 110);
    await holdUntilNear(page, 'ArrowUp', 'pedestal_1');
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
