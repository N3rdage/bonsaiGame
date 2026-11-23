import type { CDPSession, Page } from '@playwright/test';
import { ROOMS } from '../src/world/gardenRoom';
import { wallSheets } from '../src/world3d/wallTiles';
import { bootWorld, collectErrors, expect, hook, skipTutorial, test } from './drive';

// Two fingers down in the 3D world are a pinch, wherever each lands: the camera
// zooms and nothing else happens, not the stick, a turn, a tap's walk or a panel,
// including as the fingers lift. Real two-pointer touch input through the DevTools
// protocol, since Playwright's touchscreen only taps.

const SETTINGS = JSON.stringify({ fullscreen: false, weather: false, world3d: true });

interface Finger {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

/** The finger positions the page sees, in CSS px. */
class Touches {
  private fingers: Finger[] = [];

  constructor(private readonly cdp: CDPSession) {}

  private async send(type: 'touchStart' | 'touchMove' | 'touchEnd'): Promise<void> {
    await this.cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: this.fingers.map(({ id, x, y }) => ({ id, x, y })),
    });
  }

  async down(...fingers: Finger[]): Promise<void> {
    for (const finger of fingers) {
      this.fingers.push(finger);
      await this.send('touchStart');
    }
  }

  /** Moves the fingers to `to`, in a few steps so each move is a small one. */
  async move(...to: Finger[]): Promise<void> {
    const from = this.fingers;
    for (let step = 1; step <= 6; step += 1) {
      this.fingers = from.map((f) => {
        const goal = to.find((t) => t.id === f.id) ?? f;
        return {
          id: f.id,
          x: f.x + ((goal.x - f.x) * step) / 6,
          y: f.y + ((goal.y - f.y) * step) / 6,
        };
      });
      await this.send('touchMove');
    }
  }

  async up(id: number): Promise<void> {
    this.fingers = this.fingers.filter((f) => f.id !== id);
    await this.send('touchEnd');
  }
}

async function world3d(page: Page): Promise<NonNullable<BonsaiTestHook['world3d']>> {
  const state = (await hook(page)).world3d;
  if (!state) throw new Error('world3d missing from the hook');
  return state;
}

test.describe('pinch zoom in the 3D world', () => {
  test.use({ reducedMotion: 'reduce' });
  test.skip(({ hasTouch }) => !hasTouch, 'touch screens only');

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((settings) => {
      localStorage.setItem('bonsai.settings', settings);
    }, SETTINGS);
  });

  // The fingers start 20% of the canvas apart and spread to 50% (zoom in) or the reverse.
  const cases = [
    { name: 'one finger on each half', a: 0.4, b: 0.6, a2: 0.25, b2: 0.75, lift: [1, 2] },
    { name: 'both fingers on the right half', a: 0.6, b: 0.8, a2: 0.55, b2: 0.95, lift: [2, 1] },
    { name: 'both fingers on the left half', a: 0.2, b: 0.4, a2: 0.05, b2: 0.45, lift: [1, 2] },
  ];

  for (const c of cases) {
    test(`${c.name}: zooms and nothing else happens`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors = collectErrors(page);
      await bootWorld(page);
      await page.waitForFunction(
        (sheets) =>
          window.__bonsai?.world3d?.room === 'shed' &&
          window.__bonsai.world3d.floorSheet !== null &&
          window.__bonsai.world3d.wallSheets.length === sheets,
        wallSheets(ROOMS.shed).length,
      );
      await skipTutorial(page, true);
      await page.waitForFunction(() => window.__bonsai?.tutorialStep === -1);
      const canvas = await page.locator('#game canvas').boundingBox();
      if (!canvas) throw new Error('no canvas');
      const at = (id: number, u: number, v = 0.55): Finger => ({
        id,
        x: canvas.x + canvas.width * u,
        y: canvas.y + canvas.height * v,
      });

      const before = await world3d(page);
      const touches = new Touches(await page.context().newCDPSession(page));
      await touches.down(at(1, c.a));
      await touches.down(at(2, c.b));
      await touches.move(at(1, c.a2), at(2, c.b2));
      await touches.up(c.lift[0] ?? 1);
      await touches.up(c.lift[1] ?? 2);

      await expect
        .poll(async () => (await world3d(page)).camera.radius, { timeout: 30_000 })
        .toBeLessThan(before.camera.radius - 1);
      // Long enough for a stick or a tap's walk to have moved the player.
      await page.waitForTimeout(800);
      const after = await world3d(page);
      expect(after.player).toEqual(before.player);
      expect(after.facing).toBe(before.facing);
      expect(after.camera.alpha).toBe(before.camera.alpha);
      expect(after.camera.beta).toBe(before.camera.beta);
      expect((await hook(page)).panel).toBe('');
      expect(errors).toEqual([]);
    });
  }
});
