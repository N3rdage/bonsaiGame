import type { Page } from '@playwright/test';
import { serializeState } from '../src/sim/save';
import { createNewGameState } from '../src/sim/state';
import { CARRIED } from '../src/sim/tree';
import {
  collectErrors,
  continueGame,
  expect,
  holdUntilNear,
  hook,
  interact,
  loadGame,
  openMenu,
  placeTree,
  saveGame,
  tapControl,
  test,
  toTitle,
  walkTo,
} from './drive';
import { gardenToGreenhouse, shedToGarden } from './rooms';

// A version-6 save with a pedestal (id 0) at (240, 128) and a floor shelf
// (id 1) at (288, 128) in the greenhouse, both on its 10x7 floor (x 160..320,
// y 80..192), Granny's juniper carried. The pedestal's one spot, placed_0, is
// centred at (248, 136); the shelf's two, placed_1 and placed_1_2, at
// (296, 136) and (312, 136). Placed furniture is walk-through. The
// greenhouse's landing is (240, 174).

async function seedAndContinue(page: Page): Promise<void> {
  const state = createNewGameState();
  state.placed = [
    { id: 0, kind: 'pedestal', room: 'greenhouse', x: 240, y: 128 },
    { id: 1, kind: 'floor_shelf', room: 'greenhouse', x: 288, y: 128 },
  ];
  state.nextPlacedId = 2;
  const [starter] = state.trees;
  if (!starter) throw new Error('no starter');
  starter.location = CARRIED;
  await page.goto('/');
  await page.evaluate(
    (text) => {
      localStorage.setItem('bonsai.save.1', text);
    },
    serializeState(state, new Date(2026, 10, 11, 0, 0)),
  );
  await toTitle(page);
  await continueGame(page);
  await page.waitForFunction(
    () => window.__bonsai?.ready === true && window.__bonsai.scene === 'world',
  );
}

test.describe('placed furniture', () => {
  test('a placed pedestal displays a tree that earns, survives a reload, and an empty shelf is picked back up', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await seedAndContinue(page);
    expect((await hook(page)).carrying).toBe("Granny's");
    // None drawn outside the greenhouse.
    expect((await hook(page)).placed).toEqual([]);
    await shedToGarden(page);
    await gardenToGreenhouse(page);

    let h = await hook(page);
    expect(h.placed).toEqual([
      { id: 0, kind: 'pedestal', x: 240, y: 128, w: 16, h: 16, spots: ['placed_0'] },
      {
        id: 1,
        kind: 'floor_shelf',
        x: 288,
        y: 128,
        w: 32,
        h: 16,
        spots: ['placed_1', 'placed_1_2'],
      },
    ]);

    // Up from the landing to the pedestal; carrying, its spot offers the pedestal flow.
    await holdUntilNear(page, 'ArrowUp', 'placed_0');
    expect((await hook(page)).prompt).toContain('Display');
    await placeTree(page);
    h = await hook(page);
    expect(h.treeLocations).toEqual([{ id: 0, name: "Granny's", location: 'displayed:placed_0' }]);
    expect(h.carrying).toBe('');

    // A night's sleep pays the displayed tree.
    const day = h.day;
    await page.keyboard.press('z');
    await page.waitForFunction((d) => (window.__bonsai?.day ?? 0) > d, day);
    expect((await hook(page)).toast).toContain('Display revenue');

    // Saved and loaded: the load starts in the shed; back in the greenhouse all is as left.
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
    expect(h.treeLocations).toEqual([{ id: 0, name: "Granny's", location: 'displayed:placed_0' }]);
    expect(h.placed?.map((p) => p.kind)).toEqual(['pedestal', 'floor_shelf']);

    // Empty-handed at the shelf's empty first spot: Pick up puts it back in the inventory.
    await walkTo(page, 136, 'right', 'placed_1');
    expect((await hook(page)).prompt).toContain('Pick up');
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.toast === 'Picked up Floor shelf');
    h = await hook(page);
    expect(h.placed).toEqual([
      { id: 0, kind: 'pedestal', x: 240, y: 128, w: 16, h: 16, spots: ['placed_0'] },
    ]);

    await openMenu(page);
    await tapControl(page, 'menu-inventory');
    await page.waitForFunction(() => window.__bonsai?.panel === 'inventory');
    const furniture = (await hook(page)).inventorySections?.find((s) => s.title === 'Furniture');
    expect(furniture?.entries).toContainEqual({ label: 'Floor shelves', count: 1 });
    expect(errors).toEqual([]);
  });
});
