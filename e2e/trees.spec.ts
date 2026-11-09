import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import {
  bootWorld,
  closePanel,
  collectErrors,
  continueGame,
  expect,
  hook,
  interact,
  loadGame,
  openMenu,
  openViewer,
  pickUpTree,
  placeTree,
  putDownTree,
  saveGame,
  tapControl,
  test,
  toTitle,
  walkTo,
} from './drive';

/** A real prototype save: 'Starter' in the shed, 'Fancy #1' on displayed:shed_window. */
const PROTOTYPE_SAVE = readFileSync(
  path.join(import.meta.dirname, '../src/sim/__fixtures__/prototype-save-v1-day14.json'),
  'utf8',
);

// Floor spot 0 (170, 160); pedestals shed_main (310, 85) and shed_window (350, 85).
const toFloorTree = (page: Page, id: number): Promise<void> =>
  walkTo(page, 160, 'left', `tree:${String(id)}`);
const toMainPedestal = (page: Page): Promise<void> => walkTo(page, 85, 'right', 'pedestal_1');
const toWindowPedestal = (page: Page): Promise<void> => walkTo(page, 85, 'right', 'pedestal_2');

const locations = async (page: Page): Promise<string[]> =>
  (await hook(page)).treeLocations.map((t) => t.location);
const ids = (h: BonsaiTestHook): string[] => h.controls.map((c) => c.id);

async function carryStarterToMainPedestal(page: Page): Promise<void> {
  await toFloorTree(page, 0);
  await pickUpTree(page);
  await toMainPedestal(page);
  await placeTree(page);
}

test.describe('trees in the room', () => {
  test('picks the starter up from the floor and displays it on shed_main', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    let h = await hook(page);
    expect(h.treeLocations).toEqual([{ id: 0, name: "Granny's", location: 'shed' }]);
    expect(h.carrying).toBe('');

    await toFloorTree(page, 0);
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.panel === 'tree:0');
    expect(ids(await hook(page))).toEqual([
      'panel-water',
      'panel-fertilise',
      'panel-skip',
      'panel-pickup',
      'panel-view',
      'panel-close',
    ]);
    await tapControl(page, 'panel-pickup');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    h = await hook(page);
    expect(await locations(page)).toEqual(['inventory']);
    expect(h.carrying).toBe("Granny's");
    // Off the floor: the floor tree is no longer an interactable.
    expect(h.near).not.toBe('tree:0');

    await toMainPedestal(page);
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.panel === 'pedestal:shed_main');
    await tapControl(page, 'panel-place');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    h = await hook(page);
    expect(await locations(page)).toEqual(['displayed:shed_main']);
    expect(h.carrying).toBe('');

    // The pedestal now offers the tree itself.
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.panel === 'tree:0');
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');

    await openViewer(page);
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === true);
    expect(errors).toEqual([]);
  });

  test('an empty pedestal explains itself when nothing is carried', async ({ page }) => {
    await bootWorld(page);
    await toMainPedestal(page);
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.panel === 'pedestal:shed_main');
    expect(ids(await hook(page))).toEqual(['panel-close']);
  });

  test('a second pickup refuses with a toast and moves nothing', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await page.evaluate((text) => {
      localStorage.setItem('bonsai.save.1', text);
    }, PROTOTYPE_SAVE);
    await toTitle(page);
    await continueGame(page);
    await page.waitForFunction(() => window.__bonsai?.scene === 'world');
    const before = (await hook(page)).treeLocations;
    expect(before.map((t) => [t.name, t.location])).toEqual([
      ['Starter', 'shed'],
      ['Fancy #1', 'displayed:shed_window'],
    ]);
    const [floor, shown] = before;
    if (!floor || !shown) throw new Error('fixture trees');

    // The imported tree stands on shed_window: its pedestal offers it.
    await toWindowPedestal(page);
    await interact(page);
    await page.waitForFunction((id) => window.__bonsai?.panel === `tree:${String(id)}`, shown.id);
    expect(ids(await hook(page))).toContain('panel-pickup');
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');

    await toFloorTree(page, floor.id);
    await pickUpTree(page);
    expect(await locations(page)).toEqual(['inventory', 'displayed:shed_window']);

    await toWindowPedestal(page);
    await pickUpTree(page);
    const h = await hook(page);
    expect(h.toast).toBe('Already carrying Starter');
    expect(h.carrying).toBe('Starter');
    expect(await locations(page)).toEqual(['inventory', 'displayed:shed_window']);
    expect(errors).toEqual([]);
  });

  test('a displayed tree survives save and reload', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await carryStarterToMainPedestal(page);
    await saveGame(page);
    await page.waitForFunction(() => window.__bonsai?.toast === 'Saved to slot 1');

    // Take it off again, unsaved; loading the slot puts it back.
    await pickUpTree(page);
    expect(await locations(page)).toEqual(['inventory']);
    await loadGame(page);
    await page.waitForFunction(() => window.__bonsai?.carrying === '');
    expect(await locations(page)).toEqual(['displayed:shed_main']);

    // And across a page reload, through Continue.
    await page.reload();
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');
    await continueGame(page);
    await page.waitForFunction(() => window.__bonsai?.scene === 'world');
    expect(await locations(page)).toEqual(['displayed:shed_main']);
    expect((await hook(page)).carrying).toBe('');
    // Drawn on the pedestal, not the floor: no floor tree to reach, the pedestal offers it.
    await toMainPedestal(page);
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.panel === 'tree:0');
    expect(errors).toEqual([]);
  });

  test('Put down in the menu returns the carried tree to the floor', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openMenu(page);
    expect(ids(await hook(page))).not.toContain('menu-putdown');
    await tapControl(page, 'menu');
    await page.waitForFunction(() => window.__bonsai?.panel === '');

    await toFloorTree(page, 0);
    await pickUpTree(page);
    expect((await hook(page)).carrying).toBe("Granny's");
    await putDownTree(page);
    const h = await hook(page);
    expect(await locations(page)).toEqual(['shed']);
    expect(h.carrying).toBe('');
    // Back on floor spot 0, in reach again.
    await page.waitForFunction(() => window.__bonsai?.near === 'tree:0');
    expect(errors).toEqual([]);
  });
});
