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
    // Boot loads the UI font before the title draws, so no text is drawn in the fallback first.
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

    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  });

  test('the service worker gives every fixed-name asset a revision', async ({ request }) => {
    // A precache entry without a revision is never fetched again, so it is only safe for a file
    // whose name changes with its content. Sprite sheets and sounds keep their names: without a
    // revision a returning device runs new code over the sheets its first visit cached.
    const worker = await request.get('/sw.js');
    expect(worker.ok()).toBe(true);
    const entries = [
      ...(await worker.text()).matchAll(/\{url:"([^"]+)",revision:(null|"[^"]+")\}/g),
    ];
    expect(entries.length).toBeGreaterThan(50);
    const hashedName = /-[A-Za-z0-9_-]{8}\.[a-z0-9]+(\.map)?$/;
    const stale = entries
      .filter(([, url, revision]) => revision === 'null' && !hashedName.test(url ?? ''))
      .map(([, url]) => url);
    expect(stale).toEqual([]);
    const sprites = entries.filter(([, url]) => url?.includes('assets/spr_'));
    expect(sprites.length).toBeGreaterThan(20);
  });
});
