import type { Page } from '@playwright/test';
import {
  bootWorld,
  collectErrors,
  expect,
  hook,
  openViewer,
  setMode,
  tapControl,
  test,
  toTitle,
} from './drive';

// A phone turned between portrait and landscape: the Samsung S22 Ultra at FHD+
// (see playwright.config.ts). Each test sets its own viewport, so it runs the
// same on every project that runs it.
const PORTRAIT = { width: 384, height: 824 };
const LANDSCAPE = { width: 824, height: 384 };

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

/** Counts `requestFullscreen` calls instead of entering fullscreen, which headless cannot show. */
async function countFullscreenRequests(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { fullscreenRequests: number };
    w.fullscreenRequests = 0;
    Element.prototype.requestFullscreen = function () {
      w.fullscreenRequests += 1;
      return Promise.resolve();
    };
  });
}

function fullscreenRequests(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { fullscreenRequests: number }).fullscreenRequests,
  );
}

/** Lets the browser draw `n` frames; a running game publishes its hook on each. */
async function frames(page: Page, n: number): Promise<void> {
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let seen = 0;
        const tick = (): void => {
          seen += 1;
          if (seen >= count) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    n,
  );
}

test.describe('desktop window resize', () => {
  // A touch screen this small in portrait is a phone, which gets the rotate prompt instead (below).
  test.skip(({ hasTouch }) => hasTouch, 'desktop windows only');

  test('refits the world canvas at 16:9 without a reload', async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(PORTRAIT);
    await bootWorld(page);
    expect((await hook(page)).rotatePrompt).toBe(false);
    const portrait = await canvasBox(page);
    expect(portrait.width).toBeCloseTo(PORTRAIT.width, 0);
    expect(portrait.height).toBeCloseTo((PORTRAIT.width * 9) / 16, 0);
    // The backing follows the device px of the fitted display (never below
    // 480x270), the camera zoom with it.
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
    await expectBacking(LANDSCAPE);
    expect(await page.evaluate(() => window.__bonsai?.scene)).toBe('world');
    expect(errors).toEqual([]);
  });

  test('re-renders the viewer in wire mode for the new viewport', async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(PORTRAIT);
    await bootWorld(page, '/?tree=wired');
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

  test('a title click asks for no fullscreen', async ({ page }) => {
    await countFullscreenRequests(page);
    await toTitle(page);
    await tapControl(page, 'new');
    await page.waitForFunction(() => window.__bonsai?.scene === 'world');
    expect(await fullscreenRequests(page)).toBe(0);
  });
});

test.describe('phone rotate prompt', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'touch screens only');

  test('covers the game in portrait until the phone is turned', async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(PORTRAIT);
    await page.goto('/');
    const prompt = page.locator('#rotate-prompt');
    await expect(prompt).toBeVisible();
    await expect(prompt).toContainText('Rotate your phone');
    // The game is paused before its title starts, so nothing is published yet.
    await frames(page, 30);
    expect(await page.evaluate(() => window.__bonsai?.scene)).toBeUndefined();

    await page.setViewportSize(LANDSCAPE);
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');
    await expect(prompt).toBeHidden();
    expect((await hook(page)).rotatePrompt).toBe(false);
    expect(errors).toEqual([]);
  });

  test('pauses the world under the prompt and resumes where it was', async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(LANDSCAPE);
    await bootWorld(page);
    await page.setViewportSize(PORTRAIT);
    await page.waitForFunction(() => window.__bonsai?.rotatePrompt === true);
    const paused = await hook(page);
    await frames(page, 30);
    expect((await hook(page)).frames).toBe(paused.frames);

    // Every point is the prompt's, so a tap on the HUD menu button lands on it.
    const covered = await page.evaluate(({ width, height }) => {
      const prompt = document.getElementById('rotate-prompt');
      const points = [0.1, 0.5, 0.9].flatMap((fx) =>
        [0.05, 0.2, 0.5, 0.9].map((fy) => document.elementFromPoint(width * fx, height * fy)),
      );
      return points.every((el) => prompt?.contains(el) === true);
    }, PORTRAIT);
    expect(covered).toBe(true);
    await tapControl(page, 'menu');

    await page.setViewportSize(LANDSCAPE);
    await page.waitForFunction(
      (f) => window.__bonsai?.rotatePrompt === false && window.__bonsai.frames > f,
      paused.frames,
    );
    await expect(page.locator('#rotate-prompt')).toBeHidden();
    const resumed = await hook(page);
    expect(resumed.scene).toBe('world');
    expect(resumed.room).toBe(paused.room);
    expect(resumed.day).toBe(paused.day);
    expect(resumed.panel).toBe('');
    expect(errors).toEqual([]);
  });

  test('leaves a tablet-sized touch screen alone in portrait', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await toTitle(page);
    await expect(page.locator('#rotate-prompt')).toBeHidden();
    expect((await hook(page)).rotatePrompt).toBe(false);
  });

  test('the first title tap asks for fullscreen once', async ({ page }) => {
    await countFullscreenRequests(page);
    await page.setViewportSize(LANDSCAPE);
    await toTitle(page);
    await tapControl(page, 'new');
    await page.waitForFunction(() => window.__bonsai?.scene === 'world');
    expect(await fullscreenRequests(page)).toBe(1);
  });
});
