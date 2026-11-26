import type { Page } from '@playwright/test';
import {
  bootWorld,
  closePanel,
  collectErrors,
  expect,
  hook,
  openSettingsFromMenu,
  tapControl,
  test,
} from './drive';

// The Avatar size setting (backlog 506): the 3D world draws the player at a fraction of full
// size, the Settings panel's row steps it and it is kept across reloads.

const POLL = { timeout: 30_000 };

/** The factor the 3D world draws the player at, once its body has loaded. */
async function avatarScale(page: Page): Promise<number | undefined> {
  await page.waitForFunction(() => window.__bonsai?.world3d?.bodyLoaded === true);
  return (await hook(page)).world3d?.avatarScale;
}

test.describe('avatar size', () => {
  test.use({ reducedMotion: 'reduce' });

  test.beforeEach(async ({ page }) => {
    // Turns the 3D world on for the first load only, so a reload keeps what the game stored.
    await page.addInitScript(() => {
      if (localStorage.getItem('bonsai.settings') === null) {
        localStorage.setItem(
          'bonsai.settings',
          JSON.stringify({ fullscreen: false, weather: false, world3d: true }),
        );
      }
    });
  });

  test('the Settings row steps the drawn size and a reload keeps it', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await bootWorld(page);
    expect(await avatarScale(page)).toBe(0.7);

    await openSettingsFromMenu(page);
    expect((await hook(page)).controls.map((c) => c.id)).toContain('panel-avatarsize');
    await tapControl(page, 'panel-avatarsize');
    await expect.poll(async () => (await hook(page)).world3d?.avatarScale, POLL).toBe(0.8);
    const stored = await page.evaluate(() => localStorage.getItem('bonsai.settings'));
    expect(JSON.parse(stored ?? '{}')).toMatchObject({ avatarScale: 0.8 });
    expect((await hook(page)).panel).toBe('settings');
    await closePanel(page);

    await page.reload();
    await bootWorld(page);
    expect(await avatarScale(page)).toBe(0.8);
    expect(errors).toEqual([]);
  });
});
