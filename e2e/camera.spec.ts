import type { Page } from '@playwright/test';
import {
  bootWorld,
  collectErrors,
  expect,
  holdUntilAtLeast,
  hook,
  interact,
  openSettingsFromMenu,
  tapControl,
  test,
  walkTo,
} from './drive';

// The world camera (src/world/worldCamera.ts, pinned in its unit tests): 2x on
// a phone-sized viewport, following the player inside the room's drawn
// extent; 1x on a desktop, where it still follows a room taller than the
// view. The view's top-left is in room units. Shed extent (80, 48) 320x176,
// garden (0, 0) 464x512; at 2x the view is 240x135, so the shed's scroll
// stays in x 80..160, y 48..89 and the garden's in x 0..224, y 0..377; at 1x
// the view is 480x270, so the shed's is still and the garden's stays at x 0
// and in y 0..242.
const SHED = { x0: 80, x1: 160, y0: 48, y1: 89 };
const GARDEN = { x0: 0, x1: 224, y0: 0, y1: 377 };
const GARDEN_DESKTOP = { x0: 0, x1: 0, y0: 0, y1: 242 };

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
    // The landing spot (80, 274), below the shed: against the left edge, centred on its row.
    expect(await camera(page)).toEqual({ zoom: 2, scrollX: GARDEN.x0, scrollY: 206.5 });
    await record(page);

    // Right along the row to the east fence, up the notch and the passage to the north
    // fence, down the east side of the lawn to the south fence, and left along it.
    await walkUntilScroll(page, 'ArrowRight', 'scrollX', GARDEN.x1);
    await holdUntilAtLeast(page, 'ArrowRight', 'x', 440);
    await walkUntilScroll(page, 'ArrowUp', 'scrollY', GARDEN.y0);
    await walkUntilScroll(page, 'ArrowDown', 'scrollY', GARDEN.y1);
    await walkUntilScroll(page, 'ArrowLeft', 'scrollX', GARDEN.x0);

    const seen = await recorded(page);
    inside(seen, GARDEN);
    expect(new Set(seen.map((c) => c.scrollX)).size).toBeGreaterThan(10);
    expect(new Set(seen.map((c) => c.scrollY)).size).toBeGreaterThan(10);
    expect(errors).toEqual([]);
  });
});

test.describe('world camera on a desktop', () => {
  test.skip(({ viewport }) => phone(viewport), 'desktop viewports only');

  test('stays at 1x: still in the shed, following the garden only up and down', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    const still = { zoom: 1, scrollX: 0, scrollY: 0 };
    expect(await camera(page)).toEqual(still);
    await record(page);
    await walkTo(page, 200, 'left', 'door');
    expect(await camera(page)).toEqual(still);
    expect(new Set((await recorded(page)).map((c) => JSON.stringify(c)))).toEqual(
      new Set([JSON.stringify(still)]),
    );

    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.room === 'garden');
    // The landing (80, 274) centres the 270 px view on its row; the 464 px garden fits across.
    expect(await camera(page)).toEqual({ zoom: 1, scrollX: 0, scrollY: 139 });
    await record(page);
    // Down to the south fence, right along it past the greenhouse to the east fence, then up
    // the lawn's east side, the notch and the passage to the north fence.
    await walkUntilScroll(page, 'ArrowDown', 'scrollY', GARDEN_DESKTOP.y1);
    await holdUntilAtLeast(page, 'ArrowDown', 'y', 480);
    await holdUntilAtLeast(page, 'ArrowRight', 'x', 440);
    await walkUntilScroll(page, 'ArrowUp', 'scrollY', GARDEN_DESKTOP.y0);
    const seen = await recorded(page);
    inside(seen, GARDEN_DESKTOP);
    expect(seen.every((c) => c.zoom === 1)).toBe(true);
    expect(new Set(seen.map((c) => c.scrollY)).size).toBeGreaterThan(10);
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
