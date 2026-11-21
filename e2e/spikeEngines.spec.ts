import type { Page } from '@playwright/test';
import { expect, test } from './drive';

// The engine comparison spike (backlog #378, src/spike-engines/): each
// engine's page walks, turns, benchmarks and draws the same scene. Run by
// playwright.engines.config.ts against the build; in any other project
// (the main suite) every test here skips.

const ENGINES = ['three', 'babylon'] as const;

/** The benchmark's seconds in these tests: short, so a software-GL run stays inside the timeout. */
const BENCH_SECONDS = 5;

test.beforeEach(() => {
  test.skip(
    !test.info().project.name.startsWith('engines-'),
    'run by playwright.engines.config.ts only',
  );
});

async function open(page: Page, engine: string, query: string): Promise<void> {
  await page.goto(`/engine-${engine}.html?${query}`);
  await page.waitForFunction(
    (name) => window.__spikeEngine?.engine === name && window.__spikeEngine.ready,
    engine,
    { timeout: 30_000 },
  );
  // A few frames with every texture bound.
  const from = await page.evaluate(() => window.__spikeEngine?.frames ?? 0);
  await page.waitForFunction((n) => (window.__spikeEngine?.frames ?? 0) > n + 3, from);
}

for (const engine of ENGINES) {
  test.describe(`the ${engine} page`, () => {
    test('walks through the shed door into the shed on the keys', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await open(page, engine, 'spawn=shedDoor&yaw=0&pitch=45&distance=8');
      const start = await page.evaluate(() => window.__spikeEngine);
      expect(start?.room).toBe('garden');
      // The camera stands south of the player at yaw 0, so up the screen is north, through the door.
      await page.keyboard.down('ArrowUp');
      await page.waitForFunction(() => window.__spikeEngine?.room === 'shed', undefined, {
        timeout: 30_000,
      });
      // On a metre into the shed (its south wall is at y 8), then stop.
      await page.waitForFunction(() => (window.__spikeEngine?.player.y ?? 99) < 7, undefined, {
        timeout: 30_000,
      });
      await page.keyboard.up('ArrowUp');
      const inside = await page.evaluate(() => window.__spikeEngine);
      expect(inside?.room).toBe('shed');
      // Straight through the door's gap: the walls either side never touched the player.
      expect(inside?.player.x).toBeCloseTo(start?.player.x ?? 0, 6);
      // The camera looks in through the shed's roof, which fades.
      expect(inside?.faded).toContain('shedRoof');
      expect(errors).toEqual([]);
    });

    test('turns the camera on a drag', async ({ page }) => {
      await open(page, engine, 'spawn=frontDoor&yaw=0');
      const before = await page.evaluate(() => window.__spikeEngine?.camera.yaw);
      await page.mouse.move(400, 200);
      await page.mouse.down();
      await page.mouse.move(300, 220, { steps: 5 });
      await page.mouse.up();
      await page.waitForFunction((yaw) => window.__spikeEngine?.camera.yaw !== yaw, before);
      const after = await page.evaluate(() => window.__spikeEngine?.camera);
      expect(after?.yaw).not.toBe(before);
    });

    test(`runs a ${String(BENCH_SECONDS)} s benchmark and shows its result`, async ({ page }) => {
      test.setTimeout(120_000);
      await open(page, engine, `bench=${String(BENCH_SECONDS)}`);
      await page.locator('#spike-bench').click();
      await page.waitForFunction(
        () => window.__spikeEngine?.lastBenchmark !== undefined,
        undefined,
        {
          timeout: 90_000,
        },
      );
      await expect(page.locator('#spike-result')).toBeVisible();
      await expect(page.locator('#spike-result-text')).toContainText('fps');
      const result = await page.evaluate(() => window.__spikeEngine?.lastBenchmark);
      expect(result?.engine).toBe(engine);
      expect(result?.frames).toBeGreaterThan(0);
      const text = (await page.locator('#spike-result-text').textContent()) ?? '';
      test.info().annotations.push({ type: 'benchmark', description: JSON.stringify(result) });
      await test.info().attach(`benchmark-${engine}-${test.info().project.name}.txt`, {
        body: text,
        contentType: 'text/plain',
      });
      process.stdout.write(`\n[${engine} ${test.info().project.name}]\n${text}\n`);
    });

    test('loads the glTF character with its idle and walk clips and blends them by speed', async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await open(page, engine, 'spawn=shedDoor&yaw=0&pitch=45&distance=8');
      const standing = await page.evaluate(() => window.__spikeEngine?.character);
      expect([...(standing?.clips ?? [])].sort()).toEqual(['idle', 'walk']);
      expect(standing?.joints).toBe(7);
      expect(standing?.weights.walk).toBe(0);
      await page.keyboard.down('ArrowRight');
      await page.waitForFunction(
        () => (window.__spikeEngine?.character?.weights.walk ?? 0) === 1,
        undefined,
        {
          timeout: 30_000,
        },
      );
      await page.keyboard.up('ArrowRight');
      await page.waitForFunction(
        () => (window.__spikeEngine?.character?.weights.walk ?? 1) === 0,
        undefined,
        {
          timeout: 30_000,
        },
      );
    });

    test('has shadows enabled over the garden and trees and hedges drawn', async ({ page }) => {
      await open(page, engine, 'spawn=frontDoor');
      const hook = await page.evaluate(() => window.__spikeEngine);
      expect(hook?.shadows.enabled).toBe(true);
      expect(hook?.shadows.mapSize).toBe(2048);
      expect(hook?.shadows.cascades).toBeGreaterThanOrEqual(1);
      expect(hook?.load.trees).toBeGreaterThan(0);
      expect(hook?.load.hedges).toBeGreaterThan(0);
      expect(hook?.load.characters).toBe(0);
    });

    test('runs a quick stress run and reports its steps', async ({ page }) => {
      test.setTimeout(180_000);
      // A budget no frame can pass, so the run is not cut short on a software renderer.
      await open(page, engine, 'stress=quick&budget=100000');
      await page.locator('#spike-stress').click();
      await page.waitForFunction(() => window.__spikeEngine?.lastStress !== undefined, undefined, {
        timeout: 150_000,
      });
      await expect(page.locator('#spike-result')).toBeVisible();
      await expect(page.locator('#spike-result-text')).toContainText('held 60 fps up to step 2');
      const result = await page.evaluate(() => window.__spikeEngine?.lastStress);
      expect(result?.engine).toBe(engine);
      expect(result?.steps.map((s) => s.step)).toEqual([0, 1, 2]);
      expect(result?.heldStep).toBe(2);
      const loads = result?.steps.map((s) => s.load.trees + s.load.hedges) ?? [];
      expect(loads[1]).toBeGreaterThan(loads[0] ?? Infinity);
      expect(loads[2]).toBeGreaterThan(loads[1] ?? Infinity);
      for (const step of result?.steps ?? []) {
        expect(step.frames).toBeGreaterThan(0);
        expect(step.drawCalls).toBeGreaterThan(0);
      }
      expect(await page.evaluate(() => window.__spikeEngine?.stressRunning)).toBe(false);
    });

    test('stops a stress run at the first step that passes the budget', async ({ page }) => {
      test.setTimeout(120_000);
      // A budget no frame can hold: the run ends at step 0.
      await open(page, engine, 'stress=quick&budget=0.001');
      await page.locator('#spike-stress').click();
      await page.waitForFunction(() => window.__spikeEngine?.lastStress !== undefined, undefined, {
        timeout: 90_000,
      });
      const result = await page.evaluate(() => window.__spikeEngine?.lastStress);
      expect(result?.steps).toHaveLength(1);
      expect(result?.stoppedBy).toBe('budget');
      expect(result?.heldStep).toBeUndefined();
    });

    test('draws the front garden from a fixed camera', async ({ page }) => {
      test.setTimeout(60_000);
      await open(page, engine, 'spawn=frontDoor&yaw=155&pitch=35&distance=11');
      await page.addStyleTag({ content: '#spike-overlay { display: none; }' });
      const name = `engine-${engine}-front-garden-${test.info().project.name}.png`;
      const shot = await page.screenshot({ path: test.info().outputPath(name) });
      await test.info().attach(name, { body: shot, contentType: 'image/png' });
    });
  });
}
