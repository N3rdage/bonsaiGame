import { expect, test, type Page } from '@playwright/test';

// A phone turned from portrait to landscape: the Samsung S22 Ultra at FHD+
// (see playwright.config.ts). Each test sets its own viewport, so it runs the
// same on every project.
const PORTRAIT = { width: 384, height: 824 };
const LANDSCAPE = { width: 824, height: 384 };

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

async function bootWorld(page: Page, url: string): Promise<void> {
  await page.setViewportSize(PORTRAIT);
  await page.goto(url);
  await page.waitForFunction(() => window.__bonsai?.scene === 'title');
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => window.__bonsai?.ready === true && window.__bonsai.scene === 'world',
  );
}

async function canvasBox(page: Page): Promise<{ width: number; height: number }> {
  const box = await page.locator('#game canvas').boundingBox();
  return { width: box?.width ?? 0, height: box?.height ?? 0 };
}

test.describe('orientation change', () => {
  test('refits the world canvas at 16:9 without a reload', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page, '/');
    const portrait = await canvasBox(page);
    expect(portrait.width).toBeCloseTo(PORTRAIT.width, 0);
    expect(portrait.height).toBeCloseTo((PORTRAIT.width * 9) / 16, 0);

    await page.setViewportSize(LANDSCAPE);
    await expect.poll(async () => (await canvasBox(page)).height).toBeCloseTo(LANDSCAPE.height, 0);
    const landscape = await canvasBox(page);
    expect(landscape.width).toBeGreaterThanOrEqual(682);
    expect(landscape.width).toBeLessThanOrEqual(683);
    expect(await page.evaluate(() => window.__bonsai?.scene)).toBe('world');
    expect(errors).toEqual([]);
  });

  test('re-renders the viewer in wire mode for the new viewport', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page, '/?tree=wired');
    await page.keyboard.press('v');
    await page.waitForFunction(
      () => window.__bonsai?.viewer?.open === true && window.__bonsai.viewer.foliageReady,
    );
    const viewRenders = (await page.evaluate(() => window.__bonsai?.viewer?.renders)) ?? 0;
    await page.keyboard.press('w');
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
