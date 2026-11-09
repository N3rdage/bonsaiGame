import { bootWorld, closeViewer, collectErrors, expect, hook, openViewer, test } from './drive';

// Pinned in src/world/world.test.ts: 2.5 prototype px per step, halved.
const SPEED = 1.25;

test.describe('world', () => {
  test('boots into the shed with the new-game HUD', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    const h = await hook(page);
    expect(h.room).toBe('shed');
    expect(h.hud).toBe('Spring 1/28  |  Day 0  |  $100');
    expect(h.player).toEqual({ x: 240, y: 135, facing: 'down' });
    expect(h.paused).toBe(false);
    expect(h.viewer?.open).toBe(false);
    expect(errors).toEqual([]);
  });

  // Movement keys are keyboard-only by design; the pointer drag test covers touch.
  test('walks right at the pinned speed per step and faces right', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => (window.__bonsai?.player.x ?? 240) > 240);
    const a = await hook(page);
    await page.waitForFunction((f) => (window.__bonsai?.frames ?? 0) >= f + 30, a.frames);
    const b = await hook(page);
    await page.keyboard.up('ArrowRight');
    // x and frames come from the same publish, so the ratio is exact.
    expect(b.player.x - a.player.x).toBeCloseTo((b.frames - a.frames) * SPEED, 6);
    expect(b.player.y).toBe(135);
    expect(b.player.facing).toBe('right');
    expect(errors).toEqual([]);
  });

  test('stops at the left edge clamp and faces left', async ({ page }) => {
    await bootWorld(page);
    await page.keyboard.down('a');
    await page.waitForFunction(() => window.__bonsai?.player.x === 4);
    const f = (await hook(page)).frames;
    await page.waitForFunction((n) => (window.__bonsai?.frames ?? 0) >= n + 10, f);
    await page.keyboard.up('a');
    const h = await hook(page);
    expect(h.player.x).toBe(4);
    expect(h.player.facing).toBe('left');
  });

  test('opens the viewer with V, pauses, and resumes on Escape', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    await openViewer(page);
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === true);
    expect((await hook(page)).paused).toBe(true);

    // The world ignores its movement keys while the viewer has them (a key test).
    const frames = (await hook(page)).frames;
    await page.keyboard.down('ArrowRight');
    // Ten animation frames: time for the world to have stepped if it were going to.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          let n = 0;
          const tick = (): void => {
            n += 1;
            if (n >= 10) resolve();
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );
    await page.keyboard.up('ArrowRight');
    expect((await hook(page)).frames).toBe(frames);

    await closeViewer(page);
    await page.waitForFunction(() => window.__bonsai?.viewer?.open === false);
    expect((await hook(page)).paused).toBe(false);
    // The world steps again afterwards.
    await page.waitForFunction((f) => (window.__bonsai?.frames ?? 0) > f, frames);
    expect((await hook(page)).viewer?.open).toBe(false);
    expect(errors).toEqual([]);
  });

  test('a pointer drag on the canvas walks the player', async ({ page }) => {
    const errors = collectErrors(page);
    await bootWorld(page);
    const box = await page.locator('#game canvas').boundingBox();
    if (!box) throw new Error('no canvas');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 150, y, { steps: 5 });
    await page.waitForFunction(() => (window.__bonsai?.player.x ?? 240) > 250);
    await page.mouse.up();
    const h = await hook(page);
    expect(h.player.facing).toBe('right');
    expect(h.player.y).toBe(135);
    expect(errors).toEqual([]);
  });
});
