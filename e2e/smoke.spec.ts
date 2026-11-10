import { expect, startNewGame, test } from './drive';

test.describe('boot', () => {
  test('loads, renders a canvas, and reports ready with no page errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await expect(page).toHaveTitle('Bonsai Greenhouse');
    await expect(page.locator('#game canvas')).toBeVisible();

    // Boot hands over to the title; New Game starts a new game in the world.
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');
    // Boot loads the pixel font before the title draws, so no text is drawn in the fallback first.
    expect(await page.evaluate(() => window.__bonsai?.fontLoaded)).toBe(true);
    await startNewGame(page);
    await page.waitForFunction(() => window.__bonsai?.scene === 'world');
    const hook = await page.evaluate(() => window.__bonsai);
    expect(hook?.ready).toBe(true);
    expect(hook?.season).toBe('spring');
    expect(hook?.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(hook?.fontLoaded).toBe(true);
    // New Game runs a real new game through the simulation bundle.
    expect(hook?.day).toBe(0);
    expect(hook?.trees).toBe(1);
    expect(Number.isInteger(hook?.starterScore)).toBe(true);
    expect(hook?.starterScore).toBeGreaterThan(0);
    expect(hook?.starterScore).toBeLessThanOrEqual(100);

    expect(errors).toEqual([]);
  });

  test('is installable: serves a web manifest and registers a service worker', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();
    const manifest = await request.get(manifestHref ?? '');
    expect(manifest.ok()).toBe(true);
    const body = (await manifest.json()) as { name?: string; icons?: unknown[] };
    expect(body.name).toBe('Bonsai Greenhouse');
    expect(body.icons?.length).toBeGreaterThan(0);

    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
      timeout: 15_000,
    });
  });
});
