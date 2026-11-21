import type { Page } from '@playwright/test';
import {
  bootWorld,
  collectErrors,
  dragLogical,
  expect,
  hook,
  openSettingsFromMenu,
  skipTutorial,
  tapControl,
  test,
} from './drive';
import { loungeToShed, shedToLounge } from './rooms';

// The 3D world (preview) setting: Babylon draws the room under the Phaser canvas
// (src/world3d/), which keeps the movement, the doors and the HUD. The setting is
// stored in localStorage before the page loads.

const SETTINGS = JSON.stringify({ fullscreen: false, weather: false, world3d: true });

async function world3d(page: Page): Promise<NonNullable<BonsaiTestHook['world3d']>> {
  const state = (await hook(page)).world3d;
  if (!state) throw new Error('world3d missing from the hook');
  return state;
}

/** Waits for the renderer to be up and drawing `room`. */
async function waitForRoom(page: Page, room: string): Promise<void> {
  await page.waitForFunction((r) => window.__bonsai?.world3d?.room === r, room);
}

test.describe('the 3D world', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((settings) => {
      localStorage.setItem('bonsai.settings', settings);
    }, SETTINGS);
  });

  test('draws the shed, follows the player and changes room through a door', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await bootWorld(page);
    await waitForRoom(page, 'shed');

    const shed = await world3d(page);
    expect(shed.on).toBe(true);
    expect(shed.meshes).toBeGreaterThan(0);
    if (test.info().project.name === 's22-landscape') {
      await skipTutorial(page, true);
      await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
      // A few frames for the camera and the scene to settle.
      await page.evaluate(
        () =>
          new Promise<void>((done) => {
            let n = 0;
            const tick = (): void => {
              if (++n >= 5) done();
              else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
      );
      await expect(page).toHaveScreenshot('world3d-shed.png');
      await openSettingsFromMenu(page);
      await expect(page).toHaveScreenshot('settings-world3d.png');
      await tapControl(page, 'panel-close');
      await page.waitForFunction(() => window.__bonsai?.panel === '');
    }

    // The capsule stands where the 2D player does, in metres.
    const near = async (): Promise<void> => {
      await expect
        .poll(async () => {
          const h = await hook(page);
          const p = (await world3d(page)).player;
          return (
            p && [p.x - h.player.x / 32, p.y - h.player.y / 32].every((d) => Math.abs(d) < 0.01)
          );
        })
        .toBe(true);
    };
    await near();
    const before = (await world3d(page)).player;
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(400);
    await page.keyboard.up('ArrowRight');
    await near();
    const after = (await world3d(page)).player;
    expect(after?.x).toBeGreaterThan((before?.x ?? 0) + 0.1);

    await shedToLounge(page);
    await waitForRoom(page, 'lounge');
    const lounge = await world3d(page);
    expect(lounge.room).toBe('lounge');

    // Trips dispose the room they leave: coming back to the lounge shows the same meshes.
    await loungeToShed(page);
    await waitForRoom(page, 'shed');
    expect((await world3d(page)).meshes).toBe(shed.meshes);
    await shedToLounge(page);
    await waitForRoom(page, 'lounge');
    expect((await world3d(page)).meshes).toBe(lounge.meshes);
    expect(errors).toEqual([]);
  });

  test('turns in steps on Q and E, zooms on the wheel and drags round on the mouse', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);

    const start = await world3d(page);
    expect(start.camera.alpha).toBeCloseTo(-Math.PI / 2, 1);
    // Due south of the player, the south wall stands between.
    expect(start.cut.length).toBeGreaterThan(0);

    await page.keyboard.press('q');
    await expect
      .poll(async () => (await world3d(page)).camera.alpha)
      .toBeLessThan(-Math.PI / 2 - 0.7);
    const turned = await world3d(page);
    expect(turned.cut).not.toEqual(start.cut);
    expect(turned.cut.length).toBeGreaterThan(start.cut.length);

    await page.keyboard.press('e');
    await page.keyboard.press('e');
    await expect
      .poll(async () => (await world3d(page)).camera.alpha)
      .toBeGreaterThan(-Math.PI / 2 + 0.7);

    const radius = (await world3d(page)).camera.radius;
    await page.mouse.move(400, 100);
    await page.mouse.wheel(0, 300);
    await expect.poll(async () => (await world3d(page)).camera.radius).toBeGreaterThan(radius + 1);

    const before = (await world3d(page)).camera.alpha;
    await dragLogical(page, 100, 60, 60);
    await expect
      .poll(async () => Math.abs((await world3d(page)).camera.alpha - before))
      .toBeGreaterThan(0.2);
  });

  test('up walks away from the camera, whatever its heading', async ({ page }) => {
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);

    const walkUp = async (): Promise<{ dx: number; dy: number }> => {
      const before = (await world3d(page)).player;
      await page.keyboard.down('ArrowUp');
      await page.waitForTimeout(300);
      await page.keyboard.up('ArrowUp');
      const after = (await world3d(page)).player;
      return { dx: (after?.x ?? 0) - (before?.x ?? 0), dy: (after?.y ?? 0) - (before?.y ?? 0) };
    };

    // The default heading looks north: up is north, as in the 2D world.
    const north = await walkUp();
    expect(north.dy).toBeLessThan(-0.1);
    expect(Math.abs(north.dy)).toBeGreaterThan(Math.abs(north.dx));
    await expect.poll(async () => (await world3d(page)).facing).toBeCloseTo(-Math.PI / 2, 1);

    // Two Q presses (45 degrees each) turn the camera a quarter to look east.
    await page.keyboard.press('q');
    await page.keyboard.press('q');
    await expect.poll(async () => (await world3d(page)).camera.alpha).toBeLessThan(-Math.PI + 0.05);
    const east = await walkUp();
    expect(east.dx).toBeGreaterThan(0.1);
    expect(Math.abs(east.dx)).toBeGreaterThan(Math.abs(east.dy));
    await expect.poll(async () => (await world3d(page)).facing).toBeCloseTo(0, 1);
  });

  test('the Q that closes the tree viewer does not also turn the camera', async ({ page }) => {
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);

    await page.keyboard.press('v');
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === true);
    await page.keyboard.press('q');
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === false);
    // Longer than the camera's ease: a turn would have shown by now.
    await page.waitForTimeout(800);
    expect((await world3d(page)).camera.alpha).toBeCloseTo(-Math.PI / 2, 2);

    // The next Q is a plain press again.
    await page.keyboard.press('q');
    await expect
      .poll(async () => (await world3d(page)).camera.alpha)
      .toBeLessThan(-Math.PI / 2 - 0.7);
  });

  test('draws the shed again from a turned heading', async ({ page }) => {
    test.skip(test.info().project.name !== 's22-landscape', 'one screenshot project');
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
    await page.keyboard.press('q');
    await page.keyboard.press('q');
    await expect.poll(async () => (await world3d(page)).camera.alpha).toBeLessThan(-Math.PI + 0.01);
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('world3d-shed-turned.png');
  });
});
