import type { Page } from '@playwright/test';
import { menuPanel } from '../src/world/menu';
import { cssPerLogical, uiMetrics } from '../src/world/uiScale';
import {
  bootWorld,
  closeViewer,
  collectErrors,
  dragLogical,
  expect,
  hook,
  openMenu,
  openViewer,
  tapControl,
  test,
} from './drive';

// The menu by tap is what these tests test, so it is tapped on every project.

const ids = (h: BonsaiTestHook): string[] => h.controls.map((c) => c.id);
/** The room's controls on a new game: the HUD buttons and the tutorial's Skip. */
const HUD = ['view', 'notebook', 'menu', 'tutorial-skip'];

/** Waits two animation frames, so a key just pressed has reached the scene. */
async function nextFrames(page: Page): Promise<void> {
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

async function saveByMenu(page: Page): Promise<void> {
  await openMenu(page);
  await tapControl(page, 'menu-save');
  await page.waitForFunction(() => window.__bonsai?.toast === 'Saved to slot 1');
}

test.describe('world menu', () => {
  test('opens the panel and saves by tap', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    expect(ids(await hook(page))).toEqual(HUD);
    await openMenu(page);
    expect(ids(await hook(page))).toEqual([
      ...HUD,
      'menu-inventory',
      'menu-sleep',
      'menu-sleep-week',
      'menu-save',
      'menu-load',
      'menu-settings',
      'menu-title',
    ]);

    await tapControl(page, 'menu-save');
    await page.waitForFunction(() => window.__bonsai?.toast === 'Saved to slot 1');
    const h = await hook(page);
    expect(h.slots.map((s) => s.slot)).toEqual([1]);
    expect(h.panel).toBe('');
    expect(ids(h)).toEqual(HUD);
    expect(errors).toEqual([]);
  });

  test('loads the save by tap and restarts the world from it', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await saveByMenu(page);
    // Keyboard movement on every project; the joystick drag is tested in world.spec.ts.
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

  test('Load on an empty slot opens the slot picker and stays in the world', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openMenu(page);
    await tapControl(page, 'menu-load');
    await page.waitForFunction(() => window.__bonsai?.panel === 'slots');
    const h = await hook(page);
    expect(h.scene).toBe('world');
    expect(ids(h)).toEqual(['panel-close']);
    expect(errors).toEqual([]);
  });

  test('Escape and a press outside close the panel without leaving or walking', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openMenu(page);
    // A key test: keydown-ESC closes the panel.
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect((await hook(page)).scene).toBe('world');

    // A press outside the panel closes it and starts no joystick, so the drag
    // that follows (well past the 4 px dead zone) walks nobody.
    await openMenu(page);
    expect((await hook(page)).player.x).toBe(240);
    await dragLogical(page, 240, 135, 60);
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    const h = await hook(page);
    expect(h.scene).toBe('world');
    expect(h.player.x).toBe(240);
    expect(h.player.y).toBe(135);
    expect(errors).toEqual([]);
  });

  test('one Escape closes the panel even when Phaser replays its queue', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openMenu(page);
    // Phaser keeps key events queued until the next frame and replays the queue
    // on every new one. With an older event still queued, Escape's keyup within
    // the same frame replays its keydown, which must not reach the title.
    await page.evaluate(() => {
      const send = (type: string, key: string, code: string, keyCode: number): void => {
        const event = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true });
        Object.defineProperty(event, 'keyCode', { get: () => keyCode });
        window.dispatchEvent(event);
      };
      send('keyup', 'e', 'KeyE', 69);
      send('keydown', 'Escape', 'Escape', 27);
      send('keyup', 'Escape', 'Escape', 27);
    });
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
    const h = await hook(page);
    expect(h.scene).toBe('world');
    expect(h.panel).toBe('');
    expect(errors).toEqual([]);
  });

  test('a press on the panel neither closes it nor walks', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openMenu(page);
    // Inside the panel's background, above its first row (menuPanel() and
    // menuItems() in src/world/menu.ts at this screen's UI metrics: on the
    // desktop the panel starts at y 16, Inventory at 35; on the phone at 28, its
    // first row's tap target at 31).
    const box = await page.locator('#game canvas').boundingBox();
    if (!box) throw new Error('no canvas');
    const ui = uiMetrics(
      cssPerLogical(box.width, box.height),
      test.info().project.use.hasTouch === true,
    );
    const panel = menuPanel(false, ui);
    const x = panel.x + panel.w - 6;
    const y = panel.y + 2;
    await dragLogical(page, x, y, 60);
    const h = await hook(page);
    expect(h.panel).toBe('menu');
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
    expect(ids(h)).toEqual(['new', 'continue', 'load', 'settings']);
    expect(h.panel).toBe('');
    expect(errors).toEqual([]);
  });

  test('Sleep by tap and by Z moves the day and its badge', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    const day = (await hook(page)).day;
    await openMenu(page);
    await tapControl(page, 'menu-sleep');
    await page.waitForFunction((d) => window.__bonsai?.day === d + 1, day);
    let h = await hook(page);
    expect(h.panel).toBe('');
    expect(h.hud).toContain(`Day ${String(day + 1)}  |`);
    expect(h.toast).toBe(`Day ${String(day + 1)}`);

    await page.keyboard.press('z');
    await page.waitForFunction((d) => window.__bonsai?.day === d + 2, day);
    h = await hook(page);
    expect(h.hud).toContain(`Day ${String(day + 2)}  |`);
    expect(h.toast).toBe(`Day ${String(day + 2)}`);
    expect(errors).toEqual([]);
  });

  test('Sleep is not offered and Z does nothing under a modal or the viewer', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    const day = (await hook(page)).day;
    await openMenu(page);
    await tapControl(page, 'menu-inventory');
    await page.waitForFunction(() => window.__bonsai?.panel === 'inventory');
    await page.keyboard.press('z');
    await nextFrames(page);
    let h = await hook(page);
    expect(ids(h)).not.toContain('menu-sleep');
    expect(ids(h)).not.toContain('menu-sleep-week');
    expect(h.day).toBe(day);
    await tapControl(page, 'panel-close');
    await page.waitForFunction(() => window.__bonsai?.panel === '');

    await openViewer(page);
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === true);
    await page.keyboard.press('z');
    await nextFrames(page);
    h = await hook(page);
    expect(ids(h)).not.toContain('menu-sleep');
    expect(h.day).toBe(day);
    expect(errors).toEqual([]);
  });

  test('opening the viewer closes the panel and hides the controls', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openMenu(page);
    await openViewer(page);
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === true);
    let h = await hook(page);
    expect(h.panel).toBe('');
    expect(h.controls).toEqual([]);

    await closeViewer(page);
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
