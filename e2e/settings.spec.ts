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

/** Headless Chromium offers the Fullscreen API; no test enters fullscreen. */
const PANEL_CONTROLS = [
  'panel-fullscreen',
  'panel-weather',
  'panel-sound',
  'panel-music',
  'panel-close',
];

type Switch = 'weather' | 'sound' | 'music';

/** Taps the `key` row and waits for the stored flag to become `to`; the panel stays open. */
async function toggle(page: Page, key: Switch, to: boolean): Promise<void> {
  await tapControl(page, `panel-${key}`);
  await page.waitForFunction(([k, v]) => window.__bonsai?.settings[k] === v, [key, to] as const);
  expect((await hook(page)).panel).toBe('settings');
}

/** The settings text the game stored in localStorage, parsed. */
async function stored(page: Page): Promise<unknown> {
  const text = await page.evaluate(() => localStorage.getItem('bonsai.settings'));
  return text === null ? null : JSON.parse(text);
}

test.describe('settings', () => {
  test('the title turns Weather effects off and it survives a reload', async ({ page }) => {
    const errors = collectErrors(page);
    await toTitle(page);
    expect((await hook(page)).settings).toEqual({
      fullscreen: false,
      weather: true,
      sound: true,
      music: true,
    });
    await openSettingsFromTitle(page);
    let h = await hook(page);
    expect(h.picker).toBe('');
    expect(ids(h)).toEqual(PANEL_CONTROLS);

    await toggle(page, 'weather', false);
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect(ids(await hook(page))).toContain('settings');

    await page.reload();
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');
    h = await hook(page);
    expect(h.settings).toEqual({ fullscreen: false, weather: false, sound: true, music: true });
    expect(errors).toEqual([]);
  });

  test("the HUD menu's Settings row opens the same panel as a modal", async ({ page }) => {
    const errors = collectErrors(page);
    await toTitle(page);
    await openSettingsFromTitle(page);
    await toggle(page, 'weather', false);
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');

    await bootWorld(page);
    const before = (await hook(page)).player;
    expect((await hook(page)).settings.weather).toBe(false);
    await openSettingsFromMenu(page);
    expect(ids(await hook(page))).toEqual(PANEL_CONTROLS);

    await toggle(page, 'weather', true);
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    const h = await hook(page);
    expect(h.settings.weather).toBe(true);
    expect(h.player).toEqual(before);
    expect(errors).toEqual([]);
  });

  test('the title turns Sound off and it survives a reload', async ({ page }) => {
    const errors = collectErrors(page);
    await toTitle(page);
    await openSettingsFromTitle(page);
    expect(ids(await hook(page))).toEqual(PANEL_CONTROLS);

    await toggle(page, 'sound', false);
    expect((await hook(page)).settings).toEqual({
      fullscreen: false,
      weather: true,
      sound: false,
      music: true,
    });
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');

    await page.reload();
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');
    expect((await hook(page)).settings.sound).toBe(false);
    expect(await stored(page)).toEqual({
      fullscreen: false,
      weather: true,
      sound: false,
      music: true,
    });
    await openSettingsFromTitle(page);
    const h = await hook(page);
    expect(ids(h)).toEqual(PANEL_CONTROLS);
    expect([h.settings.sound, h.settings.music]).toEqual([false, true]);
    expect(errors).toEqual([]);
  });

  test("the world's menu turns Music off and it survives a reload", async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openSettingsFromMenu(page);
    expect(ids(await hook(page))).toEqual(PANEL_CONTROLS);

    await toggle(page, 'music', false);
    expect((await hook(page)).settings).toEqual({
      fullscreen: false,
      weather: true,
      sound: true,
      music: false,
    });
    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');

    await page.reload();
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');
    expect((await hook(page)).settings.music).toBe(false);
    expect(await stored(page)).toEqual({
      fullscreen: false,
      weather: true,
      sound: true,
      music: false,
    });
    await openSettingsFromTitle(page);
    const h = await hook(page);
    expect(ids(h)).toEqual(PANEL_CONTROLS);
    expect([h.settings.sound, h.settings.music]).toEqual([true, false]);
    expect(errors).toEqual([]);
  });
});
