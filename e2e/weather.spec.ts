import {
  bootWorld,
  closePanel,
  collectErrors,
  expect,
  hook,
  interact,
  openSettingsFromMenu,
  tapControl,
  test,
  walkTo,
} from './drive';

// Per-season garden profiles are unit tests (src/world/weather.test.ts): the
// world has no season override, `?season=` is the viewer's.

test.describe('weather', () => {
  test('dust motes in the shed, spring petals in the garden', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    expect((await hook(page)).weather).toEqual({ kind: 'motes', count: 10 });

    await walkTo(page, 200, 'left', 'door');
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.room === 'garden');
    const h = await hook(page);
    expect(h.season).toBe('spring');
    expect(h.weather).toEqual({ kind: 'petals', count: 28 });
    expect(errors).toEqual([]);
  });

  test('Weather effects in Settings turns it off and on in place', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openSettingsFromMenu(page);

    await tapControl(page, 'panel-weather');
    await page.waitForFunction(() => window.__bonsai?.settings.weather === false);
    let h = await hook(page);
    expect([h.panel, h.weather]).toEqual(['settings', undefined]);

    await tapControl(page, 'panel-weather');
    await page.waitForFunction(() => window.__bonsai?.settings.weather === true);
    h = await hook(page);
    expect([h.panel, h.weather]).toEqual(['settings', { kind: 'motes', count: 10 }]);

    await closePanel(page);
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    expect((await hook(page)).weather).toEqual({ kind: 'motes', count: 10 });
    expect(errors).toEqual([]);
  });
});
