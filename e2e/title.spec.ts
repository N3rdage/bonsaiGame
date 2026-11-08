import { expect, test, type Page } from '@playwright/test';

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

test.describe('title', () => {
  // Playwright gives every test a fresh browser context, so localStorage starts
  // empty; clearing it once more keeps the tests independent of that default.
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('saves with F5 and continues the save after a reload', async ({ page }) => {
    const errors = collectErrors(page);
    await toTitle(page);
    let h = await hook(page);
    expect(h.slots).toEqual([]);
    expect(h.activeSlot).toBe(0);
    expect(h.toast).toBe('');

    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__bonsai?.scene === 'world');
    h = await hook(page);
    expect(h.activeSlot).toBe(1);
    expect(h.day).toBe(0);
    const heightCm = h.starterHeightCm;
    expect(heightCm).toBeGreaterThan(0);

    await page.keyboard.press('F5');
    await page.waitForFunction(() => window.__bonsai?.toast === 'Saved to slot 1');
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
    await page.keyboard.press('c');
    await page.waitForFunction(() => window.__bonsai?.scene === 'world');
    h = await hook(page);
    expect(h.activeSlot).toBe(1);
    expect(h.day).toBe(0);
    expect(h.starterHeightCm).toBe(heightCm);
    expect(errors).toEqual([]);
  });

  test('Escape goes back to the title and New Game asks before overwriting', async ({ page }) => {
    const errors = collectErrors(page);
    await toTitle(page);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__bonsai?.scene === 'world');
    await page.keyboard.press('F5');
    await page.waitForFunction(() => window.__bonsai?.toast === 'Saved to slot 1');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');

    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__bonsai?.picker === 'new');
    await page.keyboard.press('1');
    await page.waitForFunction(() => window.__bonsai?.picker === 'confirm');
    await page.keyboard.press('n');
    await page.waitForFunction(() => window.__bonsai?.picker === 'new');
    await page.keyboard.press('2');
    await page.waitForFunction(() => window.__bonsai?.scene === 'world');
    expect((await hook(page)).activeSlot).toBe(2);

    // F9 on the empty slot 2 falls back to the title's load picker.
    await page.keyboard.press('F9');
    await page.waitForFunction(() => window.__bonsai?.picker === 'load');
    expect((await hook(page)).toast).toBe('Slot 2 is empty');
    await page.keyboard.press('2');
    expect((await hook(page)).scene).toBe('title');
    await page.keyboard.press('1');
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

    // Continue skips unreadable slots, so it has nothing to load.
    await page.keyboard.press('c');
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
