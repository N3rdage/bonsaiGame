import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { serializeState } from '../src/sim/save';
import { createNewGameState } from '../src/sim/state';
import { CARRIED, createTree } from '../src/sim/tree';
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
  holdUntilAtLeast,
  holdUntilAtMost,
  hook,
  interact,
  openSettingsFromMenu,
  skipTutorial,
  sleepOneNight,
  startPlacing,
  tapControl,
  test,
  toTitle,
  walkToColumn,
  walkToRow,
} from './drive';
import {
  gardenToGreenhouse,
  hallwayToFrontByInteract,
  hallwayToStudy,
  loungeToHallway,
  loungeToShed,
  shedToGarden,
  shedToLounge,
} from './rooms';

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

/** Waits until the renderer keeps a built set for each of `rooms`, shown or hidden. */
async function waitForBuilt(page: Page, rooms: readonly RoomKey[]): Promise<void> {
  await page.waitForFunction(
    (keys) => keys.every((key) => window.__bonsai?.world3d?.built.includes(key)),
    rooms,
  );
}

/**
 * Waits until every room behind the shown room's doors is built ahead. Those builds run one a
 * frame once the player stands still, so a walk or a screenshot started before they finish races
 * them: on CI's software GL a capture then never settles and a tap can wait out the test.
 */
async function waitForAhead(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__bonsai?.world3d?.aheadPending === 0);
}

/** Waits for the renderer to be up and drawing `room`, its floor tiles and every one of its own wall sheets laid, and the player's body loaded. */
async function waitForRoom(page: Page, room: RoomKey): Promise<void> {
  await page.waitForFunction(
    ([r, sheets]) =>
      window.__bonsai?.world3d?.room === r &&
      window.__bonsai.world3d.floorSheet !== null &&
      window.__bonsai.world3d.wallSheets.length === sheets &&
      window.__bonsai.world3d.bodyLoaded,
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

  test(
    'draws the shed, follows the player and changes room through a door',
    { tag: '@walk' },
    async ({ page }) => {
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
        workbench: 1,
        planting_table: 1,
        kiosk: 1,
      });
      if (test.info().project.name === 's22-landscape') {
        await skipTutorial(page, true);
        await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
        await waitForAhead(page);
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

      await waitForAhead(page);
      await shedToLounge(page);
      await waitForRoom(page, 'lounge');
      await waitForAhead(page);
      const lounge = await world3d(page);
      expect(lounge.room).toBe('lounge');
      // Neither of the lounge's two display spots (the mantel, the side table) holds a tree: a mat on each.
      expect(lounge.spotMats).toBe(2);
      if (test.info().project.name === 's22-landscape') {
        await page.waitForTimeout(500);
        await expect(page).toHaveScreenshot('world3d-lounge.png');
      }

      // A room left is hidden, not disposed: coming back to the lounge shows the same meshes.
      await loungeToShed(page);
      await waitForRoom(page, 'shed');
      expect((await world3d(page)).meshes).toBe(shed.meshes);
      await shedToLounge(page);
      await waitForRoom(page, 'lounge');
      expect((await world3d(page)).meshes).toBe(lounge.meshes);
      expect(errors).toEqual([]);
    },
  );

  test(
    'shows a room it already built again without building it',
    { tag: '@walk' },
    async ({ page }) => {
      test.setTimeout(120_000);
      await bootWorld(page);
      await waitForRoom(page, 'shed');
      await skipTutorial(page, true);
      await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
      await waitForBuilt(page, ['lounge']);

      await shedToLounge(page);
      await waitForRoom(page, 'lounge');
      await loungeToShed(page);
      await waitForRoom(page, 'shed');
      await shedToLounge(page);
      await waitForRoom(page, 'lounge');

      const { roomChanges } = await world3d(page);
      expect(roomChanges.map(({ room, first }) => [room, first])).toEqual([
        ['shed', true],
        ['lounge', false],
        ['shed', false],
        ['lounge', false],
      ]);
      // The shed, the first room, was built by its own change and its art laid by the time its
      // floor and walls showed; the lounge was built ahead from the shed, so no change built it.
      expect(roomChanges[0]?.dressedMs).toBeGreaterThan(0);
      for (const change of roomChanges.slice(1)) expect(change.dressedMs).toBeUndefined();
      // Software GL draws a repeat visit in a few ms to a few tens (the shed, with its trees and
      // thin instances, is the dearest); building it again took longer. The bound is generous
      // for two workers under load; the `first` flags above are what pin that nothing is rebuilt.
      for (const change of roomChanges.filter(({ first }) => !first)) {
        expect(change.ms).toBeLessThan(150);
      }
    },
  );

  test(
    'paints its surfaces once at start, and a room seen first or again paints nothing',
    { tag: '@walk' },
    async ({ page }) => {
      test.setTimeout(120_000);
      await bootWorld(page);
      await waitForRoom(page, 'shed');
      await skipTutorial(page, true);
      await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
      await waitForBuilt(page, ['lounge']);
      const atStart = await world3d(page);
      expect(atStart.painted).toBeGreaterThan(0);
      expect(atStart.paintMs).toBeGreaterThan(0);

      // Each step is a room the player has not been in (lounge, hallway, study) or one seen again (shed).
      const steps: [() => Promise<unknown>, RoomKey][] = [
        [() => shedToLounge(page), 'lounge'],
        [() => loungeToShed(page), 'shed'],
        [() => shedToLounge(page), 'lounge'],
        [() => loungeToHallway(page), 'hallway'],
        [() => hallwayToStudy(page), 'study'],
      ];
      for (const [go, room] of steps) {
        await go();
        await waitForRoom(page, room);
        expect((await world3d(page)).painted).toBe(atStart.painted);
      }
    },
  );

  test('builds the rooms behind the shed doors ahead, hidden', async ({ page }) => {
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await waitForBuilt(page, ['garden', 'lounge', 'shed']);
    // A set built ahead is hidden: only the shed's meshes are counted, and the room is still the shed.
    const state = await world3d(page);
    expect(state.room).toBe('shed');
    expect(state.roomChanges.map(({ room, first }) => [room, first])).toEqual([['shed', true]]);
  });

  test('builds no room ahead while the player walks, and does once they stop', async ({ page }) => {
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
    await waitForBuilt(page, ['garden', 'lounge']);
    // The shed's neighbours are built and ahead of the lounge's own: the hallway is not.
    expect((await world3d(page)).built).not.toContain('hallway');

    // Through the lounge door and on up the lounge, a walk of over a second that never lets go
    // of the key, so the player does not stand still in the room that queues the hallway.
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(() => window.__bonsai?.room === 'lounge', undefined, POLL);
    const walking = await hook(page);
    expect(walking.world3d?.built).not.toContain('hallway');
    const from = walking.player.y;
    await page.waitForFunction((y) => (window.__bonsai?.player.y ?? y) < y - 20, from, POLL);
    const now = await hook(page);
    expect(now.player.y).toBeLessThan(from);
    expect(now.world3d?.aheadBuilds).toEqual(walking.world3d?.aheadBuilds);
    expect(now.world3d?.built).toEqual(walking.world3d?.built);
    await page.keyboard.up('ArrowUp');

    await waitForBuilt(page, ['hallway']);
    const { aheadBuilds } = await world3d(page);
    expect(aheadBuilds.map(({ room }) => room)).toEqual(['garden', 'lounge', 'hallway']);
    for (const { ms } of aheadBuilds) expect(ms).toBeGreaterThan(0);
  });

  test('walks through a doorway into the next room without Interact', async ({ page }) => {
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
    await waitForBuilt(page, ['lounge']);

    // The shed's start is in line with the lounge door in its top wall: straight up, no E.
    expect((await hook(page)).room).toBe('shed');
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(() => window.__bonsai?.room === 'lounge', undefined, POLL);
    await page.keyboard.up('ArrowUp');
    const lounge = await hook(page);
    expect(lounge.arrivedBeside).toBe('door');
    // The lounge was built ahead, so the change into it built nothing.
    expect((await world3d(page)).roomChanges.at(-1)).toMatchObject({
      room: 'lounge',
      first: false,
    });
    // The landing is beside the far door, facing into the room, and walking on does not bounce back.
    expect(lounge.player.y).toBeGreaterThan(150);
    await page.waitForTimeout(400);
    expect((await hook(page)).room).toBe('lounge');
  });

  test('does not take a doorway walked past along its wall', async ({ page }) => {
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);

    // Out of the door's lane, up to the top wall, then along it past the door and back.
    await holdUntilAtMost(page, 'ArrowLeft', 'x', 200);
    await holdUntilAtMost(page, 'ArrowUp', 'y', 66);
    await holdUntilAtLeast(page, 'ArrowRight', 'x', 280);
    await holdUntilAtMost(page, 'ArrowLeft', 'x', 200);
    const after = await hook(page);
    expect(after.room).toBe('shed');
    expect(after.player.y).toBeLessThan(80);
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

  test(
    'up walks away from the camera, whatever its heading',
    { tag: '@walk' },
    async ({ page }) => {
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
      await expect
        .poll(async () => (await world3d(page)).facing, POLL)
        .toBeCloseTo(-Math.PI / 2, 1);

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
    },
  );

  test(
    'the player is a character that idles at rest, runs at full speed and idles again',
    { tag: '@walk' },
    async ({ page }) => {
      test.setTimeout(120_000);
      await bootWorld(page);
      await waitForRoom(page, 'shed');
      await skipTutorial(page, true);

      expect((await world3d(page)).playerModel).toBe('character');
      await expect.poll(async () => (await world3d(page)).clips.idle, POLL).toBeGreaterThan(0.99);
      expect((await world3d(page)).carry).toBe(0);

      await page.keyboard.down('ArrowRight');
      await expect.poll(async () => (await world3d(page)).clips.run, POLL).toBeGreaterThan(0.99);
      const walking = (await world3d(page)).clips;
      expect(walking.idle + walking.walk + walking.run).toBeCloseTo(1, 5);
      await page.keyboard.up('ArrowRight');
      await expect.poll(async () => (await world3d(page)).clips.idle, POLL).toBeGreaterThan(0.99);
    },
  );

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

  test(
    'a tap on a prop walks to it and uses it, a tap on the floor walks there, a drag does neither',
    { tag: '@walk' },
    async ({ page }) => {
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
    },
  );

  test("a touch tap near a tree's pedestal, off its box, opens the tree; one on open floor walks", async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== 's22-landscape',
      'the touch target is measured on the S22',
    );
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    // A pedestal set down in the shed with a tree on it: its hotspot id is the display spot's key.
    const state = createNewGameState();
    state.placed = [{ id: 0, kind: 'pedestal', room: 'shed', x: 336, y: 128 }];
    state.nextPlacedId = 1;
    state.trees = [{ ...createTree('juniper', 'cutting', 0), location: 'displayed:placed_0' }];
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
    const canvas = await page.locator('#game canvas').boundingBox();
    if (!canvas) throw new Error('no canvas');
    const tapAt = async (x: number, y: number): Promise<void> => {
      await page.touchscreen.tap(
        canvas.x + (x * canvas.width) / 480,
        canvas.y + (y * canvas.height) / 270,
      );
    };
    const settle = async (): Promise<void> => {
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
    };
    await settle();

    // A touch tap on open floor in the right half (the left half is the stick), more than twice the target from every prop, walks there.
    const start = (await world3d(page)).player;
    const bare = (await world3d(page)).hotspots;
    const clear = [40, 80, 120]
      .flatMap((dx) => [10, 40, 55].map((dy) => ({ x: 240 + dx, y: 135 + dy })))
      .find((p) => bare.every((h) => Math.hypot(h.x - p.x, h.y - p.y) > 62));
    if (!clear) throw new Error('no bare floor on screen');
    await tapAt(clear.x, clear.y);
    await expect
      .poll(async () => {
        const p = (await world3d(page)).player;
        return Math.hypot((p?.x ?? 0) - (start?.x ?? 0), (p?.y ?? 0) - (start?.y ?? 0));
      }, POLL)
      .toBeGreaterThan(0.5);
    expect((await world3d(page)).picked).toBeNull();

    // Zoomed out, so the pedestal's box is smaller than the tap target.
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    for (let i = 0; i < 6; i += 1) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(100);
    }
    await settle();

    // The S22's tap target is 31 game px (44 CSS px at 1.42 CSS px each). A tap 26 px (37 CSS px)
    // from the middle of the tree's pedestal, outside every prop's box and nearer that middle
    // than any other, is inside its target: not the floor but the tree, whose inspector opens
    // once the player has walked up.
    const spots = (await world3d(page)).hotspots;
    const tree = spots.find((h) => h.id === 'placed_0');
    if (!tree) throw new Error('no hotspot on the tree pedestal');
    const offset = 26;
    const aim = [
      { x: tree.x + offset, y: tree.y },
      { x: tree.x - offset, y: tree.y },
      { x: tree.x, y: tree.y + offset },
      { x: tree.x, y: tree.y - offset },
    ].find(
      (p) =>
        p.x > 20 &&
        p.x < 460 &&
        p.y > 20 &&
        p.y < 250 &&
        spots.every(
          (o) =>
            (Math.abs(p.x - o.x) > o.w / 2 + 1 || Math.abs(p.y - o.y) > o.h / 2 + 1) &&
            (o.id === tree.id || Math.hypot(p.x - o.x, p.y - o.y) > offset + 2),
        ),
    );
    if (!aim) throw new Error('no clear floor beside the tree pedestal');
    await tapAt(aim.x, aim.y);
    await expect.poll(async () => (await hook(page)).panel, POLL).toMatch(/^tree:/);
    expect((await world3d(page)).picked).toBe('placed_0');
    expect(errors).toEqual([]);
  });

  test(
    "stands the room's trees on their spots, built from the tree viewer's meshes",
    { tag: '@walk' },
    async ({ page }) => {
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
        await waitForAhead(page);
        await page.waitForTimeout(500);
        await expect(page).toHaveScreenshot('world3d-trees.png');
      }

      // The lounge has no tree on its floor or spots in this save: its room draws none.
      await waitForAhead(page);
      await shedToLounge(page);
      await waitForRoom(page, 'lounge');
      await expect.poll(async () => (await world3d(page)).trees, POLL).toBe(0);
      expect(errors).toEqual([]);
    },
  );

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

  test("lights and inks the room in the world's look", async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await expect.poll(async () => (await world3d(page)).inked, POLL).toBe(true);
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

  test("papers the lounge's hallway block as a wall", { tag: '@walk' }, async ({ page }) => {
    test.skip(test.info().project.name !== 's22-landscape', 'one screenshot project');
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
    await waitForBuilt(page, ['garden', 'lounge']);
    await shedToLounge(page);
    await waitForRoom(page, 'lounge');
    await waitForAhead(page);
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot('world3d-lounge-hallway.png');
  });

  test("draws the study's furniture", { tag: '@walk' }, async ({ page }) => {
    test.skip(test.info().project.name !== 's22-landscape', 'one screenshot project');
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
    await waitForBuilt(page, ['garden', 'lounge']);
    await shedToLounge(page);
    await waitForRoom(page, 'lounge');
    await waitForAhead(page);
    await loungeToHallway(page);
    await waitForRoom(page, 'hallway');
    await waitForAhead(page);
    await hallwayToStudy(page);
    await waitForRoom(page, 'study');
    await waitForAhead(page);
    // The camera eases from the hallway door's landing to the player's place in the study.
    await page.waitForTimeout(3000);
    await expect(page).toHaveScreenshot('world3d-study.png');
  });

  test(
    "lays each room's floor: painted indoors, its own Inked tiles outdoors",
    { tag: '@walk' },
    async ({ page }) => {
      test.setTimeout(120_000);
      await bootWorld(page);
      await waitForRoom(page, 'shed');
      await expect.poll(async () => (await world3d(page)).floorSheet, POLL).toBe('paint.wood');
      await shedToGarden(page);
      await waitForRoom(page, 'garden');
      await expect
        .poll(async () => (await world3d(page)).floorSheet, POLL)
        .toBe('spr_floor_garden');
    },
  );

  test(
    "dresses each room's walls and caps: wallpaper indoors, its own Inked sheets for caps and fences",
    { tag: '@walk' },
    async ({ page }) => {
      test.setTimeout(120_000);
      await bootWorld(page);
      await waitForRoom(page, 'shed');
      expect((await world3d(page)).wallSheets).toEqual([
        'paint.wallpaper',
        'spr_shed_cap',
        'spr_shed_cap_v',
      ]);
      await shedToGarden(page);
      await waitForRoom(page, 'garden');
      expect((await world3d(page)).wallSheets).toEqual([
        'spr_fence',
        'spr_fence_corner',
        'spr_fence_v',
      ]);
    },
  );

  test(
    "models each room's doors, windows and plantings from its room data",
    { tag: '@walk' },
    async ({ page }) => {
      test.setTimeout(120_000);
      await bootWorld(page);
      await waitForRoom(page, 'shed');
      expect((await world3d(page)).details).toEqual({ door: 2, window: 1 });
      await shedToGarden(page);
      await waitForRoom(page, 'garden');
      expect((await world3d(page)).details).toEqual({ door: 4, window: 1, planting: 3 });
    },
  );

  test(
    'draws the garden with the player casting a shadow on the floor',
    { tag: '@walk' },
    async ({ page }) => {
      test.skip(test.info().project.name !== 's22-landscape', 'one screenshot project');
      test.setTimeout(120_000);
      await bootWorld(page);
      await waitForRoom(page, 'shed');
      await skipTutorial(page, true);
      await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
      await waitForAhead(page);
      await shedToGarden(page);
      await waitForRoom(page, 'garden');
      await expect.poll(async () => (await world3d(page)).shadows, POLL).toBe(true);
      await waitForAhead(page);
      await zoomIn(page, 900, 8);
      await expect(page).toHaveScreenshot('world3d-garden-shadows.png');
    },
  );

  test('draws the gardener close up in the shed', { tag: '@walk' }, async ({ page }) => {
    test.skip(test.info().project.name !== 's22-landscape', 'one screenshot project');
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
    // Three Q presses (45 degrees each) swing the camera 135 degrees round to see the player's
    // face, fringe, apron and trowel three-quarters on. The player stays put, so the shot is still.
    for (let i = 0; i < 3; i++) await page.keyboard.press('q');
    await expect
      .poll(async () => (await world3d(page)).camera.alpha, POLL)
      .toBeCloseTo(-Math.PI / 2 - (3 * Math.PI) / 4, 1);
    // The wheel zooms to the camera's nearest, which frames the player from head to boots.
    await zoomIn(page, 3000, 4.5);
    await expect(page).toHaveScreenshot('world3d-gardener.png', { timeout: 30_000 });
  });

  test(
    'carries a tree in the upper body, and keeps running with it',
    { tag: '@walk' },
    async ({ page }) => {
      test.setTimeout(120_000);
      const state = createNewGameState();
      const [starter] = state.trees;
      if (!starter) throw new Error('no starter');
      starter.location = CARRIED;
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
      expect((await hook(page)).carrying).toBe("Granny's");
      await expect.poll(async () => (await world3d(page)).carry, POLL).toBe(1);
      expect((await world3d(page)).shot).toBeNull();

      if (test.info().project.name === 's22-landscape') {
        for (let i = 0; i < 3; i++) await page.keyboard.press('q');
        await expect
          .poll(async () => (await world3d(page)).camera.alpha, POLL)
          .toBeCloseTo(-Math.PI / 2 - (3 * Math.PI) / 4, 1);
        await zoomIn(page, 3000, 4.5);
        await expect(page).toHaveScreenshot('world3d-carrying.png', { timeout: 30_000 });
      }

      await page.keyboard.down('ArrowRight');
      await expect.poll(async () => (await world3d(page)).clips.run, POLL).toBeGreaterThan(0.99);
      expect((await world3d(page)).carry).toBe(1);
      await page.keyboard.up('ArrowRight');
    },
  );

  test('lies down for a sleep, lies still, and stands up', { tag: '@walk' }, async ({ page }) => {
    test.setTimeout(240_000);
    // Lie_Idle is held for ten minutes of game time, so the pose can be captured at rest.
    await bootWorld(page, '/?lieSeconds=600');
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);
    expect((await world3d(page)).shot).toBeNull();
    if (test.info().project.name === 's22-landscape') {
      for (let i = 0; i < 3; i++) await page.keyboard.press('q');
      await zoomIn(page, 3000, 4.5);
    }

    await sleepOneNight(page);
    await expect.poll(async () => (await world3d(page)).shot, POLL).toBe('lieIdle');
    await expect.poll(async () => (await hook(page)).toast, { timeout: 100_000 }).toBe('');
    expect((await world3d(page)).clips.idle).toBeGreaterThan(0.99);
    if (test.info().project.name === 's22-landscape') {
      await expect(page).toHaveScreenshot('world3d-lying.png', { timeout: 30_000 });
    }
    expect((await world3d(page)).shot).toBe('lieIdle');
  });

  test('stands up from a short sleep and is free again', { tag: '@walk' }, async ({ page }) => {
    test.setTimeout(240_000);
    await bootWorld(page, '/?lieSeconds=0.5');
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);
    await sleepOneNight(page);
    await page.waitForFunction(
      () => window.__bonsai?.world3d?.shot === 'lieStandUp',
      undefined,
      POLL,
    );
    await expect.poll(async () => (await world3d(page)).shot, POLL).toBeNull();
  });

  test('sits on the lounge sofa and armchair, and stands up on a move or Interact', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const shot = async (): Promise<string | null> => (await world3d(page)).shot;
    const clip = (name: string) =>
      page.waitForFunction((n) => window.__bonsai?.world3d?.shot === n, name, POLL);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);
    await shedToLounge(page);
    await waitForRoom(page, 'lounge');
    await waitForAhead(page);
    expect((await hook(page)).prompt).toBe('');

    // Along the sofa's front, up its east face: the seat is in reach and nothing nearer.
    await walkToRow(page, 150);
    await walkToColumn(page, 205);
    await walkToRow(page, 128);
    const beside = (await hook(page)).player;
    expect(await hook(page)).toMatchObject({ near: 'seat_sofa', prompt: 'E: Sit' });
    await interact(page);
    await clip('sitIdle');
    expect((await world3d(page)).seated).toBe('sofa');
    expect((await hook(page)).prompt).toBe('E: Stand');
    if (test.info().project.name === 's22-landscape') {
      await zoomIn(page, 3000, 4.5);
      await expect(page).toHaveScreenshot('world3d-sitting-sofa.png', { timeout: 30_000 });
    }

    // A move key gets the player up and, once up, away; it does not slide off the seat.
    await page.keyboard.down('ArrowDown');
    await clip('sitStandUp');
    await expect.poll(async () => (await hook(page)).prompt, POLL).toBe('');
    expect((await hook(page)).player).toEqual(beside);
    await page.waitForFunction(() => window.__bonsai?.world3d?.seated === null, undefined, POLL);
    await page.waitForFunction((y) => (window.__bonsai?.player.y ?? 0) > y + 4, beside.y, POLL);
    await page.keyboard.up('ArrowDown');

    // Below the armchair's front: along the row under the table and up its west face.
    await walkToRow(page, 150);
    await walkToColumn(page, 270);
    await walkToRow(page, 124);
    expect(await hook(page)).toMatchObject({ near: 'seat_armchair', prompt: 'E: Sit' });
    const armchair = (await hook(page)).player;
    await interact(page);
    await clip('sitIdle');
    expect((await world3d(page)).seated).toBe('armchair');
    if (test.info().project.name === 's22-landscape') {
      // The floor lamp stands between the default camera and the chair: swing round to see the sitter.
      for (let i = 0; i < 2; i++) await page.keyboard.press('q');
      await expect
        .poll(async () => (await world3d(page)).camera.alpha, POLL)
        .toBeCloseTo(-Math.PI / 2 - Math.PI / 2, 1);
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('world3d-sitting-armchair.png', { timeout: 30_000 });
    }

    // Interact gets up too.
    await interact(page);
    await clip('sitStandUp');
    await expect.poll(async () => (await hook(page)).prompt, POLL).toBe('');
    await expect.poll(shot, POLL).toBeNull();
    expect((await world3d(page)).seated).toBeNull();
    expect((await hook(page)).player).toEqual(armchair);
  });

  test("draws the garden's glazed doors", { tag: '@walk' }, async ({ page }) => {
    test.skip(test.info().project.name !== 's22-landscape', 'one screenshot project');
    test.setTimeout(120_000);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    await skipTutorial(page, true);
    await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
    await waitForAhead(page);
    await shedToGarden(page);
    await waitForRoom(page, 'garden');
    // The rooms behind the garden's doors are built ahead on idle frames; let that finish.
    await waitForBuilt(page, ['study', 'greenhouse', 'frontGarden']);
    await waitForAhead(page);
    // On the lawn in front of the study's door, in the house's back face, which the camera frames.
    await walkToColumn(page, 300);
    await walkToRow(page, 175);
    await page.waitForTimeout(2000);
    // The garden's capture takes software GL longer than the default 5 s to settle.
    await expect(page).toHaveScreenshot('world3d-garden-doors.png', { timeout: 30_000 });
  });

  test(
    "cuts the front garden's house face away with its windows and the garage door when it hides the player",
    { tag: '@walk' },
    async ({ page }) => {
      test.skip(test.info().project.name !== 's22-landscape', 'one screenshot project');
      test.setTimeout(120_000);
      await bootWorld(page);
      await waitForRoom(page, 'shed');
      await skipTutorial(page, true);
      await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
      // Each walk starts once the rooms behind the doors are built ahead, so it runs on idle
      // frames and the player lands where the baseline has it.
      await waitForBuilt(page, ['garden', 'lounge']);
      await shedToLounge(page);
      await waitForBuilt(page, ['hallway']);
      await loungeToHallway(page);
      await waitForBuilt(page, ['frontGarden', 'study']);
      // The door is used by Interact, not by walking into it: a walk-through leaves the arrow key
      // held and the player drifting north of the landing by a timing-dependent few px.
      await hallwayToFrontByInteract(page);
      await waitForRoom(page, 'frontGarden');
      expect((await hook(page)).player).toMatchObject({ x: 336, y: 190 });
      await waitForBuilt(page, ['garden']);
      await expect
        .poll(async () => (await world3d(page)).cut.some((n) => n.endsWith('_face')), POLL)
        .toBe(true);
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('world3d-front-garden.png');
    },
  );

  test(
    "draws the season's weather outdoors only, from the 2D world's field",
    { tag: '@walk' },
    async ({ page }) => {
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

      await waitForAhead(page);
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
      await waitForAhead(page);
      await gardenToGreenhouse(page);
      await waitForRoom(page, 'greenhouse');
      await expect.poll(async () => (await world3d(page)).weather, POLL).toBeNull();
    },
  );

  test(
    'placed items stand in the greenhouse under their trees, and placing another adds an instance',
    { tag: '@walk' },
    async ({ page }) => {
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
      await waitForAhead(page);
      await shedToGarden(page);
      await waitForRoom(page, 'garden');
      await waitForAhead(page);
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
        await waitForAhead(page);
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
      // Only the new item's hotspot and the mat on its empty spot are new meshes: the room's own meshes are the same count.
      expect(placed.spotMats).toBe(room.spotMats + 1);
      expect(placed.meshes).toBe(room.meshes + 2);
      expect(errors).toEqual([]);
    },
  );

  test('loads offline once the service worker has precached the build', async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
      timeout: 15_000,
    });
    // Installing the worker precaches the build, so it is complete once the worker controls the page.
    await context.setOffline(true);
    await bootWorld(page);
    await waitForRoom(page, 'shed');
    expect((await world3d(page)).bodyLoaded).toBe(true);
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
