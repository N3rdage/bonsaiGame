import { expect, test } from '@playwright/test';

test.describe('3D viewer', () => {
  test('opens the 3D viewer on the starter tree and matches the baseline', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
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
    const hook = await page.evaluate(() => window.__bonsai);
    const viewer = hook?.viewer;
    expect(viewer?.yaw).toBe(45);
    expect(viewer?.pitch).toBe(10);
    expect(viewer?.distance).toBe(2.5);
    expect(viewer?.potTier).toBe(0);
    expect(hook?.starterHeightCm).toBeGreaterThan(0);
    // Orbit target: halfway up the trunk, cm -> display units (DISPLAY_SCALE 4).
    expect(viewer?.targetZ).toBeCloseTo(((hook?.starterHeightCm ?? NaN) / 100) * 4 * 0.5);
    await expect(page.locator('#viewer-close')).toBeVisible();

    // e2e/screenshot.css hides the Close button during capture, so the baseline
    // is the WebGL frame alone.
    await expect(page.locator('#viewer')).toHaveScreenshot('viewer-scaffold.png');

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === false);
    await expect(page.locator('#viewer')).toBeHidden();
    await expect(page.locator('#viewer-close')).toBeHidden();

    expect(errors).toEqual([]);
  });
});
