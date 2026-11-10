import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import {
  backToTitle,
  closePanel,
  collectErrors,
  confirmOverwrite,
  continueGame,
  expect,
  hook,
  loadGame,
  openLoadPicker,
  pickSlot,
  saveGame,
  startNewGame,
  tapControl,
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
  money: number;
  trees: { trunk: { height_cm: number } }[];
};

async function toWorld(page: Page, act: Promise<void>): Promise<void> {
  await act;
  await page.waitForFunction(() => window.__bonsai?.scene === 'world');
}

async function save(page: Page, slot: number): Promise<void> {
  await saveGame(page);
  await page.waitForFunction((s) => window.__bonsai?.toast === `Saved to slot ${String(s)}`, slot);
}

/** Two animation frames: time for anything a key press would have done to land. */
async function twoFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
}

test.describe('title', () => {
  // Playwright gives every test a fresh browser context, so localStorage starts
  // empty; clearing it once more keeps the tests independent of that default.
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('saves with F5 and continues the most recent save after a reload', async ({ page }) => {
    const errors = collectErrors(page);
    await toTitle(page);
    let h = await hook(page);
    expect(h.slots).toEqual([]);
    expect(h.activeSlot).toBe(0);
    expect(h.toast).toBe('');

    await toWorld(page, startNewGame(page));
    h = await hook(page);
    expect(h.activeSlot).toBe(1);
    expect(h.day).toBe(0);
    const heightCm = h.starterHeightCm;
    expect(heightCm).toBeGreaterThan(0);

    await save(page, 1);
    h = await hook(page);
    expect(h.scene).toBe('world');
    expect(h.slots).toHaveLength(1);
    expect(h.slots[0]?.slot).toBe(1);
    expect(h.slots[0]?.day).toBe(0);
    expect(h.slots[0]?.money).toBe(100);
    await page.waitForFunction(() => window.__bonsai?.toast === '', undefined, { timeout: 5000 });

    await toTitle(page);
    h = await hook(page);
    expect(h.slots.map((s) => s.slot)).toEqual([1]);
    expect(h.slots[0]?.savedAt).not.toBe('');
    await toWorld(page, continueGame(page));
    h = await hook(page);
    expect(h.activeSlot).toBe(1);
    expect(h.day).toBe(0);
    expect(h.starterHeightCm).toBe(heightCm);

    // A second save in slot 2. Timestamps have minute resolution, so slot 1's
    // is aged to make slot 2 strictly the most recent.
    await page.evaluate(() => {
      const text = localStorage.getItem('bonsai.save.1') ?? '';
      const file = JSON.parse(text) as Record<string, unknown>;
      localStorage.setItem(
        'bonsai.save.1',
        JSON.stringify({ ...file, savedAt: '2000-01-01 00:00' }),
      );
    });
    await toTitle(page);
    await startNewGame(page);
    await page.waitForFunction(() => window.__bonsai?.picker === 'new');
    await toWorld(page, pickSlot(page, 2));
    expect((await hook(page)).activeSlot).toBe(2);
    await save(page, 2);

    await toTitle(page);
    expect((await hook(page)).slots.map((s) => s.slot)).toEqual([1, 2]);
    await toWorld(page, continueGame(page));
    expect((await hook(page)).activeSlot).toBe(2);
    expect(errors).toEqual([]);
  });

  test('continues and loads a prototype save', async ({ page }) => {
    const errors = collectErrors(page);
    await page.evaluate((text) => {
      localStorage.setItem('bonsai.save.2', text);
    }, PROTOTYPE_SAVE);
    await toTitle(page);
    const [slot] = (await hook(page)).slots;
    expect(slot?.slot).toBe(2);
    expect(slot?.day).toBe(PROTOTYPE.game_day);
    expect(slot?.money).toBe(PROTOTYPE.money);
    expect(PROTOTYPE.game_day).toBeGreaterThan(0);

    // Continue really loads: a new game would be day 0 with one 25 cm tree.
    const expectLoaded = (h: BonsaiTestHook): void => {
      expect(h.activeSlot).toBe(2);
      expect(h.day).toBe(PROTOTYPE.game_day);
      expect(h.trees).toBe(PROTOTYPE.trees.length);
      expect(h.starterHeightCm).toBe(PROTOTYPE.trees[0]?.trunk.height_cm);
    };
    await toWorld(page, continueGame(page));
    expectLoaded(await hook(page));

    // So does the load picker.
    await backToTitle(page);
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');
    await openLoadPicker(page);
    await page.waitForFunction(() => window.__bonsai?.picker === 'load');
    await toWorld(page, pickSlot(page, 2));
    expectLoaded(await hook(page));
    expect(errors).toEqual([]);
  });

  test('Escape goes back to the title and New Game asks before overwriting', async ({ page }) => {
    const errors = collectErrors(page);
    await toTitle(page);
    await toWorld(page, startNewGame(page));
    await save(page, 1);
    await backToTitle(page);
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');

    await startNewGame(page);
    await page.waitForFunction(() => window.__bonsai?.picker === 'new');
    await pickSlot(page, 1);
    await page.waitForFunction(() => window.__bonsai?.picker === 'confirm');
    await confirmOverwrite(page, false);
    await page.waitForFunction(() => window.__bonsai?.picker === 'new');
    await toWorld(page, pickSlot(page, 2));
    expect((await hook(page)).activeSlot).toBe(2);

    // F9 on the empty slot 2 opens the in-room picker; closing it keeps the unsaved game.
    await loadGame(page);
    await page.waitForFunction(() => window.__bonsai?.panel === 'slots');
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    let h = await hook(page);
    expect(h.scene).toBe('world');
    expect(h.activeSlot).toBe(2);
    expect(h.panel).toBe('');

    // The load picker ignores the empty slot 2 and loads slot 1.
    await backToTitle(page);
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');
    await openLoadPicker(page);
    await page.waitForFunction(() => window.__bonsai?.picker === 'load');
    // A key test: the empty slot's button is disabled, so it has no control to tap.
    await page.keyboard.press('2');
    await twoFrames(page);
    h = await hook(page);
    expect(h.scene).toBe('title');
    expect(h.picker).toBe('load');
    await toWorld(page, pickSlot(page, 1));
    expect((await hook(page)).activeSlot).toBe(1);
    expect(errors).toEqual([]);
  });

  test('tapping New Game starts the world', async ({ page }) => {
    const errors = collectErrors(page);
    await toTitle(page);
    expect((await hook(page)).controls.map((c) => c.id)).toEqual(['new', 'settings']);
    await tapControl(page, 'new');
    await page.waitForFunction(() => window.__bonsai?.scene === 'world');
    expect((await hook(page)).activeSlot).toBe(1);
    expect(errors).toEqual([]);
  });

  test('shows the build version and opens its commit in a new tab', async ({ page }) => {
    const errors = collectErrors(page);
    // Records window.open instead of opening anything, so the test never navigates.
    await page.addInitScript(() => {
      const calls: unknown[][] = [];
      Object.assign(window, { __opened: calls });
      window.open = (...args: unknown[]): null => {
        calls.push(args);
        return null;
      };
    });
    await toTitle(page);
    const h = await hook(page);
    const at = h.versionLink;
    if (!at) throw new Error('no version link on the title');
    expect(at.text).toMatch(/^v\d{4}\.\d{2}\.\d{2}\.\d+ \([0-9a-f]{7}\)$/);
    expect(at.text).toBe(`v${h.version} (${String(h.commit)})`);

    const box = await page.locator('#game canvas').boundingBox();
    if (!box) throw new Error('no canvas');
    const x = box.x + (at.x * box.width) / 480;
    const y = box.y + (at.y * box.height) / 270;
    if (test.info().project.use.hasTouch) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    await page.waitForFunction(() => (window as { __opened?: unknown[] }).__opened?.length === 1);
    const [call] = await page.evaluate(() => (window as { __opened?: unknown[][] }).__opened ?? []);
    expect(call?.[0]).toMatch(
      new RegExp(
        `^https://github\\.com/N3rdage/bonsaiGame/commit/${String(h.commit)}[0-9a-f]{33}$`,
      ),
    );
    expect(call?.slice(1)).toEqual(['_blank', 'noopener']);
    expect((await hook(page)).scene).toBe('title');
    expect(errors).toEqual([]);
  });

  test('a corrupt slot shows a message and stays on the title', async ({ page }) => {
    const errors = collectErrors(page);
    await page.evaluate(() => {
      localStorage.setItem('bonsai.save.1', 'not json');
    });
    await toTitle(page);
    let h = await hook(page);
    expect(h.toast).toBe('Save slot 1 is unreadable');
    expect(h.slots).toEqual([]);

    // Continue skips unreadable slots, so it has nothing to load and stays put.
    // A key test: the Continue button is disabled, so it has no control to tap.
    await page.keyboard.press('c');
    await twoFrames(page);
    expect((await hook(page)).scene).toBe('title');
    await openLoadPicker(page);
    await page.waitForFunction(() => window.__bonsai?.picker === 'load');
    await pickSlot(page, 1);
    await page.waitForFunction(() => window.__bonsai?.picker === '');
    h = await hook(page);
    expect(h.scene).toBe('title');
    expect(h.toast).toContain('Could not load slot 1');
    expect(errors).toEqual([]);
  });
});
