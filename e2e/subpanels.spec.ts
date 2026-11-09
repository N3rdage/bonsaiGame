import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import {
  bootWorld,
  closePanel,
  collectErrors,
  continueGame,
  expect,
  fillRename,
  hook,
  inspectorAction,
  openInspector,
  tapControl,
  test,
  toTitle,
  walkTo,
} from './drive';

const ids = (h: BonsaiTestHook): string[] => h.controls.map((c) => c.id);

/**
 * The day-14 prototype save moved to day 120 (spring of year 2, 120 days
 * after the never-repotted trees' day 0) with the floor tree's vigor at 31, so
 * a repot is allowed and its reset to 50 shows. 2 standard pots, no fancy
 * pot, no akadama.
 */
function repotSave(): string {
  const text = readFileSync(
    path.join(import.meta.dirname, '../src/sim/__fixtures__/prototype-save-v1-day14.json'),
    'utf8',
  );
  expect(text).toContain('"game_day":14.0');
  expect(text).toContain('"name":"Starter"');
  return text
    .replace('"game_day":14.0', '"game_day":120.0')
    .replace('"vigor":50.0', '"vigor":31.0');
}

async function continueSave(page: Page, text: string): Promise<void> {
  await page.goto('/');
  await page.evaluate((save) => {
    localStorage.setItem('bonsai.save.1', save);
  }, text);
  await toTitle(page);
  await continueGame(page);
  await page.waitForFunction(() => window.__bonsai?.scene === 'world');
}

/** A new game, the starter's inspector open. */
async function inspectStarter(page: Page): Promise<void> {
  await bootWorld(page);
  await walkTo(page, 160, 'left', 'tree:0');
  await openInspector(page);
}

async function reopenInspector(page: Page): Promise<BonsaiTestHook> {
  await openInspector(page);
  return hook(page);
}

test.describe('tree inspector sub-panels', () => {
  test('repots in spring into a standard pot: one pot used, vigor back to 50', async ({ page }) => {
    const errors = collectErrors(page);
    await continueSave(page, repotSave());
    let h = await hook(page);
    const starter = h.treeLocations.find((t) => t.name === 'Starter');
    if (!starter) throw new Error('no Starter');
    expect([h.day, h.season, starter.location]).toEqual([120, 'spring', 'shed']);
    await walkTo(page, 160, 'left', `tree:${String(starter.id)}`);
    h = await reopenInspector(page);
    expect(h.inspected?.vigor).toBe(31);
    expect(h.inventory.pot).toBe(2);

    await inspectorAction(page, 'repot');
    await page.waitForFunction((k) => window.__bonsai?.panel === k, `repot:${String(starter.id)}`);
    h = await hook(page);
    expect(ids(h)).toEqual(['panel-repot-standard', 'panel-close']);

    await tapControl(page, 'panel-repot-standard');
    await page.waitForFunction(() => window.__bonsai?.inventory.pot === 1);
    h = await hook(page);
    expect(h.panel).toBe('');
    expect(h.toast).toBe('Repotted into a standard pot');

    h = await reopenInspector(page);
    expect(h.inspected?.vigor).toBe(50);
    expect(h.inspected?.potTier).toBe(0);
    expect(h.inspected?.soilTier).toBe(0);
    // Repotted today: on cooldown again, so Repot is greyed.
    expect(ids(h)).not.toContain('panel-repot');
    expect(errors).toEqual([]);
  });

  test('offers no Repot on a new game, the starter on cooldown', async ({ page }) => {
    await inspectStarter(page);
    const h = await hook(page);
    expect(h.inventory.pot).toBe(2);
    expect(ids(h)).toEqual(expect.arrayContaining(['panel-rename', 'panel-style', 'panel-sell']));
    expect(ids(h)).not.toContain('panel-repot');
  });

  test('renames the tree, clamps to 20 characters, and Cancel keeps the name', async ({ page }) => {
    const errors = collectErrors(page);
    await inspectStarter(page);
    let h = await hook(page);
    expect(h.inspected?.name).toBe("Granny's");
    const player = h.player;

    await inspectorAction(page, 'rename');
    await page.waitForFunction(() => window.__bonsai?.panel === 'rename:0');
    await expect(page.locator('#rename-input')).toHaveValue("Granny's");
    // Typing the room's keys into the input does nothing to the game.
    await page.locator('#rename-input').pressSequentially('ewasdv123');
    h = await hook(page);
    expect([h.panel, h.viewer?.open, h.activeSlot]).toEqual(['rename:0', false, 1]);
    expect(h.player).toEqual(player);

    await fillRename(page, 'Kaede');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    h = await hook(page);
    expect(h.treeLocations[0]?.name).toBe('Kaede');
    expect(h.toast).toBe('Renamed to Kaede');
    await expect(page.locator('#rename-input')).toHaveCount(0);
    h = await reopenInspector(page);
    expect(h.inspected?.name).toBe('Kaede');

    await inspectorAction(page, 'rename');
    await page.waitForFunction(() => window.__bonsai?.panel === 'rename:0');
    await page.locator('#rename-input').evaluate((el) => {
      // Past the input's maxlength, as a paste could be: the sim clamps it.
      (el as HTMLInputElement).value = 'abcdefghijklmnopqrstuvwxy';
    });
    await tapControl(page, 'panel-rename-save');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect((await hook(page)).treeLocations[0]?.name).toBe('abcdefghijklmnopqrst');

    await openInspector(page);
    await inspectorAction(page, 'rename');
    await page.waitForFunction(() => window.__bonsai?.panel === 'rename:0');
    await page.fill('#rename-input', 'Discarded');
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    await expect(page.locator('#rename-input')).toHaveCount(0);
    h = await hook(page);
    expect(h.treeLocations[0]?.name).toBe('abcdefghijklmnopqrst');
    expect(h.scene).toBe('world');
    expect(errors).toEqual([]);
  });

  test('sets a target style that changes the score, then clears it', async ({ page }) => {
    const errors = collectErrors(page);
    await inspectStarter(page);
    let h = await hook(page);
    const before = h.inspected?.score;
    expect(h.inspected?.targetStyle).toBe('');

    await inspectorAction(page, 'style');
    await page.waitForFunction(() => window.__bonsai?.panel === 'style:0');
    await tapControl(page, 'panel-style-cascade');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect((await hook(page)).toast).toBe('Style: Cascade (Kengai)');
    h = await reopenInspector(page);
    expect(h.inspected?.targetStyle).toBe('cascade');
    expect(h.inspected?.score).not.toBe(before);

    await inspectorAction(page, 'style');
    await page.waitForFunction(() => window.__bonsai?.panel === 'style:0');
    await tapControl(page, 'panel-style-none');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect((await hook(page)).toast).toBe('Style cleared');
    h = await reopenInspector(page);
    expect(h.inspected?.targetStyle).toBe('');
    expect(h.inspected?.score).toBe(before);
    expect(errors).toEqual([]);
  });

  test('sells the tree: money added, location sold, gone from the room', async ({ page }) => {
    const errors = collectErrors(page);
    await inspectStarter(page);
    let h = await hook(page);
    expect(h.money).toBe(100);
    const score = h.inspected?.score ?? NaN;
    expect(score).toBeGreaterThan(0);

    await inspectorAction(page, 'sell');
    await page.waitForFunction(() => window.__bonsai?.panel === 'sell:0');
    await tapControl(page, 'panel-sell');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    h = await hook(page);
    expect(h.money).toBe(100 + 2 * score);
    expect(h.treeLocations[0]?.location).toBe('sold');
    expect(h.carrying).toBe('');
    expect(h.near).not.toBe('tree:0');
    expect(h.toast).toBe(`Sold Granny's for ${String(2 * score)} coins`);
    expect(errors).toEqual([]);
  });
});
