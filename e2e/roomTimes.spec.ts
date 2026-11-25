import { bootWorld, expect, openMenu, skipTutorial, tapControl, test } from './drive';

// The menu's Room times row (3D world on only): a panel of the latest room-change times.

const ON = JSON.stringify({ fullscreen: false, weather: false, world3d: true });

test.describe('the room-time readout', () => {
  test.use({ reducedMotion: 'reduce' });

  test('opens from the menu, lists the shed and closes', async ({ page }) => {
    await page.addInitScript((settings) => {
      localStorage.setItem('bonsai.settings', settings);
    }, ON);
    await bootWorld(page);
    await page.waitForFunction(() => window.__bonsai?.world3d?.floorSheet != null, undefined, {
      timeout: 60_000,
    });
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
    // The rooms behind the shed's doors build one a frame once the player stands still; on CI's
    // software GL a menu tap made during those builds can wait out the test.
    await page.waitForFunction(() => window.__bonsai?.world3d?.aheadPending === 0, undefined, {
      timeout: 60_000,
    });

    await openMenu(page);
    await tapControl(page, 'menu-times');
    await page.waitForFunction(() => window.__bonsai?.panel === '');

    const panel = page.locator('#times-panel');
    await expect(panel).toBeVisible();
    await expect(page.locator('#times-text')).toContainText(/shed {2}first {2}\d+ ms/);
    const box = await page.locator('#times-close').boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await page.locator('#times-close').click();
    await expect(panel).toHaveCount(0);
  });
});
