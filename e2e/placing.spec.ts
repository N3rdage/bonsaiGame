import type { Page } from '@playwright/test';
import { serializeState } from '../src/sim/save';
import { createNewGameState } from '../src/sim/state';
import { CARRIED } from '../src/sim/tree';
import {
  closePanel,
  collectErrors,
  continueGame,
  expect,
  holdUntilAtLeast,
  holdUntilAtMost,
  hook,
  interact,
  loadGame,
  nextPlacingKind,
  openMenu,
  placeTree,
  saveGame,
  sleepOneNight,
  startPlacing,
  stopPlacing,
  tapControl,
  test,
  toTitle,
  walkTo,
  walkToRow,
} from './drive';
import { gardenToGreenhouse, shedToGarden } from './rooms';

// A version-5 save with a pedestal and a floor shelf in the inventory, nothing
// placed (so the first placed item is placed_0), Granny's juniper carried. The
// greenhouse's floor is x 64..416, y 64..224; its landing is (240, 206) and a
// walk straight down from it stops against the bottom wall at y 223.5, the
// door's tile (240, 224) below in the wall band.

async function seedAndContinue(page: Page): Promise<void> {
  const state = createNewGameState();
  state.inventory.pedestal = 1;
  state.inventory.floor_shelf = 1;
  state.placed = [];
  state.nextPlacedId = 0;
  const [starter] = state.trees;
  if (!starter) throw new Error('no starter');
  starter.location = CARRIED;
  await page.goto('/');
  await page.evaluate(
    (text) => {
      localStorage.setItem('bonsai.save.1', text);
    },
    serializeState(state, new Date(2026, 10, 12, 0, 0)),
  );
  await toTitle(page);
  await continueGame(page);
  await page.waitForFunction(
    () => window.__bonsai?.ready === true && window.__bonsai.scene === 'world',
  );
}

/** Waits two world steps, so a key released just now has stopped the player and the hook shows where. */
async function settle(page: Page): Promise<void> {
  const frames = (await hook(page)).frames;
  await page.waitForFunction((f) => (window.__bonsai?.frames ?? 0) >= f + 2, frames);
}

/** Opens the HUD menu, reads its row ids, and closes it again. */
async function menuRows(page: Page): Promise<string[]> {
  await openMenu(page);
  const rows = (await hook(page)).controls.map((c) => c.id).filter((id) => id.startsWith('menu-'));
  await tapControl(page, 'menu');
  await page.waitForFunction(() => window.__bonsai?.panel === '');
  return rows;
}

test.describe('placement mode', () => {
  test('puts a pedestal down in the greenhouse, displays a tree on it that earns, and survives a reload', async ({
    page,
  }) => {
    // Three rooms' walks, the menu taps and a save and reload take about a minute on the S22's tap route.
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await seedAndContinue(page);
    expect(await menuRows(page)).not.toContain('menu-place');
    await shedToGarden(page);
    expect(await menuRows(page)).not.toContain('menu-place');
    await gardenToGreenhouse(page);
    expect(await menuRows(page)).toContain('menu-place');

    // P (or Place item) starts with the first kind in stock; Next cycles through the stock and wraps.
    await startPlacing(page);
    expect((await hook(page)).placing?.kind).toBe('pedestal');
    await nextPlacingKind(page);
    expect((await hook(page)).placing?.kind).toBe('floor_shelf');
    await nextPlacingKind(page);
    expect((await hook(page)).placing?.kind).toBe('pedestal');

    // The player came in facing up. A step up and back down to y 196..202.25, facing down:
    // the ghost is the landing tile, inside the door's clearance ring.
    await walkToRow(page, 190);
    await walkToRow(page, 196);
    await settle(page);
    let h = await hook(page);
    expect(h.player.facing).toBe('down');
    expect(h.placing).toEqual({
      kind: 'pedestal',
      x: 240,
      y: 208,
      w: 16,
      h: 16,
      check: 'blocks the door',
    });
    expect(h.prompt).toBe('Blocks the door');
    expect(h.placingVisible).toBe(true);
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.toast === 'Blocks the door');
    expect((await hook(page)).placed).toEqual([]);

    // Under the Inventory the mode holds but the ghost is not drawn; closed, it is back.
    await openMenu(page);
    await tapControl(page, 'menu-inventory');
    await page.waitForFunction(() => window.__bonsai?.panel === 'inventory');
    h = await hook(page);
    expect(h.placing?.kind).toBe('pedestal');
    expect(h.placingVisible).toBe(false);
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect((await hook(page)).placingVisible).toBe(true);

    // Against the bottom wall facing down, the ghost is over the door's tile, in the wall band.
    await holdUntilAtLeast(page, 'ArrowDown', 'y', 223);
    await settle(page);
    h = await hook(page);
    expect(h.player.facing).toBe('down');
    expect(h.placing).toEqual({
      kind: 'pedestal',
      x: 240,
      y: 224,
      w: 16,
      h: 16,
      check: 'off the floor',
    });
    expect(h.prompt).toBe('Off the floor');
    // Placing suppresses the door: E toasts the refusal and stays in the greenhouse.
    expect(h.near).toBe('');
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.toast === 'Off the floor');
    h = await hook(page);
    expect(h.room).toBe('greenhouse');
    expect(h.placed).toEqual([]);

    // Up onto open floor: the ghost on the tile above the player is green.
    await holdUntilAtMost(page, 'ArrowUp', 'y', 190);
    await settle(page);
    h = await hook(page);
    const ghost = h.placing;
    if (!ghost) throw new Error('not placing');
    expect(ghost.check).toBe('ok');
    expect(h.prompt).toBe('E: Place Pedestal');
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.toast === 'Placed Pedestal');
    h = await hook(page);
    expect(h.placed).toEqual([
      { id: 0, kind: 'pedestal', x: ghost.x, y: ghost.y, w: 16, h: 16, spots: ['placed_0'] },
    ]);
    expect(h.inventory.pedestal).toBe(0);
    // The pedestals ran out, the shelf is still in stock: the mode carries on with it, refused over the pedestal.
    expect(h.placing).toMatchObject({
      kind: 'floor_shelf',
      x: ghost.x,
      y: ghost.y,
      check: 'in the way',
    });
    expect(h.prompt).toBe('In the way');

    await stopPlacing(page);
    h = await hook(page);
    expect(h.scene).toBe('world');
    expect(h.placing).toBeUndefined();
    expect(h.inventory.floor_shelf).toBe(1);

    // To the new pedestal, display Granny's juniper on it, and a night pays for it.
    await walkTo(page, ghost.y + 8, 'right', 'placed_0');
    expect((await hook(page)).prompt).toContain('Display');
    await placeTree(page);
    h = await hook(page);
    expect(h.treeLocations).toEqual([{ id: 0, name: "Granny's", location: 'displayed:placed_0' }]);
    const { day, money } = h;
    await sleepOneNight(page);
    await page.waitForFunction((d) => (window.__bonsai?.day ?? 0) > d, day);
    expect((await hook(page)).money).toBeGreaterThan(money);

    // Saved and loaded: back in the greenhouse the pedestal and its tree are as left.
    await saveGame(page);
    await page.waitForFunction(() => window.__bonsai?.toast === 'Saved to slot 1');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    await loadGame(page);
    await page.waitForFunction(
      () => window.__bonsai?.ready === true && window.__bonsai.room === 'shed',
    );
    await shedToGarden(page);
    await gardenToGreenhouse(page);
    h = await hook(page);
    expect(h.placed).toEqual([
      { id: 0, kind: 'pedestal', x: ghost.x, y: ghost.y, w: 16, h: 16, spots: ['placed_0'] },
    ]);
    expect(h.treeLocations).toEqual([{ id: 0, name: "Granny's", location: 'displayed:placed_0' }]);
    expect(h.placing).toBeUndefined();
    expect(errors).toEqual([]);
  });
});
