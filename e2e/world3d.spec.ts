import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { serializeState } from '../src/sim/save';
import { createNewGameState } from '../src/sim/state';
import { createTree } from '../src/sim/tree';
import { ROOMS } from '../src/world/gardenRoom';
import type { RoomKey } from '../src/world/shedRoom';
import { wallSheets } from '../src/world3d/wallTiles';
import {
  bootWorld,
  clickLogical,
  collectErrors,
  continueGame,
  dragLogical,
  expect,
  hook,
  interact,
  openSettingsFromMenu,
  skipTutorial,
  startPlacing,
  tapControl,
  test,
  toTitle,
} from './drive';
import { gardenToGreenhouse, loungeToShed, shedToGarden, shedToLounge } from './rooms';

/** Tests run two workers on software GL: a walk, a camera ease or an instance count can take longer than the default 5 s poll. */
const POLL = { timeout: 30_000 };

// The 3D world (preview) setting: Babylon draws the room under the Phaser canvas
// (src/world3d/), which keeps the movement, the doors and the HUD. The setting is
// stored in localStorage before the page loads.

const SETTINGS = JSON.stringify({ fullscreen: false, weather: false, world3d: true });

async function world3d(page: Page): Promise<NonNullable<BonsaiTestHook['world3d']>> {
  const state = (await hook(page)).world3d;
  if (!state) throw new Error('world3d missing from the hook');
  return state;
}

/** Waits for the renderer to be up and drawing `room`, its floor tiles and every one of its own wall sheets laid. */
async function waitForRoom(page: Page, room: RoomKey): Promise<void> {
  await page.waitForFunction(
    ([r, sheets]) =>
      window.__bonsai?.world3d?.room === r &&
      window.__bonsai.world3d.floorSheet !== null &&
      window.__bonsai.world3d.wallSheets.length === sheets,
    [room, wallSheets(ROOMS[room]).length] as const,
  );
}

test.describe('the 3D world', () => {
  // The idle clip sways the player; with reduced motion it holds still, so a screenshot is the same each run.
  test.use({ reducedMotion: 'reduce' });

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
    // The shed's clutter is one instance of each model, not boxes.
    expect(shed.instances).toEqual({
      shelf: 1,
      tools: 1,
      watering_can: 1,
      pot_stack: 1,
      sack: 1,
    });
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
        }, POLL)
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
      .poll(async () => (await world3d(page)).camera.alpha, POLL)
      .toBeLessThan(-Math.PI / 2 - 0.7);
    const turned = await world3d(page);
    expect(turned.cut).not.toEqual(start.cut);
    expect(turned.cut.length).toBeGreaterThan(start.cut.length);

    await page.keyboard.press('e');
    await page.keyboard.press('e');
    await expect
      .poll(async () => (await world3d(page)).camera.alpha, POLL)
      .toBeGreaterThan(-Math.PI / 2 + 0.7);

    const radius = (await world3d(page)).camera.radius;
    await page.mouse.move(400, 100);
    await page.mouse.wheel(0, 300);
    await expect
      .poll(async () => (await world3d(page)).camera.radius, POLL)
      .toBeGreaterThan(radius + 1);

    const before = (await world3d(page)).camera.alpha;
    await dragLogical(page, 100, 60, 60);
    await expect
      .poll(async () => Math.abs((await world3d(page)).camera.alpha - before), POLL)
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
    await expect.poll(async () => (await world3d(page)).facing, POLL).toBeCloseTo(-Math.PI / 2, 1);

    // Two Q presses (45 degrees each) turn the camera a quarter to look east.
    await page.keyboard.press('q');
    await page.keyboard.press('q');
    await expect
      .poll(async () => (await world3d(page)).camera.alpha, POLL)
      .toBeLessThan(-Math.PI + 0.05);
    const east = await walkUp();
    expect(east.dx).toBeGreaterThan(0.1);
    expect(Math.abs(east.dx)).toBeGreaterThan(Math.abs(east.dy));
    await expect.poll(async () => (await world3d(page)).facing, POLL).toBeCloseTo(0, 1);
  });

  test('the player is a character that idles at rest, walks on the move and idles again', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);

    expect((await world3d(page)).playerModel).toBe('character');
    await expect.poll(async () => (await world3d(page)).clips.idle, POLL).toBeGreaterThan(0.99);

    await page.keyboard.down('ArrowRight');
    await expect.poll(async () => (await world3d(page)).clips.walk, POLL).toBeGreaterThan(0.99);
    const walking = (await world3d(page)).clips;
    expect(walking.idle + walking.walk).toBeCloseTo(1, 5);
    await page.keyboard.up('ArrowRight');
    await expect.poll(async () => (await world3d(page)).clips.idle, POLL).toBeGreaterThan(0.99);
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
      .poll(async () => (await world3d(page)).camera.alpha, POLL)
      .toBeLessThan(-Math.PI / 2 - 0.7);
  });

  test('a tap on a prop walks to it and uses it, a tap on the floor walks there, a drag does neither', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
    expect((await world3d(page)).picked).toBeNull();

    // A drag turns the camera and is no tap: nothing is picked and the player stays.
    const start = (await world3d(page)).player;
    await dragLogical(page, 100, 60, 40);
    await page.waitForTimeout(400);
    expect((await world3d(page)).picked).toBeNull();
    expect((await world3d(page)).player).toEqual(start);

    // A tap on bare floor, off the props, walks the player there.
    const hotspots = (await world3d(page)).hotspots;
    expect(hotspots.map((h) => h.id)).toContain('door_lounge');
    const clear = [-60, -40, 40, 60]
      .flatMap((dx) => [-30, 30, 50].map((dy) => ({ x: 240 + dx, y: 135 + dy })))
      .find((p) => hotspots.every((h) => Math.hypot(h.x - p.x, h.y - p.y) > 50));
    if (!clear) throw new Error('no bare floor on screen');
    await clickLogical(page, clear.x, clear.y);
    await expect
      .poll(async () => {
        const p = (await world3d(page)).player;
        return Math.hypot((p?.x ?? 0) - (start?.x ?? 0), (p?.y ?? 0) - (start?.y ?? 0));
      }, POLL)
      .toBeGreaterThan(0.5);
    expect((await world3d(page)).picked).toBeNull();

    // A tap on the lounge door picks its hotspot id, walks there and goes through it.
    // The walk has ended and the camera has settled once the hotspots stop moving on screen.
    // On software GL beside another 3D test that can take longer than the default 5 s.
    let before = '';
    await expect
      .poll(async () => {
        const now = JSON.stringify(
          (await world3d(page)).hotspots.map((h) => [h.id, Math.round(h.x), Math.round(h.y)]),
        );
        const still = now === before;
        before = now;
        await page.waitForTimeout(250);
        return still;
      }, POLL)
      .toBe(true);
    const door = (await world3d(page)).hotspots.find((h) => h.id === 'door_lounge');
    if (!door) throw new Error('no lounge door hotspot');
    await clickLogical(page, door.x, door.y);
    await expect.poll(async () => (await world3d(page)).picked, POLL).toBe('door_lounge');
    await waitForRoom(page, 'lounge');
    expect(errors).toEqual([]);
  });

  test("stands the room's trees on their spots, built from the tree viewer's meshes", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    // The prototype's two trees, both set down on the shed floor.
    const save = readFileSync(
      path.join(import.meta.dirname, '../src/sim/__fixtures__/prototype-save-v1-day14.json'),
      'utf8',
    ).replace('displayed:shed_window', 'shed');
    await page.goto('/');
    await page.evaluate((text) => {
      localStorage.setItem('bonsai.save.1', text);
    }, save);
    await toTitle(page);
    await continueGame(page);
    await waitForRoom(page, 'shed');
    await expect.poll(async () => (await world3d(page)).trees, POLL).toBe(2);
    const shed = await world3d(page);
    expect(shed.meshes).toBeGreaterThan(shed.trees);

    if (test.info().project.name === 's22-landscape') {
      // Zoomed in, since a 25 cm tree in a 20 cm pot is small at the default distance.
      await page.mouse.move(240, 135);
      for (let i = 0; i < 4; i += 1) {
        await page.mouse.wheel(0, -900);
        await page.waitForTimeout(100);
      }
      await expect.poll(async () => (await world3d(page)).camera.radius, POLL).toBeLessThan(5);
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('world3d-trees.png');
    }

    // The lounge has no tree on its floor or spots in this save: its room draws none.
    await shedToLounge(page);
    await waitForRoom(page, 'lounge');
    await expect.poll(async () => (await world3d(page)).trees, POLL).toBe(0);
    expect(errors).toEqual([]);
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
    await expect
      .poll(async () => (await world3d(page)).camera.alpha, POLL)
      .toBeLessThan(-Math.PI + 0.01);
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('world3d-shed-turned.png');
  });

  test("lights and inks the room in the tree viewer's toon look", async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await expect.poll(async () => (await world3d(page)).toon, POLL).toBe(true);
    expect(errors).toEqual([]);
  });

  test("draws the shed's furniture as models", async ({ page }) => {
    test.skip(test.info().project.name !== 's22-landscape', 'one screenshot project');
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
    await zoomIn(page, 900, 7.5);
    await expect(page).toHaveScreenshot('world3d-furniture.png');
  });

  test("lays each room's own Inked floor tiles", async ({ page }) => {
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await expect.poll(async () => (await world3d(page)).floorSheet, POLL).toBe('spr_floor_shed');
    await shedToGarden(page);
    await waitForRoom(page, 'garden');
    await expect.poll(async () => (await world3d(page)).floorSheet, POLL).toBe('spr_floor_garden');
  });

  test("dresses each room's walls, caps and fences from its own Inked sheets", async ({ page }) => {
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    expect((await world3d(page)).wallSheets).toEqual([
      'spr_shed_cap',
      'spr_shed_cap_v',
      'spr_shed_wall',
    ]);
    await shedToGarden(page);
    await waitForRoom(page, 'garden');
    expect((await world3d(page)).wallSheets).toEqual([
      'spr_fence',
      'spr_fence_corner',
      'spr_fence_v',
    ]);
  });

  test("models each room's doors, windows and plantings from its room data", async ({ page }) => {
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    expect((await world3d(page)).details).toEqual({ door: 2, window: 1 });
    await shedToGarden(page);
    await waitForRoom(page, 'garden');
    expect((await world3d(page)).details).toEqual({ door: 1, planting: 3 });
  });

  test('draws the garden with the player casting a shadow on the floor', async ({ page }) => {
    test.skip(test.info().project.name !== 's22-landscape', 'one screenshot project');
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
    await shedToGarden(page);
    await waitForRoom(page, 'garden');
    await expect.poll(async () => (await world3d(page)).shadows, POLL).toBe(true);
    await zoomIn(page, 900, 8);
    await expect(page).toHaveScreenshot('world3d-garden-shadows.png');
  });

  test("draws the season's weather outdoors only, from the 2D world's field", async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        'bonsai.settings',
        JSON.stringify({ fullscreen: false, weather: true, world3d: true }),
      );
    });
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);
    // The shed is indoors: the 2D world's motes are not drawn in 3D.
    expect((await world3d(page)).weather).toBeNull();

    await shedToGarden(page);
    await waitForRoom(page, 'garden');
    // The garden's field is built a frame or two after the room is; wait for it.
    await expect
      .poll(async () => (await hook(page)).weather?.kind, POLL)
      .toMatch(/^(petals|fireflies|leaves|snow)$/);
    const kind = (await hook(page)).weather?.kind;
    await expect.poll(async () => (await world3d(page)).weather, POLL).toBe(kind);
    await page.waitForTimeout(300);
    expect(errors).toEqual([]);

    // Back indoors the weather is gone again.
    await gardenToGreenhouse(page);
    await waitForRoom(page, 'greenhouse');
    await expect.poll(async () => (await world3d(page)).weather, POLL).toBeNull();
  });

  test('placed items stand in the greenhouse under their trees, and placing another adds an instance', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    // A pedestal in the inventory; a pedestal and a floor shelf already down in the greenhouse, three trees on their spots.
    const state = createNewGameState();
    state.inventory.pedestal = 1;
    state.placed = [
      { id: 0, kind: 'pedestal', room: 'greenhouse', x: 240, y: 128 },
      { id: 1, kind: 'floor_shelf', room: 'greenhouse', x: 288, y: 128 },
    ];
    state.nextPlacedId = 2;
    state.trees = ['placed_0', 'placed_1', 'placed_1_2'].map((spot, id) => ({
      ...createTree('juniper', 'cutting', id),
      location: `displayed:${spot}`,
    }));
    await page.goto('/');
    await page.evaluate(
      (text) => {
        localStorage.setItem('bonsai.save.1', text);
      },
      serializeState(state, new Date(2026, 10, 11, 0, 0)),
    );
    await toTitle(page);
    await continueGame(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
    await shedToGarden(page);
    await gardenToGreenhouse(page);
    await waitForRoom(page, 'greenhouse');

    // The two items are drawn, one instance each, with a hotspot for each of their spots and a tree on each.
    await expect
      .poll(async () => (await world3d(page)).instances, POLL)
      .toEqual({ pedestal: 1, floor_shelf: 1 });
    expect((await world3d(page)).hotspots.map((h) => h.id)).toEqual(
      expect.arrayContaining(['placed_0', 'placed_1', 'placed_1_2']),
    );
    await expect.poll(async () => (await world3d(page)).trees, POLL).toBe(3);

    if (test.info().project.name === 's22-landscape') {
      // A quarter turn puts the pedestal and the shelf beside the player, not behind the capsule.
      await page.keyboard.press('q');
      await page.keyboard.press('q');
      await expect
        .poll(async () => (await world3d(page)).camera.alpha, POLL)
        .toBeLessThan(-Math.PI + 0.05);
      await zoomIn(page, 1500, 6);
      await expect(page).toHaveScreenshot('world3d-bench-trees.png');
    }

    // Placing a second pedestal in the 2D flow adds an instance without rebuilding the room.
    const room = await world3d(page);
    await startPlacing(page);
    await interact(page);
    await expect.poll(async () => (await world3d(page)).instances.pedestal, POLL).toBe(2);
    const placed = await world3d(page);
    expect(placed.instances.floor_shelf).toBe(1);
    expect(placed.hotspots.map((h) => h.id)).toContain('placed_2');
    // Only the new item's instance and hotspot are new: the room's own meshes are the same count.
    expect(placed.meshes).toBe(room.meshes + 1);
    expect(errors).toEqual([]);
  });
});

/** Scrolls the camera in by `wheel` units and waits for it to reach `radius` metres or nearer. */
async function zoomIn(page: Page, wheel: number, radius: number): Promise<void> {
  await page.mouse.move(240, 135);
  await page.mouse.wheel(0, -wheel);
  await expect.poll(async () => (await world3d(page)).camera.radius, POLL).toBeLessThan(radius);
  await page.waitForTimeout(500);
}
