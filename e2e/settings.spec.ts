import type { Page } from '@playwright/test';
import {
  bootWorld,
  closePanel,
  collectErrors,
  expect,
  hook,
  openSettingsFromMenu,
  openSettingsFromTitle,
  tapControl,
  test,
  toTitle,
} from './drive';

const ids = (h: BonsaiTestHook): string[] => h.controls.map((c) => c.id);

/** Taps Weather effects and waits for the stored flag to become `to`; the panel stays open. */
async function toggleWeather(page: Page, to: boolean): Promise<void> {
  await tapControl(page, 'panel-weather');
  await page.waitForFunction((w) => window.__bonsai?.settings.weather === w, to);
  expect((await hook(page)).panel).toBe('settings');
}

test.describe('settings', () => {
  test('the title turns Weather effects off and it survives a reload', async ({ page }) => {
    const errors = collectErrors(page);
    await toTitle(page);
    expect((await hook(page)).settings).toEqual({ fullscreen: false, weather: true });
    await openSettingsFromTitle(page);
    let h = await hook(page);
    expect(h.picker).toBe('');
    // Headless Chromium offers the Fullscreen API; no test enters fullscreen.
    expect(ids(h)).toEqual(['panel-fullscreen', 'panel-weather', 'panel-close']);

    await toggleWeather(page, false);
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect(ids(await hook(page))).toContain('settings');

    await page.reload();
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');
    h = await hook(page);
    expect(h.settings).toEqual({ fullscreen: false, weather: false });
    expect(errors).toEqual([]);
  });

  test("the HUD menu's Settings row opens the same panel as a modal", async ({ page }) => {
    const errors = collectErrors(page);
    await toTitle(page);
    await openSettingsFromTitle(page);
    await toggleWeather(page, false);
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');

    await bootWorld(page);
    const before = (await hook(page)).player;
    expect((await hook(page)).settings.weather).toBe(false);
    await openSettingsFromMenu(page);
    expect(ids(await hook(page))).toEqual(['panel-fullscreen', 'panel-weather', 'panel-close']);

    await toggleWeather(page, true);
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    const h = await hook(page);
    expect(h.settings.weather).toBe(true);
    expect(h.player).toEqual(before);
    expect(errors).toEqual([]);
  });
});
