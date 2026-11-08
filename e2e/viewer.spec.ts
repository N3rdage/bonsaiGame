import { expect, test, type Page } from '@playwright/test';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

async function openViewer(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => window.__bonsai?.ready === true);
  expect(await page.evaluate(() => window.__bonsai?.viewer?.open)).toBe(false);

  // The logical 480x270 world is scaled to fit and centred, so a click relative
  // to the canvas box lands on the "View tree (3D)" text at (240, 135 + 48).
  const box = await page.locator('#game canvas').boundingBox();
  expect(box).not.toBeNull();
  await page.locator('#game canvas').click({
    position: { x: (box?.width ?? 0) * 0.5, y: ((box?.height ?? 0) * (135 + 48)) / 270 },
  });

  // The foliage sprite loads asynchronously; once it has, the viewer redraws
  // with it, so screenshots taken after this always show textured leaves.
  await page.waitForFunction(
    () =>
      window.__bonsai?.viewer?.open === true &&
      window.__bonsai.viewer.renders >= 1 &&
      window.__bonsai.viewer.foliageReady,
  );
}

async function closeViewer(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__bonsai?.viewer?.open === false);
  await expect(page.locator('#viewer')).toBeHidden();
  await expect(page.locator('#viewer-close')).toBeHidden();
}

test.describe('3D viewer', () => {
  test('opens the 3D viewer on the starter tree and matches the baseline', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/');
    const hook = await page.evaluate(() => window.__bonsai);
    const viewer = hook?.viewer;
    expect(viewer?.yaw).toBe(45);
    expect(viewer?.pitch).toBe(10);
    expect(viewer?.distance).toBe(2.5);
    expect(viewer?.potTier).toBe(0);
    expect(hook?.starterHeightCm).toBeGreaterThan(0);
    // Orbit target: halfway up the trunk, cm -> display units (DISPLAY_SCALE 4).
    expect(viewer?.targetZ).toBeCloseTo(((hook?.starterHeightCm ?? NaN) / 100) * 4 * 0.5);
    expect(viewer?.revision).toBeGreaterThanOrEqual(0);
    // Starter tree: 688 triangles, pinned in src/viewer/treeMesh.test.ts.
    expect(viewer?.meshVertices).toBe(2064);
    // Day 0 is spring; the starter's foliage is pinned in src/viewer/viewerFixtures.test.ts.
    expect(hook?.season).toBe('spring');
    expect(viewer?.season).toBe('spring');
    expect(viewer?.foliageVertices).toBe(336);
    await expect(page.locator('#viewer-close')).toBeVisible();

    // e2e/screenshot.css hides the Close button during capture, so the baseline
    // is the WebGL frame alone.
    await expect(page.locator('#viewer')).toHaveScreenshot('viewer-scaffold.png');

    await closeViewer(page);
    expect(errors).toEqual([]);
  });

  // Vertex counts are pinned in src/viewer/viewerFixtures.test.ts.
  const fixtures = [
    { key: 'cutting', meshVertices: 912, foliageVertices: 120 },
    { key: 'bent', meshVertices: 2064, foliageVertices: 336 },
    { key: 'cascade', meshVertices: 2304, foliageVertices: 252 },
  ];
  for (const { key, meshVertices, foliageVertices } of fixtures) {
    test(`shows the ${key} fixture tree and matches the baseline`, async ({ page }) => {
      const errors = collectErrors(page);
      await openViewer(page, `/?tree=${key}`);
      const viewer = await page.evaluate(() => window.__bonsai?.viewer);
      expect(viewer?.meshVertices).toBe(meshVertices);
      expect(viewer?.foliageVertices).toBe(foliageVertices);
      await expect(page.locator('#viewer')).toHaveScreenshot(`viewer-${key}.png`);
      await closeViewer(page);
      expect(errors).toEqual([]);
    });
  }

  // `?season=` overrides the game's season in the viewer only.
  const seasons = [
    { url: '/?season=summer', season: 'summer', foliageVertices: 336, shot: 'foliage-summer' },
    {
      url: '/?tree=maple&season=winter',
      season: 'winter',
      foliageVertices: 0,
      shot: 'maple-winter',
    },
    {
      url: '/?tree=maple&season=autumn',
      season: 'autumn',
      foliageVertices: 252,
      shot: 'maple-autumn',
    },
  ];
  for (const { url, season, foliageVertices, shot } of seasons) {
    test(`draws ${shot} foliage and matches the baseline`, async ({ page }) => {
      const errors = collectErrors(page);
      await openViewer(page, url);
      const hook = await page.evaluate(() => window.__bonsai);
      // The game itself is still on day 0 (spring); only the viewer changes season.
      expect(hook?.season).toBe('spring');
      expect(hook?.viewer?.season).toBe(season);
      expect(hook?.viewer?.foliageVertices).toBe(foliageVertices);
      await expect(page.locator('#viewer')).toHaveScreenshot(`viewer-${shot}.png`);
      await closeViewer(page);
      expect(errors).toEqual([]);
    });
  }

  test('ignores an unknown season and falls back to the game season', async ({ page }) => {
    await openViewer(page, '/?season=monsoon');
    expect(await page.evaluate(() => window.__bonsai?.viewer?.season)).toBe('spring');
  });
});
