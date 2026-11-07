import { expect, test } from '@playwright/test';

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

    await page.waitForFunction(() => window.__bonsai?.ready === true);
    const hook = await page.evaluate(() => window.__bonsai);
    expect(hook?.scene).toBe('boot');
    expect(hook?.season).toBe('spring');
    expect(hook?.version).toMatch(/^\d+\.\d+\.\d+/);
    // The boot scene runs a real new game through the simulation bundle.
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
