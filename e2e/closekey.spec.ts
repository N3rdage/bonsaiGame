import type { Page } from '@playwright/test';
import {
  bootWorld,
  collectErrors,
  expect,
  hook,
  inspectorAction,
  openInspector,
  openMenu,
  openNotebook,
  openViewer,
  openSettingsFromMenu,
  test,
  tapControl,
  walkTo,
} from './drive';

// Q closes what Escape closes, in and out of fullscreen. A headless browser
// cannot enter real fullscreen, so the fullscreen state is faked: the page
// reads `document.fullscreenElement` and the `fullscreenchange` event, which
// the faking sets and dispatches exactly as the browser does.

type Lock = 'absent' | 'refused' | 'granted';

async function fakeFullscreen(page: Page, on: boolean, lock: Lock = 'absent'): Promise<void> {
  await page.evaluate(
    ([isOn, lockMode]) => {
      const keyboard =
        lockMode === 'absent'
          ? undefined
          : {
              lock: () =>
                lockMode === 'granted' ? Promise.resolve() : Promise.reject(new Error('refused')),
              unlock: () => undefined,
            };
      Object.defineProperty(navigator, 'keyboard', { configurable: true, value: keyboard });
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => (isOn ? document.documentElement : null),
      });
      document.dispatchEvent(new Event('fullscreenchange'));
      // Lets the lock's promise settle before the test opens a panel.
      return new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });
    },
    [on, lock] as const,
  );
}

const panelIs = (page: Page, key: string) =>
  page.waitForFunction((k) => window.__bonsai?.panel === k, key);

async function inspectStarter(page: Page): Promise<void> {
  await walkTo(page, 160, 'left', 'tree:0');
  await openInspector(page);
}

test.describe('Q closes what Escape closes', () => {
  test('the inspector, its sub-panel, the notebook, the inventory and the menu', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await inspectStarter(page);
    await page.keyboard.press('q');
    await panelIs(page, '');

    await openInspector(page);
    await inspectorAction(page, 'style');
    await page.waitForFunction(() => window.__bonsai?.panel.startsWith('style:') === true);
    await page.keyboard.press('q');
    await panelIs(page, '');

    await openNotebook(page);
    await page.keyboard.press('q');
    await panelIs(page, '');

    await page.keyboard.press('i');
    await panelIs(page, 'inventory');
    await page.keyboard.press('q');
    await panelIs(page, '');

    await openMenu(page);
    await page.keyboard.press('q');
    await panelIs(page, '');
    expect((await hook(page)).scene).toBe('world');

    await openSettingsFromMenu(page);
    await page.keyboard.press('Q');
    await panelIs(page, '');
    expect(errors).toEqual([]);
  });

  test('Q with nothing open stays in the room, where Escape goes to the title', async ({
    page,
  }) => {
    await bootWorld(page);
    await page.keyboard.press('q');
    await page.keyboard.press('q');
    expect((await hook(page)).scene).toBe('world');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');
  });

  test('the 3D viewer', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openViewer(page);
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === true);
    await page.keyboard.press('q');
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === false);
    const h = await hook(page);
    expect(h.paused).toBe(false);
    expect(h.scene).toBe('world');
    expect(h.panel).toBe('');
    expect(errors).toEqual([]);
  });

  test('a typed q in the rename box is text and closes nothing', async ({ page }) => {
    await bootWorld(page);
    await inspectStarter(page);
    await inspectorAction(page, 'rename');
    await page.waitForFunction(() => window.__bonsai?.panel.startsWith('rename:') === true);
    await page.fill('#rename-input', '');
    await page.keyboard.type('quiet');
    expect(await page.inputValue('#rename-input')).toBe('quiet');
    expect((await hook(page)).panel).toMatch(/^rename:/);
    await page.keyboard.press('Escape');
    await panelIs(page, '');
  });

  test("the title's Settings panel", async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');
    await page.keyboard.press('s');
    await panelIs(page, 'settings');
    await page.keyboard.press('q');
    await panelIs(page, '');
  });
});

test.describe('close labels follow the fullscreen state', () => {
  test('name Esc windowed, Q in fullscreen, and Esc again with the lock granted', async ({
    page,
    tapRoute,
  }) => {
    test.skip(tapRoute, 'a touch device names no key (the next test)');
    await bootWorld(page);
    await inspectStarter(page);
    expect((await hook(page)).closeLabel).toBe('[ESC] Close');
    await page.keyboard.press('q');
    await panelIs(page, '');

    await fakeFullscreen(page, true, 'refused');
    await openNotebook(page);
    expect((await hook(page)).closeLabel).toBe('Close (Q)');
    await page.keyboard.press('q');
    await panelIs(page, '');
    await openInspector(page);
    expect((await hook(page)).closeLabel).toBe('[Q] Close');
    await page.keyboard.press('q');
    await panelIs(page, '');

    await fakeFullscreen(page, true, 'granted');
    await openNotebook(page);
    expect((await hook(page)).closeLabel).toBe('Close (Esc)');
    await page.keyboard.press('Escape');
    await panelIs(page, '');

    await fakeFullscreen(page, true, 'absent');
    await openNotebook(page);
    expect((await hook(page)).closeLabel).toBe('Close (Q)');
    await page.keyboard.press('q');
    await panelIs(page, '');

    await fakeFullscreen(page, false);
    await openNotebook(page);
    expect((await hook(page)).closeLabel).toBe('Close (Esc)');
  });

  test('a touch device names no key, windowed or in fullscreen', async ({ page, tapRoute }) => {
    test.skip(!tapRoute, 'a keyboard names its close key (the tests around this one)');
    await bootWorld(page);
    await inspectStarter(page);
    expect((await hook(page)).closeLabel).toBe('Close');
    await tapControl(page, 'panel-close');
    await panelIs(page, '');

    await fakeFullscreen(page, true, 'absent');
    await openNotebook(page);
    expect((await hook(page)).closeLabel).toBe('Close');
    await tapControl(page, 'panel-close');
    await panelIs(page, '');

    await fakeFullscreen(page, true, 'granted');
    await openNotebook(page);
    expect((await hook(page)).closeLabel).toBe('Close');
  });

  test('the Settings panel redraws its Close when fullscreen changes under it', async ({
    page,
    tapRoute,
  }) => {
    test.skip(tapRoute, 'a touch device names no key (the test above)');
    await bootWorld(page);
    await openSettingsFromMenu(page);
    expect((await hook(page)).closeLabel).toBe('Close (Esc)');
    await fakeFullscreen(page, true, 'absent');
    await page.waitForFunction(() => window.__bonsai?.closeLabel === 'Close (Q)');
    await tapControl(page, 'panel-close');
    await panelIs(page, '');
  });

  test('the rename panel never names Q, which is a letter there', async ({ page }) => {
    await bootWorld(page);
    await fakeFullscreen(page, true, 'absent');
    await inspectStarter(page);
    await inspectorAction(page, 'rename');
    await page.waitForFunction(() => window.__bonsai?.panel.startsWith('rename:') === true);
    expect((await hook(page)).closeLabel).toBe('Close');
  });
});
