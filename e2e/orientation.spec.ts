import type { Page } from '@playwright/test';
import { bootWorld, collectErrors, expect, openViewer, setMode, test } from './drive';

// A phone turned from portrait to landscape: the Samsung S22 Ultra at FHD+
// (see playwright.config.ts). Each test sets its own viewport, so it runs the
// same on every project.
const PORTRAIT = { width: 384, height: 824 };
const LANDSCAPE = { width: 824, height: 384 };

async function bootPortrait(page: Page, url: string): Promise<void> {
  await page.setViewportSize(PORTRAIT);
  await bootWorld(page, url);
}

async function canvasBox(page: Page): Promise<{ width: number; height: number }> {
  const box = await page.locator('#game canvas').boundingBox();
  return { width: box?.width ?? 0, height: box?.height ?? 0 };
}

/** The canvas backing in device px and the zoom the world's camera reports. */
async function backing(page: Page): Promise<{ width: number; height: number; zoom: number }> {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('#game canvas');
    return { width: c?.width ?? 0, height: c?.height ?? 0, zoom: window.__bonsai?.zoom ?? 0 };
  });
}

test.describe('orientation change', () => {
  test('refits the world canvas at 16:9 without a reload', async ({ page }) => {
    const errors = collectErrors(page);
    await bootPortrait(page, '/');
    const portrait = await canvasBox(page);
    expect(portrait.width).toBeCloseTo(PORTRAIT.width, 0);
    expect(portrait.height).toBeCloseTo((PORTRAIT.width * 9) / 16, 0);
    // The backing follows the device px of the fitted display (never below
    // 480x270), the camera zoom with it: 1080x608 at 2.25 on the S22 Ultra.
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    const expectBacking = async (view: { width: number; height: number }): Promise<void> => {
      const scale = Math.max(1, Math.min((view.width * dpr) / 480, (view.height * dpr) / 270));
      const width = Math.round(480 * scale);
      const height = Math.round(270 * scale);
      await expect.poll(() => backing(page)).toEqual({ width, height, zoom: width / 480 });
    };
    await expectBacking(PORTRAIT);

    await page.setViewportSize(LANDSCAPE);
    await expect.poll(async () => (await canvasBox(page)).height).toBeCloseTo(LANDSCAPE.height, 0);
    const landscape = await canvasBox(page);
    expect(landscape.width).toBeGreaterThanOrEqual(682);
    expect(landscape.width).toBeLessThanOrEqual(683);
    // 1920x1080 at 4 on the S22 Ultra; the resize this sets off settles there.
    await expectBacking(LANDSCAPE);
    expect(await page.evaluate(() => window.__bonsai?.scene)).toBe('world');
    expect(errors).toEqual([]);
  });

  test('re-renders the viewer in wire mode for the new viewport', async ({ page }) => {
    const errors = collectErrors(page);
    await bootPortrait(page, '/?tree=wired');
    await openViewer(page);
    await page.waitForFunction(
      () => window.__bonsai?.viewer?.open === true && window.__bonsai.viewer.foliageReady,
    );
    const viewRenders = (await page.evaluate(() => window.__bonsai?.viewer?.renders)) ?? 0;
    await setMode(page, 'wire');
    await page.waitForFunction(
      (r) => window.__bonsai?.viewer?.mode === 'wire' && window.__bonsai.viewer.renders > r,
      viewRenders,
    );
    const renders = (await page.evaluate(() => window.__bonsai?.viewer?.renders)) ?? 0;

    await page.setViewportSize(LANDSCAPE);
    await page.waitForFunction((r) => (window.__bonsai?.viewer?.renders ?? 0) > r, renders);

    // The renderer's pixel ratio is min(devicePixelRatio, 2).
    const ratio = await page.evaluate(() => Math.min(window.devicePixelRatio, 2));
    const canvas = page.locator('#viewer');
    await expect(canvas).toHaveAttribute('width', String(Math.floor(LANDSCAPE.width * ratio)));
    await expect(canvas).toHaveAttribute('height', String(Math.floor(LANDSCAPE.height * ratio)));

    const hotspots = (await page.evaluate(() => window.__bonsai?.viewer?.hotspots)) ?? [];
    expect(hotspots).toHaveLength(8);
    for (const h of hotspots) {
      expect(h.x).toBeGreaterThan(0);
      expect(h.x).toBeLessThan(LANDSCAPE.width);
      expect(h.y).toBeGreaterThan(0);
      expect(h.y).toBeLessThan(LANDSCAPE.height);
    }

    // The wire sub-row stays on one line at 824 px wide (SUBROW_ONE_LINE_WIDTH in
    // src/viewer/toolbar.ts), so the toolbar keeps its 110 px wire-mode height.
    const toolbar = await page.locator('#viewer-toolbar').boundingBox();
    expect(toolbar?.height).toBe(110);
    expect(errors).toEqual([]);
  });
});
