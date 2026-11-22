import {
  bootWorld,
  closePanel,
  closeViewer,
  collectErrors,
  continueGame,
  expect,
  hook,
  inspectorAction,
  interact,
  openInspector,
  openShop,
  pickUpTree,
  placeTree,
  pressHotspot,
  saveGame,
  setMode,
  tapControl,
  test,
  walkTo,
} from './drive';
import { gardenToShed, shedToLounge, throughDoor, toLoungePedestal } from './rooms';

// Epic #8's acceptance: the whole loop in one flow on the phone profile, walking
// on the arrow keys and taking every action by tap. It runs in the
// `s22-landscape-parity` project only (playwright.config.ts), after the four
// per-step projects; they cover the same actions one step at a time.
// Shed: floor spot 0 (170, 160), workbench (125, 90), planting table
// (165, 90), kiosk (125, 145), door (240, 216) in the bottom wall to the garden
// at (80, 274); garden: juniper (80, 472) straight down from there, door
// (80, 248) in the shed's south face back to (240, 190); the lounge's mantel
// through the shed's top door (rooms.ts).

test.describe('parity', () => {
  test('plays the loop from a new game through save, reload and Continue', async ({ page }) => {
    // A single flow through every room and panel: longer than one step's spec.
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await bootWorld(page);

    // Water Granny's juniper and skip a week (4 fertiliser) in its inspector.
    await walkTo(page, 160, 'left', 'tree:0');
    await openInspector(page);
    await inspectorAction(page, 'water');
    await page.waitForFunction(() => window.__bonsai?.inspected?.waterLevel === 100);
    const young = (await hook(page)).inspected;
    await inspectorAction(page, 'skip');
    await page.waitForFunction(() => window.__bonsai?.inventory.fertilizer === 46);
    let h = await hook(page);
    expect(h.inspected?.ageDays).toBe((young?.ageDays ?? NaN) + 7);
    expect(h.tutorialStep).toBe(2);

    // View it in 3D and wire branch 1.
    await inspectorAction(page, 'view');
    await page.waitForFunction(
      () => window.__bonsai?.viewer?.open === true && window.__bonsai.viewer.renders >= 1,
    );
    await setMode(page, 'wire');
    await page.waitForFunction(
      () => window.__bonsai?.viewer?.mode === 'wire' && window.__bonsai.viewer.hotspots.length > 0,
    );
    await pressHotspot(page, 'branch', 1);
    await page.waitForFunction(() => window.__bonsai?.viewer?.bends[1]?.wired === true);
    expect((await hook(page)).viewer?.wireStock).toBe(9);
    await closeViewer(page);
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === false);
    h = await hook(page);
    expect([h.inventory.wire, h.tutorialStep]).toEqual([9, 3]);

    // Carry it while the shed's work is done; it goes on the lounge's mantel last.
    await pickUpTree(page);
    expect((await hook(page)).carrying).toBe("Granny's");

    // Take a cutting from the garden's juniper.
    await walkTo(page, 200, 'right', 'door');
    await throughDoor(page, 'garden');
    await walkTo(page, 469, 'right', 'source_juniper');
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.inventory.cutting_juniper === 1);
    await gardenToShed(page);

    // Make a pot at the workbench, then plant the cutting at the planting table.
    await walkTo(page, 90, 'left', 'workbench');
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.inventory.pot === 3);
    await walkTo(page, 90, 'right', 'planting_table');
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.panel === 'plant');
    await tapControl(page, 'panel-select-juniper');
    await page.waitForFunction(
      () => window.__bonsai?.controls.some((c) => c.id === 'panel-plant') === true,
    );
    await tapControl(page, 'panel-plant');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    h = await hook(page);
    expect(h.treeLocations).toEqual([
      { id: 0, name: "Granny's", location: 'inventory' },
      { id: 1, name: 'New Juniper', location: 'shed' },
    ]);
    expect([h.inventory.clay, h.inventory.pot, h.inventory.cutting_juniper]).toEqual([4, 2, 0]);
    expect(h.tutorialStep).toBe(-1);

    // Buy fertiliser at the kiosk.
    await openShop(page);
    expect((await hook(page)).money).toBe(100);
    await tapControl(page, 'panel-buy-fertilizer');
    await page.waitForFunction(() => window.__bonsai?.money === 90);
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');

    // Display Granny's juniper on the lounge's mantel.
    await shedToLounge(page);
    await toLoungePedestal(page, 1);
    await placeTree(page);
    const saved = await hook(page);
    expect(saved.treeLocations).toEqual([
      { id: 0, name: "Granny's", location: 'displayed:lounge_mantel' },
      { id: 1, name: 'New Juniper', location: 'shed' },
    ]);
    expect(saved.inventory.fertilizer).toBe(47);

    // Save, reload the page and Continue: the same game comes back.
    await saveGame(page);
    await page.waitForFunction(() => window.__bonsai?.toast === 'Saved to slot 1');
    await page.reload();
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');
    await continueGame(page);
    await page.waitForFunction(
      () => window.__bonsai?.ready === true && window.__bonsai.scene === 'world',
    );
    const loaded = await hook(page);
    expect(loaded.treeLocations).toEqual(saved.treeLocations);
    expect(loaded.inventory).toEqual(saved.inventory);
    expect(loaded.money).toBe(saved.money);
    expect(loaded.day).toBe(saved.day);
    expect(loaded.activeSlot).toBe(1);
    expect(errors).toEqual([]);
  });
});
