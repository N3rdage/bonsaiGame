import type { Page } from '@playwright/test';
import {
  bootWorld,
  closePanel,
  closeViewer,
  collectErrors,
  expect,
  hook,
  inspectorAction,
  interact,
  openInspector,
  openSettingsFromMenu,
  openSettingsFromTitle,
  openViewer,
  startNewGame,
  tapControl,
  test,
  toTitle,
  walkTo,
} from './drive';

// The hook's `lastSound` is the last key the world's SoundPlayer handed to
// Phaser after the Sound gate. The suite runs headless with no audio device,
// so these tests prove what the game asked to play, never what was heard.

/** Taps the Settings panel's Sound row and waits for the stored switch to become `to`. */
async function setSound(page: Page, to: boolean): Promise<void> {
  await tapControl(page, 'panel-sound');
  await page.waitForFunction((v) => window.__bonsai?.settings.sound === v, to);
}

/**
 * Closes the modal panel and waits for a fixed step after it: the hook lists
 * Interact as soon as the panel is gone, but the button shows again only on
 * the world's next update, and a tap before that hits nothing.
 */
async function closeAndStep(page: Page): Promise<void> {
  await closePanel(page);
  await page.waitForFunction(() => window.__bonsai?.panel === '');
  const frames = (await hook(page)).frames;
  await page.waitForFunction((f) => (window.__bonsai?.frames ?? 0) > f, frames);
}

/** From the shed's start to the starter's inspector. */
async function inspectStarter(page: Page): Promise<void> {
  await walkTo(page, 160, 'left', 'tree:0');
  await openInspector(page);
}

test.describe('sound effects', () => {
  test('Water on the starting tree plays water', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await inspectStarter(page);
    expect((await hook(page)).lastSound).not.toBe('water');

    await inspectorAction(page, 'water');
    await page.waitForFunction(() => window.__bonsai?.inspected?.waterLevel === 100);
    expect((await hook(page)).lastSound).toBe('water');
    expect(errors).toEqual([]);
  });

  test('walking through the shed door plays door', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await walkTo(page, 200, 'left', 'door');
    expect((await hook(page)).lastSound).not.toBe('door');

    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.room === 'garden');
    expect((await hook(page)).lastSound).toBe('door');
    expect(errors).toEqual([]);
  });

  test('with Sound off nothing plays, and switching it on acts without a reload', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    // A fresh page: Sound off on the title's Settings, then a new world, where nothing has played.
    await toTitle(page);
    await openSettingsFromTitle(page);
    await setSound(page, false);
    await tapControl(page, 'panel-close');
    await page.waitForFunction(() => window.__bonsai?.panel === '');
    await startNewGame(page);
    await page.waitForFunction(
      () => window.__bonsai?.ready === true && window.__bonsai.scene === 'world',
    );
    expect((await hook(page)).lastSound).toBe('');
    await inspectStarter(page);
    await inspectorAction(page, 'water');
    await page.waitForFunction(() => window.__bonsai?.inspected?.waterLevel === 100);
    expect((await hook(page)).lastSound).toBe('');

    await closeAndStep(page);
    await openSettingsFromMenu(page);
    expect((await hook(page)).lastSound).toBe('');
    await setSound(page, true);
    await closeAndStep(page);
    await openInspector(page);
    expect((await hook(page)).lastSound).not.toBe('water');

    await inspectorAction(page, 'water');
    await page.waitForFunction(() => window.__bonsai?.lastSound === 'water');
    expect(errors).toEqual([]);
  });
});

// The hook's `track` is the loop the world's MusicPlayer is playing after the
// Music gate; like `lastSound`, it is what the game asked for, not what was heard.

/** Taps the Settings panel's Music row and waits for the stored switch to become `to`. */
async function setMusic(page: Page, to: boolean): Promise<void> {
  await tapControl(page, 'panel-music');
  await page.waitForFunction((v) => window.__bonsai?.settings.music === v, to);
}

test.describe('ambient music', () => {
  test('a new game plays the shed loop, the garden door the garden one, the viewer its own', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    expect((await hook(page)).track).toBe('shed');

    await walkTo(page, 200, 'left', 'door');
    await interact(page);
    await page.waitForFunction(() => window.__bonsai?.room === 'garden');
    expect((await hook(page)).track).toBe('garden');

    await openViewer(page);
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === true);
    expect((await hook(page)).track).toBe('viewer');
    await closeViewer(page);
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === false);
    expect((await hook(page)).track).toBe('garden');
    expect(errors).toEqual([]);
  });

  test('Music off in Settings stops the loop, and on again starts it without a reload', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openSettingsFromMenu(page);
    await setMusic(page, false);
    expect((await hook(page)).track).toBe('');
    await setMusic(page, true);
    expect((await hook(page)).track).toBe('shed');

    await setMusic(page, false);
    await closeAndStep(page);
    await openViewer(page);
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === true);
    expect((await hook(page)).track).toBe('');
    expect(errors).toEqual([]);
  });
});
