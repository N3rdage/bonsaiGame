import { bootWorld, expect, hook, openMenu, skipTutorial, tapControl, test } from './drive';

// The menu's Benchmark row (3D world on only): a 2 s warm-up and 12 s of frames along a fixed
// camera path, then a result panel that Close removes and the camera easing back to the rig.

const ON = JSON.stringify({ fullscreen: false, weather: false, world3d: true });
const OFF = JSON.stringify({ fullscreen: false, weather: false, world3d: false });

/** Software GL draws a frame in 150 to 250 ms; the run is 14 s of wall clock either way. */
const RUN_TIMEOUT = 120_000;

test.describe('the benchmark', () => {
  test.use({ reducedMotion: 'reduce' });

  test('has no menu row while the 3D world is off', async ({ page }) => {
    await page.addInitScript((settings) => {
      localStorage.setItem('bonsai.settings', settings);
    }, OFF);
    await bootWorld(page);
    await openMenu(page);
    const ids = (await hook(page)).controls.map((c) => c.id);
    expect(ids).toContain('menu-settings');
    expect(ids).not.toContain('menu-bench');
  });

  test('runs from the menu, shows its result and gives the camera back', async ({ page }) => {
    test.setTimeout(RUN_TIMEOUT * 2);
    await page.addInitScript((settings) => {
      localStorage.setItem('bonsai.settings', settings);
    }, ON);
    await bootWorld(page);
    await page.waitForFunction(() => window.__bonsai?.world3d?.floorSheet != null, undefined, {
      timeout: 60_000,
    });
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);

    await openMenu(page);
    const controls = (await hook(page)).controls;
    const row = controls.find((c) => c.id === 'menu-bench');
    expect(row).toBeDefined();
    await tapControl(page, 'menu-bench');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect((await hook(page)).world3d?.bench).toEqual({ running: true, result: null });
    // The camera leaves the rig's distance (9 m) for the path while it runs.
    await page.waitForFunction(
      () => {
        const world = window.__bonsai?.world3d;
        return world?.bench.running === true && Math.abs(world.camera.radius - 9) > 1;
      },
      undefined,
      { timeout: RUN_TIMEOUT, polling: 50 },
    );

    await page.waitForFunction(() => window.__bonsai?.world3d?.bench.result != null, undefined, {
      timeout: RUN_TIMEOUT,
    });
    const bench = (await hook(page)).world3d?.bench;
    expect(bench?.running).toBe(false);
    expect(bench?.result?.frames).toBeGreaterThan(0);
    expect(bench?.result?.fps).toBeGreaterThan(0);
    expect(bench?.result?.width).toBeGreaterThan(0);
    expect(bench?.result?.room).toBe('shed');
    expect(bench?.result?.userAgent).toBe(await page.evaluate(() => navigator.userAgent));

    const panel = page.locator('#bench-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('fps');
    await expect(panel).toContainText(`${String(bench?.result?.frames)} frames`);
    const close = page.locator('#bench-close');
    const box = await close.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await close.click();
    await expect(panel).toHaveCount(0);

    await page.waitForFunction(
      () => {
        const cam = window.__bonsai?.world3d?.camera;
        return (
          cam !== undefined && Math.abs(cam.radius - 9) < 0.5 && Math.abs(cam.alpha + 1.57) < 0.1
        );
      },
      undefined,
      { timeout: 60_000 },
    );
  });
});
