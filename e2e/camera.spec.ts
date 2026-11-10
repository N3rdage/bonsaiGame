import type { Page } from '@playwright/test';
import {
  bootWorld,
  collectErrors,
  expect,
  hook,
  interact,
  openSettingsFromMenu,
  tapControl,
  test,
  walkTo,
} from './drive';

// The world camera (src/world/worldCamera.ts, pinned in its unit tests): 2x on
// a phone-sized viewport, following the player inside the room's drawn
// extent; 1x and still on a desktop. The view's top-left is in room units.
// Shed extent (80, 48) 320x176, garden (0, 0) 480x270; at 2x the view is
// 240x135, so the shed's scroll stays in x 80..160, y 48..89 and the
// garden's in x 0..240, y 0..135.
const SHED = { x0: 80, x1: 160, y0: 48, y1: 89 };
const GARDEN = { x0: 0, x1: 240, y0: 0, y1: 135 };

type Camera = NonNullable<BonsaiTestHook['camera']>;

async function camera(page: Page): Promise<Camera> {
  const c = (await hook(page)).camera;
  if (!c) throw new Error('no camera on the hook');
  return c;
}

/** Holds an arrow key until the camera's `axis` scroll reaches `value`. */
async function walkUntilScroll(
  page: Page,
  key: string,
  axis: 'scrollX' | 'scrollY',
  value: number,
): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForFunction(([a, v]) => window.__bonsai?.camera?.[a] === v, [
    axis,
    value,
  ] as const);
  await page.keyboard.up(key);
}

/** Records the camera of every animation frame from now on, read back by `recorded`. */
async function record(page: Page): Promise<void> {
  await page.evaluate(() => {
    const seen: unknown[] = [];
    Object.assign(window, { __cameraSeen: seen });
    const tick = (): void => {
      seen.push(window.__bonsai?.camera);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function recorded(page: Page): Promise<Camera[]> {
  return page.evaluate(() => (window as unknown as { __cameraSeen: Camera[] }).__cameraSeen);
}

function inside(seen: readonly Camera[], box: typeof SHED): void {
  expect(seen.length).toBeGreaterThan(0);
  for (const c of seen) {
    expect(c.scrollX).toBeGreaterThanOrEqual(box.x0);
    expect(c.scrollX).toBeLessThanOrEqual(box.x1);
    expect(c.scrollY).toBeGreaterThanOrEqual(box.y0);
    expect(c.scrollY).toBeLessThanOrEqual(box.y1);
  }
}

const phone = (viewport: { width: number; height: number } | null): boolean =>
  viewport !== null && Math.min(viewport.width, viewport.height) < 500;

test.describe('world camera on a phone', () => {
  test.skip(({ viewport }) => !phone(viewport), 'phone-sized viewports only');

  test('zooms 2x, follows the player and stays inside the shed', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    expect(await camera(page)).toEqual({ zoom: 2, scrollX: 120, scrollY: 67.5 });
    // The HUD camera keeps the device scale (824x384 at 2.8125 fits 4 device px per logical px).
    expect((await hook(page)).zoom).toBe(4);
    await record(page);

    await walkUntilScroll(page, 'ArrowLeft', 'scrollX', SHED.x0);
    await walkUntilScroll(page, 'ArrowUp', 'scrollY', SHED.y0);
    await walkUntilScroll(page, 'ArrowRight', 'scrollX', SHED.x1);
    await walkUntilScroll(page, 'ArrowDown', 'scrollY', SHED.y1);
    // Pressed against the bottom wall and the right one, the view stays put.
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('ArrowDown');
    const f = (await hook(page)).frames;
    await page.waitForFunction((n) => (window.__bonsai?.frames ?? 0) >= n + 60, f);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('ArrowDown');
    expect(await camera(page)).toEqual({ zoom: 2, scrollX: SHED.x1, scrollY: SHED.y1 });

    const seen = await recorded(page);
    inside(seen, SHED);
    // It followed: the scroll took many values on the way, not just the corners.
    expect(new Set(seen.map((c) => c.scrollX)).size).toBeGreaterThan(10);
    expect(new Set(seen.map((c) => c.scrollY)).size).toBeGreaterThan(10);
    expect(errors).toEqual([]);
  });

  test('follows the player inside the garden', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await walkTo(page, 200, 'left', 'door');
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.room === 'garden');
    // The landing spot (50, 225) is in the bottom-left corner.
    expect(await camera(page)).toEqual({ zoom: 2, scrollX: GARDEN.x0, scrollY: GARDEN.y1 });
    await record(page);

    await walkUntilScroll(page, 'ArrowUp', 'scrollY', GARDEN.y0);
    await walkUntilScroll(page, 'ArrowRight', 'scrollX', GARDEN.x1);
    await walkUntilScroll(page, 'ArrowDown', 'scrollY', GARDEN.y1);

    const seen = await recorded(page);
    inside(seen, GARDEN);
    expect(new Set(seen.map((c) => c.scrollX)).size).toBeGreaterThan(10);
    expect(errors).toEqual([]);
  });
});

test.describe('world camera on a desktop', () => {
  test.skip(({ viewport }) => phone(viewport), 'desktop viewports only');

  test('stays at 1x with the whole room in view in both rooms', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    const still = { zoom: 1, scrollX: 0, scrollY: 0 };
    expect(await camera(page)).toEqual(still);
    await record(page);
    await walkTo(page, 200, 'left', 'door');
    expect(await camera(page)).toEqual(still);
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.room === 'garden');
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(() => (window.__bonsai?.player.y ?? 225) < 150);
    await page.keyboard.up('ArrowUp');
    expect(await camera(page)).toEqual(still);
    expect(new Set((await recorded(page)).map((c) => JSON.stringify(c)))).toEqual(
      new Set([JSON.stringify(still)]),
    );
    expect(errors).toEqual([]);
  });
});

test.describe('world camera screenshot', () => {
  test('a new game in the shed with the tutorial box open', async ({ page }) => {
    await bootWorld(page);
    // The shed's dust motes land somewhere new every run, more changed pixels
    // than the screenshot cap (playwright.config.ts) allows, so the capture
    // turns weather off in Settings first.
    await openSettingsFromMenu(page);
    await tapControl(page, 'panel-weather');
    await page.waitForFunction(() => window.__bonsai?.settings.weather === false);
    await tapControl(page, 'panel-close');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect((await hook(page)).weather).toBeUndefined();
    await page.waitForFunction(() => window.__bonsai?.tutorialLabel !== '');
    await expect(page).toHaveScreenshot('shed-start.png');
  });
});
