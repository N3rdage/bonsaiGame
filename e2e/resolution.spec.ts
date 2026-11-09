import type { Page } from '@playwright/test';
import { bootWorld, collectErrors, expect, hook, test, toTitle } from './drive';

// The canvas backing is sized to the device px of its fitted display and the
// scene camera is zoomed to fill it with the logical 480x270 world
// (src/world/resolution.ts), so text renders at native resolution.

interface Canvas {
  /** Backing size in device px. */
  width: number;
  height: number;
  /** Displayed size in CSS px. */
  cssWidth: number;
  cssHeight: number;
  dpr: number;
}

async function canvas(page: Page): Promise<Canvas> {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('#game canvas');
    if (!c) throw new Error('no canvas');
    const box = c.getBoundingClientRect();
    return {
      width: c.width,
      height: c.height,
      cssWidth: box.width,
      cssHeight: box.height,
      dpr: window.devicePixelRatio,
    };
  });
}

/** The backing covers the displayed box in device px, and the hook's zoom fills it. */
async function expectFitted(page: Page): Promise<Canvas> {
  const c = await canvas(page);
  expect(Math.abs(c.width - c.cssWidth * c.dpr)).toBeLessThanOrEqual(1);
  expect(Math.abs(c.height - c.cssHeight * c.dpr)).toBeLessThanOrEqual(1);
  expect((await hook(page)).zoom).toBeCloseTo(c.width / 480, 6);
  return c;
}

/** A 16:9 window of `width` x `height` CSS px: the backing is that times the device pixel ratio. */
async function expectWindow(page: Page, width: number, height: number): Promise<number> {
  await page.setViewportSize({ width, height });
  await bootWorld(page);
  const c = await expectFitted(page);
  expect(c.width).toBe(Math.round(width * c.dpr));
  expect(c.height).toBe(Math.round(height * c.dpr));
  return c.dpr;
}

test.describe('resolution', () => {
  test('the title already renders at the fitted zoom', async ({ page }) => {
    const errors = collectErrors(page);
    await toTitle(page);
    const c = await expectFitted(page);
    expect((await hook(page)).zoom).toBeGreaterThan(1);
    expect(c.width).toBeGreaterThan(480);
    expect(errors).toEqual([]);
  });

  test('the world canvas backing matches its display in device px', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await expectFitted(page);
    expect(errors).toEqual([]);
  });

  test('a 1920x1080 window renders 4 device px per logical px at a ratio of 1', async ({
    page,
  }) => {
    const dpr = await expectWindow(page, 1920, 1080);
    expect((await hook(page)).zoom).toBeCloseTo(4 * dpr, 2);
  });

  test('a 1280x720 window renders 8/3 device px per logical px at a ratio of 1', async ({
    page,
  }) => {
    const dpr = await expectWindow(page, 1280, 720);
    expect((await hook(page)).zoom).toBeCloseTo((8 / 3) * dpr, 2);
  });
});
