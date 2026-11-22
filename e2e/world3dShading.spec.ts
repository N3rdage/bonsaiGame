import type { Page } from '@playwright/test';
import { ROOMS } from '../src/world/gardenRoom';
import type { RoomKey } from '../src/world/shedRoom';
import { wallSheets } from '../src/world3d/wallTiles';
import { bootWorld, expect, hook, skipTutorial, test } from './drive';
import { shedToGarden } from './rooms';

/** Tests run on software GL: a walk or a camera ease can take longer than the default 5 s poll. */
const POLL = { timeout: 30_000 };

const SETTINGS = JSON.stringify({ fullscreen: false, weather: false, world3d: true });

async function world3d(page: Page): Promise<NonNullable<BonsaiTestHook['world3d']>> {
  const state = (await hook(page)).world3d;
  if (!state) throw new Error('world3d missing from the hook');
  return state;
}

async function waitForRoom(page: Page, room: RoomKey): Promise<void> {
  await page.waitForFunction(
    ([r, sheets]) =>
      window.__bonsai?.world3d?.room === r &&
      window.__bonsai.world3d.floorSheet !== null &&
      window.__bonsai.world3d.wallSheets.length === sheets,
    [room, wallSheets(ROOMS[room]).length] as const,
  );
}

/** Turns the camera one step on Q and waits for its heading to settle. */
async function turnOnce(page: Page): Promise<void> {
  const before = (await world3d(page)).camera.alpha;
  await page.keyboard.press('q');
  await expect
    .poll(async () => Math.abs((await world3d(page)).camera.alpha - before), POLL)
    .toBeGreaterThan(0.7);
  let last = Number.NaN;
  await expect
    .poll(async () => {
      const now = (await world3d(page)).camera.alpha;
      const still = now === last;
      last = now;
      return still;
    }, POLL)
    .toBe(true);
}

// What flickered outdoors was not a shadow the camera moved but surfaces the depth buffer could
// not separate and a shadow map that refitted itself: so the shading of a room must not depend on
// the camera. The hook shows the settings that make it so, as numbers, never as pixels.
test.describe('the 3D world shading', () => {
  test.use({ reducedMotion: 'reduce' });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((settings) => {
      localStorage.setItem('bonsai.settings', settings);
    }, SETTINGS);
  });

  test('the shed, indoors, has a fixed, biased shadow map that the camera cannot move', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);

    const before = await world3d(page);
    expect(before.shadowMap.fixed).toBe(true);
    expect(before.shadowMap.bias).toBeGreaterThan(0);
    expect(before.shadowMap.normalBias).toBeGreaterThan(0);
    expect(before.artDepthOffset).toBeLessThan(0);
    const [left, right, bottom, top, minZ, maxZ] = before.shadowMap.window;
    expect(right).toBeGreaterThan(left);
    expect(top).toBeGreaterThan(bottom);
    // Tight to the room, not the camera's near and far planes.
    expect(maxZ - minZ).toBeLessThan(100);

    await turnOnce(page);
    const after = await world3d(page);
    expect(after.camera.alpha).not.toBeCloseTo(before.camera.alpha, 1);
    expect(after.shadowMap).toEqual(before.shadowMap);
  });

  test(
    'the back garden, outdoors, keeps its shadow window as the camera orbits and the player walks',
    {
      tag: '@walk',
    },
    async ({ page }) => {
      test.setTimeout(180_000);
      await bootWorld(page);
      await waitForRoom(page, 'shed');
      await skipTutorial(page, true);
      await shedToGarden(page);
      await waitForRoom(page, 'garden');

      const before = await world3d(page);
      expect(before.shadowMap.fixed).toBe(true);
      expect(before.artDepthOffset).toBeLessThan(0);
      await turnOnce(page);
      await page.keyboard.down('ArrowRight');
      await expect
        .poll(async () => (await world3d(page)).player?.x ?? 0, POLL)
        .toBeGreaterThan((before.player?.x ?? 0) + 0.5);
      await page.keyboard.up('ArrowRight');
      await turnOnce(page);
      const after = await world3d(page);
      expect(after.shadowMap).toEqual(before.shadowMap);
    },
  );
});
