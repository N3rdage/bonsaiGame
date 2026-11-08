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

  await page.waitForFunction(
    () => window.__bonsai?.viewer?.open === true && window.__bonsai.viewer.renders >= 1,
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
    await expect(page.locator('#viewer-close')).toBeVisible();

    // e2e/screenshot.css hides the Close button during capture, so the baseline
    // is the WebGL frame alone.
    await expect(page.locator('#viewer')).toHaveScreenshot('viewer-scaffold.png');

    await closeViewer(page);
    expect(errors).toEqual([]);
  });

  // Vertex counts are pinned in src/viewer/viewerFixtures.test.ts.
  const fixtures = [
    { key: 'cutting', meshVertices: 912 },
    { key: 'bent', meshVertices: 2064 },
    { key: 'cascade', meshVertices: 2304 },
  ];
  for (const { key, meshVertices } of fixtures) {
    test(`shows the ${key} fixture tree and matches the baseline`, async ({ page }) => {
      const errors = collectErrors(page);
      await openViewer(page, `/?tree=${key}`);
      expect(await page.evaluate(() => window.__bonsai?.viewer?.meshVertices)).toBe(meshVertices);
      await expect(page.locator('#viewer')).toHaveScreenshot(`viewer-${key}.png`);
      await closeViewer(page);
      expect(errors).toEqual([]);
    });
  }
});
