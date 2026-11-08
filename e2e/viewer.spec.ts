import { expect, test, type Page } from '@playwright/test';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

async function openViewer(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => window.__bonsai?.ready === true);
  expect(await page.evaluate(() => window.__bonsai?.viewer?.open)).toBe(false);

  // The logical 480x270 world is scaled to fit and centred, so a click relative
  // to the canvas box lands on the "View tree (3D)" text at (240, 135 + 48).
  const box = await page.locator('#game canvas').boundingBox();
  expect(box).not.toBeNull();
  await page.locator('#game canvas').click({
    position: { x: (box?.width ?? 0) * 0.5, y: ((box?.height ?? 0) * (135 + 48)) / 270 },
  });

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
  await page.keyboard.press('Escape');
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
      foliageVertices: 252,
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

  /** Presses a mode key and waits for the frame that lays out its hotspots. */
  async function pressMode(page: Page, key: string, mode: string): Promise<Hotspot[]> {
    const renders = (await page.evaluate(() => window.__bonsai?.viewer?.renders)) ?? 0;
    await page.keyboard.press(key);
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

    const clip = await pressMode(page, 'c', 'clip');
    expect(summary(clip)).toEqual(branches);
    expect(clip.map((h) => h.label)).toEqual(['0', '1', '2', '3']);
    await expect(page.locator('#viewer-hotspots .hotspot').first()).toHaveAttribute(
      'data-kind',
      'branch',
    );

    expect(summary(await pressMode(page, 'p', 'prune'))).toEqual(branches);

    const wire = await pressMode(page, 'w', 'wire');
    expect(summary(wire)).toEqual([...branches, ...trunks]);
    // Trunk hotspots at 0.2..0.8 of the trunk, labelled in whole cm.
    const heightCm = hook?.starterHeightCm ?? NaN;
    const labels = [0, 1, 2, 3].map((i) => String(Math.round((0.2 + (0.6 * i) / 3) * heightCm)));
    expect(wire.filter((h) => h.kind === 'trunk').map((h) => h.label)).toEqual(labels);
    await expect(page.locator('#viewer-hotspots .hotspot[data-kind="trunk"]')).toHaveText(labels);

    expect(await pressMode(page, 'v', 'view')).toEqual([]);

    await closeViewer(page);
    await expect(page.locator('#viewer-hotspots')).toBeHidden();
    expect(await page.evaluate(() => window.__bonsai?.viewer?.hotspots)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('shows the wired fixture branch and trunk hotspots in wire mode', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/?tree=wired');
    expect(summary(await pressMode(page, 'w', 'wire'))).toEqual([...branches, ...trunks]);
    await closeViewer(page);
    expect(errors).toEqual([]);
  });

  test('keeps hotspots on screen and moves them with the camera', async ({ page }) => {
    const errors = collectErrors(page);
    await openViewer(page, '/');
    const before = await pressMode(page, 'w', 'wire');
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
    await pressMode(page, 'w', 'wire');
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
    await page.locator(`#viewer-toolbar ${selector}`).click();
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
      'Drag to rotate  |  Scroll to zoom  |  R to reset camera',
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
    await page.locator('[data-exit]').click();
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === false);
    await expect(page.locator('#viewer')).toBeHidden();
    await expect(page.locator('#viewer-toolbar')).toBeHidden();
    await expect(page.locator('#viewer-help')).toBeHidden();
    expect(errors).toEqual([]);
  });
});
