import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import {
  bootWorld,
  closePanel,
  collectErrors,
  dragLogical,
  expect,
  hook,
  interact,
  loadGame,
  pickPanelSlot,
  pickSlot,
  startNewGame,
  test,
  toTitle,
} from './drive';

/** A real GameMaker save (version 1) from the importer's fixtures, written as-is. */
const PROTOTYPE_SAVE = readFileSync(
  path.join(import.meta.dirname, '../src/sim/__fixtures__/prototype-save-v1-day14.json'),
  'utf8',
);
const PROTOTYPE = JSON.parse(PROTOTYPE_SAVE.replace(/\0+$/, '')) as {
  game_day: number;
  trees: { trunk: { height_cm: number } }[];
};

const ids = (h: BonsaiTestHook): string[] => h.controls.map((c) => c.id);

async function frames(page: Page, n: number): Promise<void> {
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let i = 0;
        const tick = (): void => {
          i += 1;
          if (i >= count) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    n,
  );
}

/**
 * Walks from the start (240, 135) up to the workbench's row (y 90), then left
 * past the planting table until the workbench (125, 90) is the prop in range.
 */
async function walkToWorkbench(page: Page): Promise<void> {
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => (window.__bonsai?.player.y ?? 999) <= 91);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => window.__bonsai?.near === 'workbench');
  await page.keyboard.up('ArrowLeft');
}

async function openWorkbench(page: Page): Promise<void> {
  await walkToWorkbench(page);
  await interact(page);
  await page.waitForFunction(() => window.__bonsai?.panel === 'placeholder:workbench');
}

test.describe('interactables and panels', () => {
  test('the workbench prompts, opens a modal that blocks movement, and closes', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    let h = await hook(page);
    expect(h.near).toBe('');
    expect(ids(h)).toEqual(['view', 'notebook', 'menu', 'tutorial-skip']);

    await walkToWorkbench(page);
    h = await hook(page);
    expect(ids(h)).toEqual(['view', 'notebook', 'menu', 'interact', 'tutorial-skip']);

    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.panel === 'placeholder:workbench');
    h = await hook(page);
    expect(ids(h)).toEqual(['panel-close']);
    const { x, y } = h.player;
    await page.keyboard.down('ArrowRight');
    await frames(page, 10);
    await page.keyboard.up('ArrowRight');
    h = await hook(page);
    expect(h.player.x).toBe(x);
    expect(h.player.y).toBe(y);

    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    h = await hook(page);
    expect(ids(h)).toEqual(['view', 'notebook', 'menu', 'interact', 'tutorial-skip']);
    expect(errors).toEqual([]);
  });

  test('Load with nothing saved opens an empty picker; Close keeps the game', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    const before = await hook(page);
    await loadGame(page);
    await page.waitForFunction(() => window.__bonsai?.panel === 'slots');
    expect(ids(await hook(page))).toEqual(['panel-close']);

    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    const h = await hook(page);
    expect(h.scene).toBe('world');
    expect(h.activeSlot).toBe(1);
    expect(h.day).toBe(0);
    expect(h.player).toEqual(before.player);
    expect(errors).toEqual([]);
  });

  test('Load on an empty slot 2 picks slot 1 from the in-room picker and loads it', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    // Slot 1 holds a real prototype save (day 14, several trees), so a loaded
    // game cannot be mistaken for the new day-0 game in slot 2.
    await page.goto('/');
    await page.evaluate((text) => {
      localStorage.setItem('bonsai.save.1', text);
    }, PROTOTYPE_SAVE);
    await toTitle(page);
    await startNewGame(page);
    await page.waitForFunction(() => window.__bonsai?.picker === 'new');
    await pickSlot(page, 2);
    await page.waitForFunction(() => window.__bonsai?.scene === 'world');
    let h = await hook(page);
    expect(h.activeSlot).toBe(2);
    expect(h.day).toBe(0);
    expect(h.trees).toBe(1);

    await loadGame(page);
    await page.waitForFunction(() => window.__bonsai?.panel === 'slots');
    expect(ids(await hook(page))).toEqual(['panel-slot-1', 'panel-close']);
    await pickPanelSlot(page, 1);
    await page.waitForFunction(() => window.__bonsai?.activeSlot === 1);
    h = await hook(page);
    expect(h.scene).toBe('world');
    expect(h.panel).toBe('');
    expect(h.day).toBe(PROTOTYPE.game_day);
    expect(h.trees).toBe(PROTOTYPE.trees.length);
    expect(h.starterHeightCm).toBe(PROTOTYPE.trees[0]?.trunk.height_cm);
    expect(h.hud).toContain(`Day ${String(PROTOTYPE.game_day)}`);
    expect(errors).toEqual([]);
  });

  test('the HUD menu is out of reach and a press outside does nothing while a panel is open', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openWorkbench(page);
    const before = await hook(page);
    expect(ids(before)).not.toContain('menu');
    // A press-and-drag on the dimmed room below the panel: no close, no joystick.
    await dragLogical(page, 240, 250, 60);
    const h = await hook(page);
    expect(h.panel).toBe('placeholder:workbench');
    expect(h.player).toEqual(before.player);
    expect(ids(h)).toEqual(['panel-close']);
    expect(errors).toEqual([]);
  });
});
