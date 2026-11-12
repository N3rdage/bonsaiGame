import { serializeState } from '../src/sim/save';
import { createNewGameState } from '../src/sim/state';
import {
  bootWorld,
  collectErrors,
  continueGame,
  expect,
  holdUntilNear,
  hook,
  interact,
  pickUpTree,
  placeTree,
  saveGame,
  test,
  toTitle,
  walkTo,
} from './drive';
import { shedToLounge, throughDoor, toLoungePedestal } from './rooms';

/** A version-3 save, before the shed's pedestals moved, with Granny's juniper on the shed's shed_main. */
function v3SaveOnShedMain(): string {
  const state = createNewGameState();
  const [starter] = state.trees;
  if (!starter) throw new Error('no starter');
  starter.location = 'displayed:shed_main';
  const v4 = JSON.parse(serializeState(state, new Date(2026, 10, 11, 0, 0))) as object;
  return JSON.stringify({ ...v4, version: 3 });
}

test.describe('the lounge', () => {
  test("the shed's top door leads to the lounge and its door back", async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    expect((await hook(page)).room).toBe('shed');

    // From under the door (a new game starts at (240, 135)): straight up into the top wall.
    await shedToLounge(page);
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

  test('the fireplace stops a walk straight up from the landing, with the mantel in reach', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await shedToLounge(page);
    // Hold Up until the fireplace's front edge (y 136) stops the player, then 60 frames more.
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(() => window.__bonsai?.player.y === 136.25);
    const frames = (await hook(page)).frames;
    await page.waitForFunction((n) => (window.__bonsai?.frames ?? 0) >= n + 60, frames);
    await page.keyboard.up('ArrowUp');
    const h = await hook(page);
    expect([h.room, h.player.x, h.player.y, h.near]).toEqual(['lounge', 240, 136.25, 'pedestal_1']);
    expect(errors).toEqual([]);
  });

  test('a tree displayed in the lounge survives save and reload', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await walkTo(page, 160, 'left', 'tree:0');
    await pickUpTree(page);
    await shedToLounge(page);
    await toLoungePedestal(page, 1);
    await placeTree(page);
    let h = await hook(page);
    expect(h.carrying).toBe('');
    expect(h.treeLocations).toEqual([
      { id: 0, name: "Granny's", location: 'displayed:lounge_mantel' },
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
      { id: 0, name: "Granny's", location: 'displayed:lounge_mantel' },
    ]);
    expect(errors).toEqual([]);
  });

  test("a version-3 save's tree on the shed pedestal loads on the lounge's mantel", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await page.evaluate((text) => {
      localStorage.setItem('bonsai.save.1', text);
    }, v3SaveOnShedMain());
    await toTitle(page);
    await continueGame(page);
    await page.waitForFunction(
      () => window.__bonsai?.ready === true && window.__bonsai.scene === 'world',
    );
    const h = await hook(page);
    expect(h.room).toBe('shed');
    expect(h.treeLocations).toEqual([
      { id: 0, name: "Granny's", location: 'displayed:lounge_mantel' },
    ]);
    // Drawn on the lounge's pedestal: it offers the tree itself.
    await shedToLounge(page);
    await toLoungePedestal(page, 1);
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.panel === 'tree:0');
    expect(errors).toEqual([]);
  });
});
