import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { ROOMS } from '../src/world/gardenRoom';
import { wallSheets } from '../src/world3d/wallTiles';
import { bootWorld, expect, skipTutorial, test } from './drive';

// Backlog #446, throwaway: style frames of the lounge in each take, day and
// dusk, plus today's look as "before", and each take's software-GL bench.
// Run on s22-landscape only:
//   npx playwright test -c playwright.alt.config.ts e2e/styleFrames446.spec.ts --project s22-landscape

const OUT = path.join(process.cwd(), 'docs', 'style-frames-446');
const SETTINGS = JSON.stringify({ fullscreen: false, weather: false, world3d: true });
const TAKES = (process.env.TAKES ?? 'before,a,b,c').split(',');
const TIMES = ['day', 'dusk'] as const;
const BENCH = process.env.BENCH !== '0';
const RAW = process.env.RAW === '1';

async function frames(page: Page, n: number): Promise<void> {
  await page.evaluate(
    (count) =>
      new Promise<void>((done) => {
        let k = 0;
        const tick = (): void => {
          if (++k >= count) done();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    n,
  );
}

/** Boots `query`, skips the tutorial and walks from the shed's start straight up into the lounge. */
async function toLounge(page: Page, query: string, style: boolean): Promise<void> {
  page.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error') console.warn(`[browser] ${m.text()}`);
  });
  page.on('pageerror', (e) => {
    console.warn(`[pageerror] ${e.message}`);
  });
  await bootWorld(page, `/${query}`);
  await skipTutorial(page, true);
  await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => window.__bonsai?.room === 'lounge', undefined, {
    timeout: 30_000,
  });
  await page.keyboard.up('ArrowUp');
  if (style) {
    await page.waitForFunction(() => window.__bonsai?.world3d?.room === 'lounge', undefined, {
      timeout: 30_000,
    });
  } else {
    await page.waitForFunction(
      (sheets) =>
        window.__bonsai?.world3d?.room === 'lounge' &&
        window.__bonsai.world3d.floorSheet !== null &&
        window.__bonsai.world3d.wallSheets.length === sheets,
      wallSheets(ROOMS.lounge).length,
      { timeout: 30_000 },
    );
  }
  // A short walk west and a step south, so the player turns a three-quarter face to the camera.
  await page.waitForTimeout(500);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(160);
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(600);
  await frames(page, 10);
}

test.describe('style frames #446', () => {
  test.use({ reducedMotion: 'reduce' });
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 's22-landscape', 's22-landscape only');
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((settings) => {
      localStorage.setItem('bonsai.settings', settings);
    }, SETTINGS);
  });

  mkdirSync(OUT, { recursive: true });

  for (const take of TAKES) {
    for (const time of TIMES) {
      test(`${take} ${time}`, async ({ page }) => {
        test.setTimeout(180_000);
        const params = new URLSearchParams();
        if (take !== 'before') params.set('style', take);
        if (time === 'dusk') params.set('time', 'dusk');
        const query = params.size > 0 ? `?${params.toString()}` : '';
        await toLounge(page, query, take !== 'before');
        if (take !== 'before') {
          await page.waitForFunction(() => window.__style446?.ready === true, undefined, {
            timeout: 30_000,
          });
          await frames(page, 10);
        }
        await page.screenshot({ path: path.join(OUT, `lounge-${take}-${time}.png`) });
        if (RAW) {
          await page.evaluate(() => {
            const c = document.querySelector<HTMLCanvasElement>('#game canvas');
            if (c) c.style.opacity = '0';
          });
          await page.screenshot({ path: path.join(OUT, `raw-${take}-${time}.png`) });
        }
      });
    }
    if (BENCH) {
      test(`${take} bench`, async ({ page }) => {
        test.setTimeout(240_000);
        const params = new URLSearchParams({ bench: '1' });
        if (take !== 'before') params.set('style', take);
        await toLounge(page, `?${params.toString()}`, take !== 'before');
        await page.waitForFunction(() => window.__style446?.bench?.done === true, undefined, {
          timeout: 120_000,
        });
        const bench = await page.evaluate(() => window.__style446?.bench);
        expect(bench).toBeTruthy();
        writeFileSync(
          path.join(OUT, `bench-${take}.json`),
          `${JSON.stringify({ take, gl: 'software (container SwiftShader)', ...bench }, null, 2)}\n`,
        );
        await page.screenshot({ path: path.join(OUT, `bench-${take}.png`) });
      });
    }
  }
});
