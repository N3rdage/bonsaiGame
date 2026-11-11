import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import {
  bootWorld,
  closePanel,
  collectErrors,
  expect,
  hook,
  interact,
  openLoadPicker,
  openInspector,
  openMenu,
  openSettingsFromMenu,
  tapControl,
  test,
  toTitle,
  walkTo,
} from './drive';

/** A real GameMaker save (version 1), so the title has a slot to show in its picker. */
const PROTOTYPE_SAVE = readFileSync(
  path.join(import.meta.dirname, '../src/sim/__fixtures__/prototype-save-v1-day14.json'),
  'utf8',
);

/**
 * The UI scale rule on screen (src/world/uiScale.ts): every control the hook
 * lists has a tap target at least 44 CSS px square on a touch screen and 24
 * with a mouse, inside the canvas, and no two of one screen overlap.
 */
async function expectTapTargets(page: Page, screen: string): Promise<void> {
  const box = await page.locator('#game canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  const scale = box.width / 480;
  const min = test.info().project.use.hasTouch ? 44 : 24;
  const { controls } = await hook(page);
  expect(controls.length, screen).toBeGreaterThan(0);
  // Float slack only: 9 logical px at 1280 / 480 is 24 CSS px give or take 1e-12.
  const slack = 1e-6;
  for (const { id, hit } of controls) {
    const at = `${screen}: ${id} ${JSON.stringify(hit)}`;
    expect(hit.w * scale, at).toBeGreaterThanOrEqual(min - slack);
    expect(hit.h * scale, at).toBeGreaterThanOrEqual(min - slack);
    expect(hit.x, at).toBeGreaterThanOrEqual(-slack);
    expect(hit.y, at).toBeGreaterThanOrEqual(-slack);
    expect(hit.x + hit.w, at).toBeLessThanOrEqual(480 + slack);
    expect(hit.y + hit.h, at).toBeLessThanOrEqual(270 + slack);
  }
  controls.forEach((a, i) => {
    for (const b of controls.slice(i + 1)) {
      const overlap =
        a.hit.x < b.hit.x + b.hit.w - slack &&
        b.hit.x < a.hit.x + a.hit.w - slack &&
        a.hit.y < b.hit.y + b.hit.h - slack &&
        b.hit.y < a.hit.y + a.hit.h - slack;
      expect(overlap, `${screen}: ${a.id} overlaps ${b.id}`).toBe(false);
    }
  });
}

test.describe('tap targets', () => {
  test('on the title: the menu and the slot picker', async ({ page }) => {
    const errors = collectErrors(page);
    await toTitle(page);
    await page.evaluate((text) => {
      localStorage.clear();
      localStorage.setItem('bonsai.save.2', text);
    }, PROTOTYPE_SAVE);
    await toTitle(page);
    expect((await hook(page)).controls.map((c) => c.id)).toEqual([
      'new',
      'continue',
      'load',
      'settings',
    ]);
    await expectTapTargets(page, 'title menu');
    await openLoadPicker(page);
    await page.waitForFunction(() => window.__bonsai?.picker === 'load');
    expect((await hook(page)).controls.map((c) => c.id)).toEqual(['slot-2', 'cancel']);
    await expectTapTargets(page, 'slot picker');
    expect(errors).toEqual([]);
  });

  test('in the world: the HUD with the tutorial box, the menu, Settings and the shop', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await page.waitForFunction(() => window.__bonsai?.tutorialLabel !== '');
    expect((await hook(page)).controls.map((c) => c.id)).toContain('tutorial-skip');
    await expectTapTargets(page, 'HUD');

    await openMenu(page);
    expect((await hook(page)).controls.map((c) => c.id)).toContain('menu-title');
    await expectTapTargets(page, 'menu');
    await tapControl(page, 'menu');
    await page.waitForFunction(() => window.__bonsai?.panel === '');

    await openSettingsFromMenu(page);
    await expectTapTargets(page, 'Settings');
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');

    // Next to the kiosk, Interact joins the HUD beside the tutorial box's Skip.
    await walkTo(page, 145, 'left', 'shop_kiosk');
    expect((await hook(page)).controls.map((c) => c.id)).toContain('interact');
    await expectTapTargets(page, 'HUD in reach of the kiosk');
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.panel === 'shop');
    expect((await hook(page)).controls.filter((c) => c.id.startsWith('panel-buy-'))).toHaveLength(
      6,
    );
    await expectTapTargets(page, 'shop');
    expect(errors).toEqual([]);
  });

  test("in the shed: the starter's inspector, both button rows and Close", async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await walkTo(page, 160, 'left', 'tree:0');
    await openInspector(page);
    // A new game's starter: every button but Repot (on cooldown) is a control.
    expect((await hook(page)).controls.map((c) => c.id)).toEqual([
      'panel-water',
      'panel-fertilise',
      'panel-skip',
      'panel-pickup',
      'panel-view',
      'panel-rename',
      'panel-style',
      'panel-sell',
      'panel-close',
    ]);
    await expectTapTargets(page, 'inspector');
    expect(errors).toEqual([]);
  });
});
