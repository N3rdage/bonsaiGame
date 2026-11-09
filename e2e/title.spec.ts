import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { tapControl } from './controls';

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

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

async function hook(page: Page): Promise<BonsaiTestHook> {
  const h = await page.evaluate(() => window.__bonsai);
  if (!h) throw new Error('hook missing');
  return h;
}

async function toTitle(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => window.__bonsai?.scene === 'title');
}

async function toWorld(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForFunction(() => window.__bonsai?.scene === 'world');
}

async function saveWithF5(page: Page, slot: number): Promise<void> {
  await page.keyboard.press('F5');
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

    await toWorld(page, 'Enter');
    h = await hook(page);
    expect(h.activeSlot).toBe(1);
    expect(h.day).toBe(0);
    const heightCm = h.starterHeightCm;
    expect(heightCm).toBeGreaterThan(0);

    await saveWithF5(page, 1);
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
    await toWorld(page, 'c');
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
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__bonsai?.picker === 'new');
    await toWorld(page, '2');
    expect((await hook(page)).activeSlot).toBe(2);
    await saveWithF5(page, 2);

    await toTitle(page);
    expect((await hook(page)).slots.map((s) => s.slot)).toEqual([1, 2]);
    await toWorld(page, 'c');
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
    await toWorld(page, 'c');
    expectLoaded(await hook(page));

    // So does the load picker.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');
    await page.keyboard.press('l');
    await page.waitForFunction(() => window.__bonsai?.picker === 'load');
    await toWorld(page, '2');
    expectLoaded(await hook(page));
    expect(errors).toEqual([]);
  });

  test('Escape goes back to the title and New Game asks before overwriting', async ({ page }) => {
    const errors = collectErrors(page);
    await toTitle(page);
    await toWorld(page, 'Enter');
    await saveWithF5(page, 1);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');

    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__bonsai?.picker === 'new');
    await page.keyboard.press('1');
    await page.waitForFunction(() => window.__bonsai?.picker === 'confirm');
    await page.keyboard.press('n');
    await page.waitForFunction(() => window.__bonsai?.picker === 'new');
    await toWorld(page, '2');
    expect((await hook(page)).activeSlot).toBe(2);

    // F9 on the empty slot 2 keeps the unsaved game and says why.
    await page.keyboard.press('F9');
    await page.waitForFunction(() => window.__bonsai?.toast === 'Slot 2 is empty');
    let h = await hook(page);
    expect(h.scene).toBe('world');
    expect(h.activeSlot).toBe(2);

    // The load picker ignores the empty slot 2 and loads slot 1.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');
    await page.keyboard.press('l');
    await page.waitForFunction(() => window.__bonsai?.picker === 'load');
    await page.keyboard.press('2');
    await twoFrames(page);
    h = await hook(page);
    expect(h.scene).toBe('title');
    expect(h.picker).toBe('load');
    await toWorld(page, '1');
    expect((await hook(page)).activeSlot).toBe(1);
    expect(errors).toEqual([]);
  });

  test('tapping New Game starts the world', async ({ page }) => {
    const errors = collectErrors(page);
    await toTitle(page);
    expect((await hook(page)).controls.map((c) => c.id)).toEqual(['new']);
    await tapControl(page, 'new');
    await page.waitForFunction(() => window.__bonsai?.scene === 'world');
    expect((await hook(page)).activeSlot).toBe(1);
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
    await page.keyboard.press('c');
    await twoFrames(page);
    expect((await hook(page)).scene).toBe('title');
    await page.keyboard.press('l');
    await page.waitForFunction(() => window.__bonsai?.picker === 'load');
    await page.keyboard.press('1');
    await page.waitForFunction(() => window.__bonsai?.picker === '');
    h = await hook(page);
    expect(h.scene).toBe('title');
    expect(h.toast).toContain('Could not load slot 1');
    expect(errors).toEqual([]);
  });
});
