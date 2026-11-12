import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import {
  bootWorld,
  closeViewer as closeByRoute,
  collectErrors,
  continueGame,
  expect,
  openViewer as openByRoute,
  press,
  pressHotspot,
  setMode,
  startNewGame,
  test,
  toTitle,
} from './drive';

// Camera drags, pinch and the wheel are gestures, not shortcuts for a control,
// so they run the same on every project.

async function openViewer(page: Page, url: string): Promise<void> {
  await bootWorld(page, url);
  expect(await page.evaluate(() => window.__bonsai?.viewer?.open)).toBe(false);

  // View tree in the room opens the viewer on the starter (or the `?tree=` fixture).
  await openByRoute(page);

  // The foliage sprite loads asynchronously; once it has, the viewer redraws
  // with it, so screenshots taken after this always show textured leaves.
  await page.waitForFunction(
    () =>
      window.__bonsai?.viewer?.open === true &&
      window.__bonsai.viewer.renders >= 1 &&
      window.__bonsai.viewer.foliageReady,
  );
}

async function closeViewer(page: Page): Promise<void> {
  await closeByRoute(page);
  await page.waitForFunction(() => window.__bonsai?.viewer?.open === false);
  await expect(page.locator('#viewer')).toBeHidden();
  await expect(page.locator('#viewer-toolbar')).toBeHidden();
  await expect(page.locator('#viewer-help')).toBeHidden();
}

test.describe('3D viewer', () => {
  test('opens the 3D viewer on the starter tree and matches the baseline', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/');
    const hook = await page.evaluate(() => window.__bonsai);
    const viewer = hook?.viewer;
    expect(viewer?.yaw).toBe(45);
    expect(viewer?.pitch).toBe(10);
    expect(viewer?.distance).toBe(2.5);
    expect(viewer?.potTier).toBe(0);
    expect(hook?.starterHeightCm).toBeGreaterThan(0);
    // Orbit target: halfway up the trunk, cm -> display units (DISPLAY_SCALE 4).
    expect(viewer?.targetZ).toBeCloseTo(((hook?.starterHeightCm ?? NaN) / 100) * 4 * 0.5);
    expect(viewer?.revision).toBeGreaterThanOrEqual(0);
    // Starter tree: 688 triangles, pinned in src/viewer/treeMesh.test.ts.
    expect(viewer?.meshVertices).toBe(2064);
    // Day 0 is spring; the starter's foliage is pinned in src/viewer/viewerFixtures.test.ts.
    expect(hook?.season).toBe('spring');
    expect(viewer?.season).toBe('spring');
    expect(viewer?.foliageVertices).toBe(336);
    await expect(page.locator('#viewer-toolbar')).toBeVisible();

    // e2e/screenshot.css hides the toolbar and help lines during capture, so
    // the baseline is the WebGL frame alone.
    await expect(page.locator('#viewer')).toHaveScreenshot('viewer-scaffold.png');

    await closeViewer(page);
    expect(errors).toEqual([]);
  });

  // Vertex counts are pinned in src/viewer/viewerFixtures.test.ts.
  // `wired` carries one copper coil and trunk anchor (2064 bark + 6408 + 576);
  // `fancy` is the starter repotted into the tier-1 pot.
  const fixtures = [
    { key: 'cutting', meshVertices: 912, foliageVertices: 120, potTier: 0 },
    { key: 'bent', meshVertices: 2064, foliageVertices: 336, potTier: 0 },
    { key: 'cascade', meshVertices: 2304, foliageVertices: 252, potTier: 0 },
    // `pine` is the young pine in its dark bark with needle tufts, on day 0 (spring).
    { key: 'pine', meshVertices: 1488, foliageVertices: 396, potTier: 0 },
    { key: 'wired', meshVertices: 9048, foliageVertices: 336, potTier: 0 },
    { key: 'fancy', meshVertices: 2064, foliageVertices: 336, potTier: 1 },
  ];
  for (const { key, meshVertices, foliageVertices, potTier } of fixtures) {
    test(`shows the ${key} fixture tree and matches the baseline`, async ({ page }) => {
      const errors = collectErrors(page);
      await openViewer(page, `/?tree=${key}`);
      const viewer = await page.evaluate(() => window.__bonsai?.viewer);
      expect(viewer?.meshVertices).toBe(meshVertices);
      expect(viewer?.foliageVertices).toBe(foliageVertices);
      expect(viewer?.potTier).toBe(potTier);
      await expect(page.locator('#viewer')).toHaveScreenshot(`viewer-${key}.png`);
      await closeViewer(page);
      expect(errors).toEqual([]);
    });
  }

  // `?season=` overrides the game's season in the viewer only.
  const seasons = [
    { url: '/?season=summer', season: 'summer', foliageVertices: 336, shot: 'foliage-summer' },
    {
      url: '/?tree=maple&season=winter',
      season: 'winter',
      foliageVertices: 0,
      shot: 'maple-winter',
    },
    {
      url: '/?tree=maple&season=autumn',
      season: 'autumn',
      foliageVertices: 180,
      shot: 'maple-autumn',
    },
  ];
  for (const { url, season, foliageVertices, shot } of seasons) {
    test(`draws ${shot} foliage and matches the baseline`, async ({ page }) => {
      const errors = collectErrors(page);
      await openViewer(page, url);
      const hook = await page.evaluate(() => window.__bonsai);
      // The game itself is still on day 0 (spring); only the viewer changes season.
      expect(hook?.season).toBe('spring');
      expect(hook?.viewer?.season).toBe(season);
      expect(hook?.viewer?.foliageVertices).toBe(foliageVertices);
      await expect(page.locator('#viewer')).toHaveScreenshot(`viewer-${shot}.png`);
      await closeViewer(page);
      expect(errors).toEqual([]);
    });
  }

  test('ignores an unknown season and falls back to the game season', async ({ page }) => {
    await openViewer(page, '/?season=monsoon');
    expect(await page.evaluate(() => window.__bonsai?.viewer?.season)).toBe('spring');
  });
});

test.describe('viewer hotspots', () => {
  type Hotspot = BonsaiViewerHotspot;

  /** Switches mode and waits for the frame that lays out its hotspots. */
  async function pressMode(page: Page, mode: string): Promise<Hotspot[]> {
    const renders = (await page.evaluate(() => window.__bonsai?.viewer?.renders)) ?? 0;
    await setMode(page, mode);
    await page.waitForFunction(
      ([m, r]) => window.__bonsai?.viewer?.mode === m && window.__bonsai.viewer.renders > r,
      [mode, renders] as const,
    );
    const hotspots = (await page.evaluate(() => window.__bonsai?.viewer?.hotspots)) ?? [];
    await expect(page.locator('#viewer-hotspots .hotspot')).toHaveCount(hotspots.length);
    return [...hotspots];
  }

  const summary = (hs: Hotspot[]): string[] => hs.map((h) => `${h.kind}${String(h.id)}`);
  const branches = ['branch0', 'branch1', 'branch2', 'branch3'];
  const trunks = ['trunk0', 'trunk1', 'trunk2', 'trunk3'];

  test('shows branch and trunk hotspots per mode on the starter', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/');
    const hook = await page.evaluate(() => window.__bonsai);
    expect(hook?.viewer?.mode).toBe('view');
    expect(hook?.viewer?.wireAction).toBe('bend');
    expect(hook?.viewer?.bendDir).toBe('left');
    expect(hook?.viewer?.showWired).toBe(true);
    expect(hook?.viewer?.showUnwired).toBe(true);
    expect(hook?.viewer?.hotspots).toEqual([]);
    await expect(page.locator('#viewer-hotspots .hotspot')).toHaveCount(0);

    const clip = await pressMode(page, 'clip');
    expect(summary(clip)).toEqual(branches);
    expect(clip.map((h) => h.label)).toEqual(['0', '1', '2', '3']);
    await expect(page.locator('#viewer-hotspots .hotspot').first()).toHaveAttribute(
      'data-kind',
      'branch',
    );

    expect(summary(await pressMode(page, 'prune'))).toEqual(branches);

    const wire = await pressMode(page, 'wire');
    expect(summary(wire)).toEqual([...branches, ...trunks]);
    // Trunk hotspots at 0.2..0.8 of the trunk, labelled in whole cm.
    const heightCm = hook?.starterHeightCm ?? NaN;
    const labels = [0, 1, 2, 3].map((i) => String(Math.round((0.2 + (0.6 * i) / 3) * heightCm)));
    expect(wire.filter((h) => h.kind === 'trunk').map((h) => h.label)).toEqual(labels);
    await expect(page.locator('#viewer-hotspots .hotspot[data-kind="trunk"]')).toHaveText(labels);

    expect(await pressMode(page, 'view')).toEqual([]);

    await closeViewer(page);
    await expect(page.locator('#viewer-hotspots')).toBeHidden();
    expect(await page.evaluate(() => window.__bonsai?.viewer?.hotspots)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('shows the wired fixture branch and trunk hotspots in wire mode', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/?tree=wired');
    expect(summary(await pressMode(page, 'wire'))).toEqual([...branches, ...trunks]);
    await closeViewer(page);
    expect(errors).toEqual([]);
  });

  test('keeps hotspots on screen and moves them with the camera', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/');
    const before = await pressMode(page, 'wire');
    const size = page.viewportSize();
    const width = size?.width ?? 0;
    const height = size?.height ?? 0;
    expect(before).toHaveLength(8);
    for (const h of before) {
      expect(h.x).toBeGreaterThan(0);
      expect(h.x).toBeLessThan(width);
      expect(h.y).toBeGreaterThan(0);
      expect(h.y).toBeLessThan(height);
    }

    // Start low on the canvas, below the wire strip and clear of the tree's
    // hotspots. 80 px at 0.4 degrees per pixel turns the camera from 45 to 13.
    await page.mouse.move(width / 2 - 40, height * 0.9);
    await page.mouse.down();
    await page.mouse.move(width / 2 + 40, height * 0.9, { steps: 4 });
    await page.mouse.up();
    await page.waitForFunction(() => Math.abs((window.__bonsai?.viewer?.yaw ?? 0) - 13) < 1e-9);
    // The hook is published after each frame's hotspot layout, so these match yaw 13.
    const after = (await page.evaluate(() => window.__bonsai?.viewer?.hotspots)) ?? [];
    expect(summary([...after])).toEqual(summary(before));
    after.forEach((h, i) => {
      expect(h.x).not.toBe(before[i]?.x);
    });

    await closeViewer(page);
    expect(errors).toEqual([]);
  });

  test('never starts a drag in the top strip', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/');
    const size = page.viewportSize();
    const width = size?.width ?? 0;
    const height = size?.height ?? 0;
    const yaw = (await page.evaluate(() => window.__bonsai?.viewer?.yaw)) ?? NaN;

    const drag = async (y: number): Promise<void> => {
      await page.mouse.move(width / 2 - 40, y);
      await page.mouse.down();
      await page.mouse.move(width / 2 + 40, y, { steps: 4 });
      await page.mouse.up();
    };

    // View mode: the strip is 60 px.
    await drag(30);
    // Wire mode: the strip grows to 110 px, so 80 px is inside it.
    await pressMode(page, 'wire');
    await drag(80);
    expect(await page.evaluate(() => window.__bonsai?.viewer?.yaw)).toBe(yaw);

    await drag(height * 0.9);
    await page.waitForFunction((y) => window.__bonsai?.viewer?.yaw !== y, yaw);

    await closeViewer(page);
    expect(errors).toEqual([]);
  });
});

test.describe('viewer toolbar', () => {
  const summary = (hs: readonly BonsaiViewerHotspot[]): string[] =>
    hs.map((h) => `${h.kind}${String(h.id)}`);
  const branches = ['branch0', 'branch1', 'branch2', 'branch3'];
  const trunks = ['trunk0', 'trunk1', 'trunk2', 'trunk3'];

  /** Clicks a toolbar control that changes the view and returns the hook after the next frame. */
  async function clickToolbar(page: Page, selector: string): Promise<BonsaiViewerHook> {
    const renders = (await page.evaluate(() => window.__bonsai?.viewer?.renders)) ?? 0;
    await press(page, `#viewer-toolbar ${selector}`);
    await page.waitForFunction((r) => (window.__bonsai?.viewer?.renders ?? 0) > r, renders);
    const viewer = await page.evaluate(() => window.__bonsai?.viewer);
    if (!viewer) throw new Error('viewer hook missing');
    await expect(page.locator('#viewer-hotspots .hotspot')).toHaveCount(viewer.hotspots.length);
    return viewer;
  }

  test('switches modes from the toolbar', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/');
    await expect(page.locator('#viewer-toolbar .info')).toContainText('Juniper "Granny\'s"');
    await expect(page.locator('[data-mode="view"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#viewer-toolbar .sub-row')).toHaveCount(0);
    await expect(page.locator('#viewer-help .help-line')).toHaveText([
      'Drag to rotate  |  Pinch or scroll to zoom  |  Reset button or R',
    ]);

    const wire = await clickToolbar(page, '[data-mode="wire"]');
    expect(wire.mode).toBe('wire');
    expect(summary(wire.hotspots)).toEqual([...branches, ...trunks]);
    await expect(page.locator('[data-mode="wire"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-mode="view"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#viewer-toolbar .sub-row')).toBeVisible();
    await expect(page.locator('#viewer-help .help-line').first()).toContainText('Wire: 10');
    expect(wire.wireStock).toBe(10);
    expect(wire.day).toBe(0);

    const clip = await clickToolbar(page, '[data-mode="clip"]');
    expect(clip.mode).toBe('clip');
    expect(summary(clip.hotspots)).toEqual(branches);
    await expect(page.locator('#viewer-toolbar .sub-row')).toHaveCount(0);

    const prune = await clickToolbar(page, '[data-mode="prune"]');
    expect(prune.mode).toBe('prune');
    expect(summary(prune.hotspots)).toEqual(branches);

    const view = await clickToolbar(page, '[data-mode="view"]');
    expect(view.mode).toBe('view');
    expect(view.hotspots).toEqual([]);

    await closeViewer(page);
    const closed = await page.evaluate(() => window.__bonsai?.viewer);
    expect(closed?.wireStock).toBe(0);
    expect(closed?.day).toBe(-1);
    expect(errors).toEqual([]);
  });

  test('drives the wire action, direction and filters from the sub-row', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/?tree=wired');
    const wire = await clickToolbar(page, '[data-mode="wire"]');
    expect(summary(wire.hotspots)).toEqual([...branches, ...trunks]);
    await expect(page.locator('#viewer-toolbar [data-action]')).toHaveCount(2);
    await expect(page.locator('#viewer-toolbar [data-dir]')).toHaveCount(4);
    await expect(page.locator('#viewer-toolbar [data-show]')).toHaveCount(2);

    // The fixture's wire went on at day 0 and the game is on day 0.
    const wired = wire.hotspots.filter((h) => h.caption !== '');
    expect(wired.map((h) => [h.kind, h.id, h.caption])).toEqual([['branch', 1, '0d (early)']]);
    await expect(page.locator('#viewer-hotspots .hotspot[data-id="1"] .caption')).toHaveText(
      '0d (early)',
    );

    const remove = await clickToolbar(page, '[data-action="remove"]');
    expect(remove.wireAction).toBe('remove');
    expect(summary(remove.hotspots)).toEqual(['branch1']);
    await expect(page.locator('#viewer-toolbar [data-dir]')).toHaveCount(0);
    await expect(page.locator('#viewer-toolbar [data-show]')).toHaveCount(0);
    await expect(page.locator('#viewer-help .help-line').first()).toHaveText(
      'Click a wired branch to remove its wire  |  Wire: 10',
    );

    const bend = await clickToolbar(page, '[data-action="bend"]');
    expect(bend.wireAction).toBe('bend');
    await expect(page.locator('#viewer-toolbar [data-dir]')).toHaveCount(4);
    await expect(page.locator('#viewer-help .help-line').first()).toHaveText(
      'Click branch or trunk to bend (15° per click on branches, 20° on trunks)  |  Wire: 10',
    );

    expect((await clickToolbar(page, '[data-dir="up"]')).bendDir).toBe('up');
    await expect(page.locator('[data-dir="up"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-dir="left"]')).toHaveAttribute('aria-pressed', 'false');

    const noUnwired = await clickToolbar(page, '[data-show="unwired"]');
    expect(noUnwired.showUnwired).toBe(false);
    expect(summary(noUnwired.hotspots)).toEqual(['branch1', ...trunks]);

    const noWired = await clickToolbar(page, '[data-show="wired"]');
    expect(noWired.showWired).toBe(false);
    expect(summary(noWired.hotspots)).toEqual(trunks);

    await closeViewer(page);
    expect(errors).toEqual([]);
  });

  test('ignores mode keys held with a modifier', async ({ page }) => {
    await openViewer(page, '/');
    // A key test: modifier chords are key handling itself, with no control.
    await page.keyboard.press('Alt+c');
    // Two frames give any render the key requested time to land.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        }),
    );
    expect(await page.evaluate(() => window.__bonsai?.viewer?.mode)).toBe('view');
  });

  test('closes from the Exit button', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/');
    await expect(page.locator('[data-exit]')).toHaveText('Exit (Esc)');
    await press(page, '[data-exit]');
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === false);
    await expect(page.locator('#viewer')).toBeHidden();
    await expect(page.locator('#viewer-toolbar')).toBeHidden();
    await expect(page.locator('#viewer-help')).toBeHidden();
    expect(errors).toEqual([]);
  });
});

test.describe('viewer camera', () => {
  // ZOOM_MIN and ZOOM_MAX, pinned in src/viewer/camera.test.ts.
  const zoomMin = 0.8;
  const zoomMax = 6.0;

  async function viewerHook(page: Page): Promise<BonsaiViewerHook> {
    const viewer = await page.evaluate(() => window.__bonsai?.viewer);
    if (!viewer) throw new Error('viewer hook missing');
    return viewer;
  }

  /** Runs `act` and waits for the camera distance to settle on `distance`. */
  async function zoomTo(page: Page, act: () => Promise<void>, distance: number): Promise<void> {
    const { renders } = await viewerHook(page);
    await act();
    await page.waitForFunction(
      ([d, r]) =>
        (window.__bonsai?.viewer?.renders ?? 0) > r &&
        Math.abs((window.__bonsai?.viewer?.distance ?? NaN) - d) < 1e-9,
      [distance, renders] as const,
    );
  }

  type Finger = readonly [number, number];

  /** Two real touch points: down at `from`, moved to `to`, lifted. */
  async function pinch(
    page: Page,
    from: readonly [Finger, Finger],
    to: readonly [Finger, Finger],
  ): Promise<void> {
    const cdp = await page.context().newCDPSession(page);
    // CDP touch input reaches the page as touch pointers even on the desktop
    // project, where touch emulation is off.
    const points = (fingers: readonly [Finger, Finger]) =>
      fingers.map(([x, y], i) => ({ x, y, id: i + 1 }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(to) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }

  /** The canvas centre's x, and a finger height below the top strip (view mode has no hotspots). */
  function viewport(page: Page): { height: number; cx: number; y: number } {
    const size = page.viewportSize();
    const width = size?.width ?? 0;
    const height = size?.height ?? 0;
    return { height, cx: width / 2, y: height * 0.6 };
  }

  test('pinches to zoom without rotating, inside the zoom limits', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/');
    const { cx, y } = viewport(page);

    // Fingers 80 px apart spread to 240: -160 px at 20 px per notch is
    // 8 notches of 0.08 closer, 2.5 -> 1.86.
    const apart = (half: number): [Finger, Finger] => [
      [cx - half, y],
      [cx + half, y],
    ];
    await zoomTo(page, () => pinch(page, apart(40), apart(120)), 1.86);
    let viewer = await viewerHook(page);
    expect(viewer.yaw).toBe(45);
    expect(viewer.pitch).toBe(10);

    // Back together: 8 notches away again.
    await zoomTo(page, () => pinch(page, apart(120), apart(40)), 2.5);
    // And further together than it started: 4 notches beyond, 2.5 -> 2.82.
    await zoomTo(page, () => pinch(page, apart(120), apart(80)), 2.82);
    viewer = await viewerHook(page);
    expect(viewer.yaw).toBe(45);
    expect(viewer.pitch).toBe(10);

    // Edge to edge, again and again: never past the limits.
    const wide = cx - 10;
    for (let i = 0; i < 6; i++) {
      const { renders } = await viewerHook(page);
      await pinch(page, apart(10), apart(wide));
      await page.waitForFunction((r) => (window.__bonsai?.viewer?.renders ?? 0) > r, renders);
      expect((await viewerHook(page)).distance).toBeGreaterThanOrEqual(zoomMin);
    }
    expect((await viewerHook(page)).distance).toBe(zoomMin);
    for (let i = 0; i < 6; i++) {
      const { renders } = await viewerHook(page);
      await pinch(page, apart(wide), apart(10));
      await page.waitForFunction((r) => (window.__bonsai?.viewer?.renders ?? 0) > r, renders);
      expect((await viewerHook(page)).distance).toBeLessThanOrEqual(zoomMax);
    }
    viewer = await viewerHook(page);
    expect(viewer.distance).toBe(zoomMax);
    expect(viewer.yaw).toBe(45);
    expect(viewer.pitch).toBe(10);

    await closeViewer(page);
    expect(errors).toEqual([]);
  });

  test('zooms one wheel step per button press', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/');
    await expect(page.locator('#viewer-camera')).toBeVisible();
    await expect(page.locator('#viewer-camera button')).toHaveText(['+', '−', 'R']);
    await expect(page.locator('[data-camera="in"]')).toHaveAttribute('aria-label', 'Zoom in');
    await expect(page.locator('[data-camera="out"]')).toHaveAttribute('aria-label', 'Zoom out');
    await expect(page.locator('[data-camera="reset"]')).toHaveAttribute(
      'aria-label',
      'Reset camera',
    );

    await zoomTo(page, () => press(page, '[data-camera="in"]'), 2.5 - 0.08);
    await zoomTo(page, () => press(page, '[data-camera="out"]'), 2.5);
    await zoomTo(page, () => press(page, '[data-camera="out"]'), 2.5 + 0.08);
    expect((await viewerHook(page)).distance).toBeCloseTo(2.58);

    await closeViewer(page);
    await expect(page.locator('#viewer-camera')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('resets the camera from the button', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/');
    const { cx, height } = viewport(page);
    // Low on the canvas: 80 px at 0.4 degrees per pixel turns the camera from 45 to 13.
    await page.mouse.move(cx - 40, height * 0.9);
    await page.mouse.down();
    await page.mouse.move(cx + 40, height * 0.9, { steps: 4 });
    await page.mouse.up();
    await page.waitForFunction(() => Math.abs((window.__bonsai?.viewer?.yaw ?? 0) - 13) < 1e-9);
    await zoomTo(page, () => page.mouse.wheel(0, 100), 2.58);

    await zoomTo(page, () => press(page, '[data-camera="reset"]'), 0.8);
    const viewer = await viewerHook(page);
    expect(viewer.yaw).toBe(45);
    expect(viewer.pitch).toBe(20);
    expect(viewer.distance).toBe(0.8);

    await closeViewer(page);
    expect(errors).toEqual([]);
  });

  test('takes no presses under the wire-removal confirmation', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/?tree=wired');
    let { renders } = await viewerHook(page);
    await setMode(page, 'wire');
    await page.waitForFunction((r) => (window.__bonsai?.viewer?.renders ?? 0) > r, renders);
    ({ renders } = await viewerHook(page));
    await press(page, '#viewer-toolbar [data-action="remove"]');
    await page.waitForFunction((r) => (window.__bonsai?.viewer?.renders ?? 0) > r, renders);
    ({ renders } = await viewerHook(page));
    await pressHotspot(page, 'branch', 1);
    await page.waitForFunction((r) => (window.__bonsai?.viewer?.renders ?? 0) > r, renders);
    const before = await viewerHook(page);
    expect(before.modal).toBe(1);
    await expect(page.locator('#viewer-camera')).toHaveJSProperty('inert', true);

    await press(page, '[data-camera="in"]', true);
    // Two animation frames: time for any render the press might have requested.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        }),
    );
    const after = await viewerHook(page);
    expect(after.distance).toBe(before.distance);
    expect(after.modal).toBe(1);
    await expect(page.locator('#viewer-modal')).toBeVisible();

    expect(errors).toEqual([]);
  });
});

test.describe('viewer lifecycle', () => {
  // `__bonsai.paused` is the game state's own flag, published by the scene that
  // owns it; `viewer.paused` only mirrors it while the viewer holds the state.
  // Asserting on the former is what proves close() really let the simulation go.
  const paused = (page: Page): Promise<boolean | undefined> =>
    page.evaluate(() => window.__bonsai?.paused);

  test('pauses the simulation while open and resumes on Escape', async ({ page }) => {
    const errors = collectErrors(page);
    await toTitle(page);
    await startNewGame(page);
    await page.waitForFunction(() => window.__bonsai?.scene === 'world');
    expect(await paused(page)).toBe(false);
    expect(await page.evaluate(() => window.__bonsai?.viewer?.paused)).toBe(false);
    await openViewer(page, '/');
    await page.waitForFunction(() => window.__bonsai?.paused === true);
    expect(await page.evaluate(() => window.__bonsai?.viewer?.paused)).toBe(true);
    await closeViewer(page);
    expect(await paused(page)).toBe(false);
    expect(await page.evaluate(() => window.__bonsai?.viewer?.paused)).toBe(false);
    expect(errors).toEqual([]);
  });

  test('resumes the simulation from the Exit button', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/');
    await page.waitForFunction(() => window.__bonsai?.paused === true);
    await press(page, '[data-exit]');
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === false);
    expect(await paused(page)).toBe(false);
    expect(errors).toEqual([]);
  });
});

test.describe('viewer actions', () => {
  async function viewerHook(page: Page): Promise<BonsaiViewerHook> {
    const viewer = await page.evaluate(() => window.__bonsai?.viewer);
    if (!viewer) throw new Error('viewer hook missing');
    return viewer;
  }

  /** Runs `act` and returns the hook after the frame it requested. */
  async function afterFrame(page: Page, act: () => Promise<void>): Promise<BonsaiViewerHook> {
    const { renders } = await viewerHook(page);
    await act();
    await page.waitForFunction((r) => (window.__bonsai?.viewer?.renders ?? 0) > r, renders);
    return viewerHook(page);
  }

  /** Two animation frames: time for any render a non-action requested to land. */
  async function twoFrames(page: Page): Promise<void> {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        }),
    );
  }

  async function hotspotAt(
    page: Page,
    kind: 'branch' | 'trunk',
    id: number,
  ): Promise<BonsaiViewerHotspot> {
    const hotspot = (await viewerHook(page)).hotspots.find((h) => h.kind === kind && h.id === id);
    if (!hotspot) throw new Error(`no ${kind} hotspot ${String(id)} on screen`);
    return hotspot;
  }

  /** Presses a hotspot where the hook says it is and returns the hook after the next frame. */
  const clickHotspot = (
    page: Page,
    kind: 'branch' | 'trunk',
    id: number,
  ): Promise<BonsaiViewerHook> => afterFrame(page, () => pressHotspot(page, kind, id));

  const pressMode = (page: Page, mode: string): Promise<BonsaiViewerHook> =>
    afterFrame(page, () => setMode(page, mode));

  const clickToolbar = (page: Page, selector: string): Promise<BonsaiViewerHook> =>
    afterFrame(page, () => press(page, `#viewer-toolbar ${selector}`));

  async function drag(page: Page, x: number, y: number): Promise<void> {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 80, y, { steps: 4 });
    await page.mouse.up();
    await twoFrames(page);
  }

  test('clips a branch by 1 cm', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/');
    const before = await pressMode(page, 'clip');
    const after = await clickHotspot(page, 'branch', 0);
    expect(after.revision).toBe(before.revision + 1);
    expect(after.lengths[0]).toBeCloseTo((before.lengths[0] ?? NaN) - 1);
    expect(after.lengths.slice(1)).toEqual(before.lengths.slice(1));
    expect(after.wireStock).toBe(10);
    await closeViewer(page);
    expect(errors).toEqual([]);
  });

  test('refuses to prune outside winter and says so', async ({ page }) => {
    const errors = collectErrors(page);
    // A new game starts on day 0, spring.
    await openViewer(page, '/');
    const before = await pressMode(page, 'prune');
    expect(before.day).toBe(0);
    await expect(page.locator('#viewer-help .help-line')).toHaveText([
      'Prune: requires winter',
      'Drag to rotate  |  Pinch or scroll to zoom  |  Reset button or R',
    ]);
    // The hotspots stay; the sim refuses the click.
    expect(before.hotspots).toHaveLength(4);
    const after = await clickHotspot(page, 'branch', 0);
    expect(after.branchCount).toBe(before.branchCount);
    expect(after.revision).toBe(before.revision);
    expect(after.lengths).toEqual(before.lengths);
    await expect(page.locator('#viewer-hotspots .hotspot')).toHaveCount(4);

    // Clip mode has no note.
    await pressMode(page, 'clip');
    await expect(page.locator('#viewer-help .help-line')).toHaveText([
      'Drag to rotate  |  Pinch or scroll to zoom  |  Reset button or R',
    ]);
    await closeViewer(page);
    expect(errors).toEqual([]);
  });

  test('prunes a branch in winter', async ({ page }) => {
    const errors = collectErrors(page);
    // The day-14 prototype save moved to day 100, mid-winter; its first tree has 5 branches.
    const save = JSON.parse(
      readFileSync(
        path.join(import.meta.dirname, '../src/sim/__fixtures__/prototype-save-v1-day14.json'),
        'utf8',
      ).replace(/\0+$/, ''),
    ) as Record<string, unknown>;
    save.game_day = 100;
    await page.goto('/');
    await page.evaluate((text) => {
      localStorage.setItem('bonsai.save.1', text);
    }, JSON.stringify(save));
    await toTitle(page);
    await continueGame(page);
    await page.waitForFunction(() => window.__bonsai?.scene === 'world');
    await openByRoute(page);
    await page.waitForFunction(
      () => window.__bonsai?.viewer?.open === true && window.__bonsai.viewer.renders >= 1,
    );

    const before = await pressMode(page, 'prune');
    expect(before.day).toBe(100);
    expect(before.branchCount).toBe(5);
    await expect(page.locator('#viewer-help .help-line')).toHaveText([
      'Drag to rotate  |  Pinch or scroll to zoom  |  Reset button or R',
    ]);
    const after = await clickHotspot(page, 'branch', 0);
    expect(after.branchCount).toBe(4);
    expect(after.hotspots).toHaveLength(before.hotspots.length - 1);
    await expect(page.locator('#viewer-hotspots .hotspot')).toHaveCount(after.hotspots.length);
    expect(after.revision).toBe(before.revision + 1);
    await closeViewer(page);
    expect(errors).toEqual([]);
  });

  test('bends a branch one step per click on the chosen axis', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/');
    const start = await pressMode(page, 'wire');
    expect(start.bendDir).toBe('left');
    const b0 = start.bends[1];

    const left = await clickHotspot(page, 'branch', 1);
    const b1 = left.bends[1];
    expect(Math.abs((b1?.bend ?? NaN) - (b0?.bend ?? NaN))).toBe(15);
    expect(b1?.bendV).toBe(b0?.bendV);
    expect(b1?.wired).toBe(true);
    expect(left.wireStock).toBe(9);
    expect(left.revision).toBe(start.revision + 1);
    expect(left.hotspots.find((h) => h.kind === 'branch' && h.id === 1)?.caption).toBe(
      '0d (early)',
    );
    await expect(page.locator('#viewer-help .help-line').first()).toContainText('Wire: 9');

    expect((await clickToolbar(page, '[data-dir="up"]')).bendDir).toBe('up');
    const up = await clickHotspot(page, 'branch', 1);
    const b2 = up.bends[1];
    expect(Math.abs((b2?.bendV ?? NaN) - (b1?.bendV ?? NaN))).toBe(15);
    expect(b2?.bend).toBe(b1?.bend);
    expect(up.wireStock).toBe(8);

    await closeViewer(page);
    expect(errors).toEqual([]);
  });

  test('wires the trunk at a hotspot', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/');
    const before = await pressMode(page, 'wire');
    expect(before.trunkEvents).toBe(0);
    const after = await clickHotspot(page, 'trunk', 0);
    expect(after.trunkEvents).toBe(1);
    expect(after.wireStock).toBe(9);
    expect(after.revision).toBe(before.revision + 1);
    await closeViewer(page);
    expect(errors).toEqual([]);
  });

  test('removes a wire through the confirmation', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/?tree=wired');
    await pressMode(page, 'wire');
    const remove = await clickToolbar(page, '[data-action="remove"]');
    expect(remove.bends[1]).toEqual({ bend: 40, bendV: 0, wired: true });
    expect(remove.modal).toBe(-1);
    await expect(page.locator('#viewer-modal')).toBeHidden();

    const openModal = async (): Promise<void> => {
      const opened = await clickHotspot(page, 'branch', 1);
      expect(opened.modal).toBe(1);
      await expect(page.locator('#viewer-modal')).toBeVisible();
      await expect(page.locator('#viewer-modal .title')).toHaveText('Remove wire from branch 1?');
      await expect(page.locator('#viewer-modal .detail')).toHaveText(
        'Wire age: 0d (early)Bend will spring back to 30%.',
      );
      await expect(page.locator('#viewer-modal .detail > div')).toHaveText([
        'Wire age: 0d (early)',
        'Bend will spring back to 30%.',
      ]);
    };

    await openModal();
    // Key tests on every project: other keys are ignored while the modal is open.
    await page.keyboard.press('c');
    await twoFrames(page);
    expect((await viewerHook(page)).mode).toBe('wire');
    // Escape closes the modal only (a key test).
    const escaped = await afterFrame(page, () => page.keyboard.press('Escape'));
    expect(escaped.modal).toBe(-1);
    expect(escaped.open).toBe(true);
    await expect(page.locator('#viewer-modal')).toBeHidden();

    await openModal();
    const cancelled = await afterFrame(page, () =>
      press(page, '#viewer-modal [data-modal="cancel"]'),
    );
    expect(cancelled.modal).toBe(-1);
    expect(cancelled.bends[1]?.wired).toBe(true);
    expect(cancelled.revision).toBe(remove.revision);

    await openModal();
    await expect(page.locator('#viewer-modal .ui-button')).toHaveText(['Cancel', 'Remove']);
    const removed = await afterFrame(page, () =>
      press(page, '#viewer-modal [data-modal="remove"]'),
    );
    expect(removed.modal).toBe(-1);
    expect(removed.bends[1]?.wired).toBe(false);
    // Off before it set: the bend springs back to 30% of the fixture's 40.
    expect(removed.bends[1]?.bend).toBeCloseTo(12);
    expect(removed.revision).toBe(remove.revision + 1);
    expect(removed.hotspots).toEqual([]);
    expect(removed.wireStock).toBe(10);
    await expect(page.locator('#viewer-modal')).toBeHidden();

    await closeViewer(page);
    expect(errors).toEqual([]);
  });

  test('refuses to wire with none left', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/');
    await pressMode(page, 'wire');
    // Ten wires: every branch left, every branch right, branch 0 up and down.
    const plan: [string, number[]][] = [
      ['left', [0, 1, 2, 3]],
      ['right', [0, 1, 2, 3]],
      ['up', [0]],
      ['down', [0]],
    ];
    let stock = 10;
    for (const [dir, ids] of plan) {
      if (dir !== 'left') await clickToolbar(page, `[data-dir="${dir}"]`);
      for (const id of ids) {
        stock -= 1;
        expect((await clickHotspot(page, 'branch', id)).wireStock).toBe(stock);
      }
    }
    expect(stock).toBe(0);

    const before = await viewerHook(page);
    const after = await clickHotspot(page, 'branch', 1);
    expect(after.wireStock).toBe(0);
    expect(after.revision).toBe(before.revision);
    expect(after.bends).toEqual(before.bends);
    const trunk = await clickHotspot(page, 'trunk', 0);
    expect(trunk.trunkEvents).toBe(0);
    expect(trunk.revision).toBe(before.revision);
    await expect(page.locator('#viewer-help .help-line').first()).toHaveText(
      / {2}Wire: 0 {2}\(out\)$/,
    );

    await closeViewer(page);
    expect(errors).toEqual([]);
  });

  test('never drags from a hotspot or under the modal', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/');
    const before = await pressMode(page, 'clip');
    const { x, y } = await hotspotAt(page, 'branch', 0);
    await drag(page, x, y);
    let now = await viewerHook(page);
    expect(now.yaw).toBe(before.yaw);
    expect(now.revision).toBe(before.revision);

    await openViewer(page, '/?tree=wired');
    await pressMode(page, 'wire');
    await clickToolbar(page, '[data-action="remove"]');
    expect((await clickHotspot(page, 'branch', 1)).modal).toBe(1);
    const size = page.viewportSize();
    await drag(page, (size?.width ?? 0) / 2 - 40, (size?.height ?? 0) * 0.9);
    now = await viewerHook(page);
    expect(now.yaw).toBe(before.yaw);
    expect(now.modal).toBe(1);

    expect(errors).toEqual([]);
  });
});
