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

// Shed door (240, 216), in the bottom wall, to the garden at (50, 225); garden
// door (16, 228) back to the shed at (240, 190). Source plants: juniper
// (140, 90), maple (260, 80).

async function throughDoor(page: Page, room: string): Promise<void> {
  await interact(page);
  await page.waitForFunction((r) => window.__bonsai?.room === r, room);
}

async function toGarden(page: Page): Promise<void> {
  await walkTo(page, 200, 'left', 'door');
  await throughDoor(page, 'garden');
}

test.describe('the garden', () => {
  test('the shed door leads to the garden and its door back', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    expect((await hook(page)).room).toBe('shed');

    await toGarden(page);
    let h = await hook(page);
    expect([h.room, h.player.x, h.player.y]).toEqual(['garden', 50, 225]);
    expect(h.near).toBe('');

    await walkTo(page, 228, 'left', 'door');
    await throughDoor(page, 'shed');
    h = await hook(page);
    expect([h.room, h.player.x, h.player.y]).toEqual(['shed', 240, 190]);
    // Landed on the floor above the shed door, just out of its reach; a step down reaches it.
    expect(h.near).toBe('');
    await walkTo(page, 200, 'left', 'door');
    expect(h.treeLocations).toEqual([{ id: 0, name: "Granny's", location: 'shed' }]);
    expect(errors).toEqual([]);
  });

  test('takes a juniper cutting; the maple refuses', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await toGarden(page);
    const before = (await hook(page)).inventory;
    expect(before.cutting_juniper).toBe(0);

    await walkTo(page, 90, 'right', 'source_juniper');
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.inventory.cutting_juniper === 1);
    expect((await hook(page)).toast).toBe('Took a Juniper cutting  (1 in inventory)');

    await walkTo(page, 80, 'right', 'source_maple');
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.toast.startsWith('Japanese Maple') === true);
    const h = await hook(page);
    expect(h.toast).toBe("Japanese Maple can't be grown from cuttings - try seeds");
    expect(h.inventory).toEqual({ ...before, cutting_juniper: 1 });
    expect(errors).toEqual([]);
  });
});

test.describe('the day clock', () => {
  test('a displayed tree earns display revenue as the days pass', async ({ page }) => {
    const errors = collectErrors(page);
    // The carrying happens at 1x: a passing day rebuilds an open inspector, and
    // at speed that can land between a tap's pointerdown and pointerup. The
    // placement is saved, then continued at 150x (a day every 2 s).
    await bootWorld(page);
    await walkTo(page, 160, 'left', 'tree:0');
    await pickUpTree(page);
    await walkTo(page, 85, 'right', 'pedestal_1');
    await placeTree(page);
    await saveGame(page);
    await page.waitForFunction(() => window.__bonsai?.toast === 'Saved to slot 1');

    await toTitle(page, '/?timeScale=150');
    await continueGame(page);
    await page.waitForFunction(
      () => window.__bonsai?.ready === true && window.__bonsai.scene === 'world',
    );
    const before = await hook(page);
    expect(before.treeLocations).toEqual([
      { id: 0, name: "Granny's", location: 'displayed:shed_main' },
    ]);
    const handle = await page.waitForFunction(
      (day) => {
        const h = window.__bonsai;
        return h && h.day > day
          ? { day: h.day, money: h.money, toast: h.toast, hud: h.hud }
          : false;
      },
      before.day,
      { timeout: 10_000 },
    );
    const after = await handle.jsonValue();
    if (!after) throw new Error('no day passed');
    expect(after.day).toBe(before.day + 1);
    // The toast is what advanceDayAllTrees paid; the money rose by exactly that.
    const paid = Number(/^Display revenue: \+\$(\d+)$/.exec(after.toast)?.[1]);
    expect(paid).toBeGreaterThan(0);
    expect(after.money - before.money).toBe(paid);
    expect(after.hud).toContain(`Day ${String(after.day)}  |  $${String(after.money)}`);
    expect(after.hud).not.toBe(before.hud);
    expect(errors).toEqual([]);
  });
});
