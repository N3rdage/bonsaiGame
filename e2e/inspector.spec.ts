import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import {
  bootWorld,
  closeViewer,
  collectErrors,
  continueGame,
  expect,
  hook,
  inspectorAction,
  openInspector,
  openViewer,
  test,
  toTitle,
  walkTo,
} from './drive';

interface FixtureTree {
  name: string;
  vitality: number;
  location: string;
  branches: unknown[];
}

function fixture(name: string): { text: string; trees: FixtureTree[] } {
  const text = readFileSync(
    path.join(import.meta.dirname, '../src/sim/__fixtures__', name),
    'utf8',
  );
  return { text, trees: (JSON.parse(text.replace(/\0+$/, '')) as { trees: FixtureTree[] }).trees };
}

const ids = (h: BonsaiTestHook): string[] => h.controls.map((c) => c.id);
const BUTTONS = ['panel-water', 'panel-fertilise', 'panel-skip', 'panel-pickup', 'panel-view'];

/** Writes a prototype save to slot 1 and continues it. */
async function continueSave(page: Page, text: string): Promise<void> {
  await page.goto('/');
  await page.evaluate((save) => {
    localStorage.setItem('bonsai.save.1', save);
  }, text);
  await toTitle(page);
  await continueGame(page);
  await page.waitForFunction(() => window.__bonsai?.scene === 'world');
}

test.describe('tree inspector', () => {
  test('waters, fertilises and skips a week on the starter', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await walkTo(page, 160, 'left', 'tree:0');
    await openInspector(page);
    let h = await hook(page);
    expect(h.panel).toBe('tree:0');
    expect(h.inspected?.id).toBe(0);
    expect(ids(h)).toEqual([...BUTTONS, 'panel-close']);
    expect(h.inspected?.waterLevel).toBe(50);
    expect(h.tutorialStep).toBe(0);

    await inspectorAction(page, 'water');
    await page.waitForFunction(() => window.__bonsai?.inspected?.waterLevel === 100);
    h = await hook(page);
    expect(h.tutorialStep).toBe(1);
    expect(h.panel).toBe('tree:0');
    expect(h.inventory.fertilizer).toBe(50);

    await inspectorAction(page, 'fertilise');
    await page.waitForFunction(() => window.__bonsai?.inventory.fertilizer === 49);
    h = await hook(page);
    expect(h.inspected?.fertilizedUntilDay).toBe(h.day + 7);
    expect(h.panel).toBe('tree:0');

    const before = h.inspected;
    if (!before) throw new Error('no inspected tree');
    await inspectorAction(page, 'skip');
    await page.waitForFunction(() => window.__bonsai?.inventory.fertilizer === 45);
    h = await hook(page);
    expect(h.inspected?.ageDays).toBe(before.ageDays + 7);
    expect(h.inspected?.revision).toBeGreaterThan(before.revision);
    expect(h.inspected?.heightCm).toBeGreaterThan(before.heightCm);
    expect(h.tutorialStep).toBe(2);
    expect(h.panel).toBe('tree:0');
    expect(ids(h)).toEqual([...BUTTONS, 'panel-close']);
    expect(errors).toEqual([]);
  });

  test('greys Skip below its cost and Fertilise once the fertiliser is gone', async ({ page }) => {
    const errors = collectErrors(page);
    // Day 730, autumn (the juniper still grows), 3 fertiliser: less than Skip's 4.
    const save = fixture('prototype-save-v1-day730.json');
    await continueSave(page, save.text);
    const main = save.trees.findIndex((t) => t.location === 'displayed:shed_main');
    await walkTo(page, 85, 'right', 'pedestal_1');
    await openInspector(page);
    let h = await hook(page);
    expect(h.panel).toBe(`tree:${String(h.treeLocations[main]?.id)}`);
    expect(h.inventory.fertilizer).toBe(3);
    expect(ids(h)).toContain('panel-fertilise');
    expect(ids(h)).not.toContain('panel-skip');

    for (const left of [2, 1, 0]) {
      await inspectorAction(page, 'fertilise');
      await page.waitForFunction((n) => window.__bonsai?.inventory.fertilizer === n, left);
    }
    h = await hook(page);
    expect(h.inspected?.fertilizedUntilDay).toBe(h.day + 7);
    expect(ids(h)).toEqual(['panel-water', 'panel-pickup', 'panel-view', 'panel-close']);
    expect(errors).toEqual([]);
  });

  test('View in 3D shows the inspected tree, View tree the first one', async ({ page }) => {
    const errors = collectErrors(page);
    const save = fixture('prototype-save-v1-day14.json');
    const [first, second] = save.trees;
    if (!first || !second) throw new Error('fixture trees');
    expect(second.location).toBe('displayed:shed_window');
    // The two trees tell apart in the viewer.
    expect(second.vitality).not.toBe(first.vitality);

    await continueSave(page, save.text);
    await walkTo(page, 85, 'right', 'pedestal_2');
    await openInspector(page);
    await inspectorAction(page, 'view');
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === true);
    let h = await hook(page);
    expect(h.viewer?.vitality).toBe(second.vitality);
    expect(h.viewer?.branchCount).toBe(second.branches.length);
    expect(h.panel).toBe('');
    expect(h.inspected).toBeUndefined();

    await closeViewer(page);
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === false);
    await openViewer(page);
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === true);
    h = await hook(page);
    expect(h.viewer?.vitality).toBe(first.vitality);
    expect(h.viewer?.branchCount).toBe(first.branches.length);
    expect(errors).toEqual([]);
  });

  test('Pick up from the inspector carries the tree', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await walkTo(page, 160, 'left', 'tree:0');
    await openInspector(page);
    await inspectorAction(page, 'pickup');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    const h = await hook(page);
    expect(h.carrying).toBe("Granny's");
    expect(h.inspected).toBeUndefined();
    expect(h.treeLocations.map((t) => t.location)).toEqual(['inventory']);
    expect(errors).toEqual([]);
  });
});
