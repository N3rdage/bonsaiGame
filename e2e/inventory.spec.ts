import { bootWorld, collectErrors, expect, hook, openMenu, tapControl, test } from './drive';

// The menu row by tap is the touch route under test, so it is tapped on every project.

const ids = (h: BonsaiTestHook): string[] => h.controls.map((c) => c.id);

/** What the panel should list for `inv`: obj_ui_inventory's labels, zeros hidden. */
function expected(inv: Readonly<Record<string, number>>) {
  const listed = (pairs: [string, string][]) =>
    pairs
      .filter(([key]) => (inv[key] ?? 0) > 0)
      .map(([key, label]) => ({ label, count: inv[key] }));
  return [
    {
      title: 'Resources',
      entries: listed([
        ['clay', 'Clay'],
        ['pot', 'Pots'],
        ['fancy_pot', 'Fancy Pots'],
        ['soil_premium', 'Akadama Mix'],
        ['wire', 'Wire'],
        ['fertilizer', 'Fertilizer'],
      ]),
    },
    {
      title: 'Seeds',
      entries: listed([
        ['seed_juniper', 'Juniper'],
        ['seed_maple', 'Japanese Maple'],
        ['seed_pine', 'Pine'],
      ]),
    },
    {
      title: 'Cuttings',
      entries: listed([
        ['cutting_juniper', 'Juniper'],
        ['cutting_maple', 'Japanese Maple'],
      ]),
    },
  ];
}

test.describe('inventory panel', () => {
  test('opens from the menu by tap with the counts of the inventory, and closes', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openMenu(page);
    await tapControl(page, 'menu-inventory');
    await page.waitForFunction(() => window.__bonsai?.panel === 'inventory');

    const h = await hook(page);
    expect(ids(h)).toEqual(['panel-close']);
    expect(h.inventorySections).toEqual(expected(h.inventory));
    // A new game: no cuttings yet, so that section reads (none).
    expect(h.inventorySections?.[2]?.entries).toEqual([]);
    expect(h.inventorySections?.[0]?.entries.length).toBeGreaterThan(0);

    await tapControl(page, 'panel-close');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect((await hook(page)).inventorySections).toBeUndefined();
    expect(errors).toEqual([]);
  });

  test('I toggles it, and does not open it over another modal panel', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await page.keyboard.press('i');
    await page.waitForFunction(() => window.__bonsai?.panel === 'inventory');
    await page.keyboard.press('i');
    await page.waitForFunction(() => window.__bonsai?.panel === '');

    await page.keyboard.press('j');
    await page.waitForFunction(() => window.__bonsai?.panel === 'notebook');
    await page.keyboard.press('i');
    // A key the scene ignores leaves no event to wait on; a frame's publish settles it.
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }),
    );
    expect((await hook(page)).panel).toBe('notebook');

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect(errors).toEqual([]);
  });
});
