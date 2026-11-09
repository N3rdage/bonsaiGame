import { expect, test, type Page } from '@playwright/test';
import { tapControl, tapLogical } from './controls';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

async function bootWorld(page: Page): Promise<void> {
  await page.goto('/');
  // Each test has a fresh browser context, so no saves: Enter starts a new game in slot 1.
  await page.waitForFunction(() => window.__bonsai?.scene === 'title');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__bonsai?.scene === 'world');
}

async function hook(page: Page): Promise<BonsaiTestHook> {
  const h = await page.evaluate(() => window.__bonsai);
  if (!h) throw new Error('hook missing');
  return h;
}

const ids = (h: BonsaiTestHook): string[] => h.controls.map((c) => c.id);

async function openMenu(page: Page): Promise<void> {
  await tapControl(page, 'menu');
  await page.waitForFunction(() => window.__bonsai?.panel === 'menu');
}

async function saveByMenu(page: Page): Promise<void> {
  await openMenu(page);
  await tapControl(page, 'menu-save');
  await page.waitForFunction(() => window.__bonsai?.toast === 'Saved to slot 1');
}

/** A few animation frames: time for anything a tap would have done to land. */
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

test.describe('world menu', () => {
  test('opens the panel and saves by tap', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    expect(ids(await hook(page))).toEqual(['view', 'menu']);
    await openMenu(page);
    expect(ids(await hook(page))).toEqual(['view', 'menu', 'menu-save', 'menu-load', 'menu-title']);

    await tapControl(page, 'menu-save');
    await page.waitForFunction(() => window.__bonsai?.toast === 'Saved to slot 1');
    const h = await hook(page);
    expect(h.slots.map((s) => s.slot)).toEqual([1]);
    expect(h.panel).toBe('');
    expect(ids(h)).toEqual(['view', 'menu']);
    expect(errors).toEqual([]);
  });

  test('loads the save by tap and restarts the world from it', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await saveByMenu(page);
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => (window.__bonsai?.player.x ?? 0) > 260);
    await page.keyboard.up('ArrowRight');

    await openMenu(page);
    await tapControl(page, 'menu-load');
    await page.waitForFunction(() => window.__bonsai?.player.x === 240);
    const h = await hook(page);
    expect(h.scene).toBe('world');
    expect(h.activeSlot).toBe(1);
    expect(h.panel).toBe('');
    expect(errors).toEqual([]);
  });

  test('Load on an empty slot toasts and stays in the world', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openMenu(page);
    await tapControl(page, 'menu-load');
    await page.waitForFunction(() => window.__bonsai?.toast === 'Slot 1 is empty');
    const h = await hook(page);
    expect(h.scene).toBe('world');
    expect(h.panel).toBe('');
    expect(errors).toEqual([]);
  });

  test('Escape and a tap outside close the panel without leaving or walking', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openMenu(page);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect((await hook(page)).scene).toBe('world');

    await openMenu(page);
    expect((await hook(page)).player.x).toBe(240);
    await tapLogical(page, 240, 135);
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    await frames(page, 10);
    const h = await hook(page);
    expect(h.scene).toBe('world');
    expect(h.player.x).toBe(240);
    expect(h.player.y).toBe(135);
    expect(errors).toEqual([]);
  });

  test('Title by tap goes back to the title, which offers Continue', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await saveByMenu(page);
    await openMenu(page);
    await tapControl(page, 'menu-title');
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');
    const h = await hook(page);
    expect(ids(h)).toEqual(['new', 'continue', 'load']);
    expect(h.panel).toBe('');
    expect(errors).toEqual([]);
  });

  test('opening the viewer closes the panel and hides the controls', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openMenu(page);
    await page.keyboard.press('v');
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === true);
    let h = await hook(page);
    expect(h.panel).toBe('');
    expect(h.controls).toEqual([]);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === false);
    await page.waitForFunction(() =>
      (window.__bonsai?.controls ?? []).some((c) => c.id === 'menu'),
    );
    h = await hook(page);
    expect(h.scene).toBe('world');
    expect(h.panel).toBe('');
    expect(errors).toEqual([]);
  });
});
