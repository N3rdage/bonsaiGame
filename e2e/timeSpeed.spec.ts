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

test.describe('time speed', () => {
  test('the HUD shows the phase and the Settings speed control cycles 1x, 2x, 4x', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    let h = await hook(page);
    expect([h.phase, h.timeSpeed, h.timeLine]).toEqual(['dawn', 1, 'Dawn']);
    expect(h.timeOfDay).toBeGreaterThanOrEqual(0);
    expect(h.timeOfDay).toBeLessThan(1);

    await openSettingsFromMenu(page);
    for (const speed of [2, 4, 1]) {
      await tapControl(page, 'panel-timespeed');
      await page.waitForFunction((s) => window.__bonsai?.timeSpeed === s, speed);
      h = await hook(page);
      expect(h.settings.timeSpeed).toBe(speed);
      expect(h.panel).toBe('settings');
    }

    await tapControl(page, 'panel-timespeed');
    await page.waitForFunction(() => window.__bonsai?.timeLine === 'Dawn  2x');
    await closePanel(page);
    expect(errors).toEqual([]);
  });
});
