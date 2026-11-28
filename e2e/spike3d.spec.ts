import type { Page } from '@playwright/test';
import { expect, test } from './drive';

// The front garden 3D spike (backlog #359, src/spike3d/), dev-only:
// `npm run test:spike` runs this against the Vite dev server
// (playwright.spike.config.ts). The main suite runs against the production
// build, where spike3d.html does not exist, so there every test here skips;
// e2e/spike3dIsolation.spec.ts proves the build has none of it.

test.beforeEach(async ({ request }) => {
  const page = await request.get('/spike3d.html');
  const served = page.ok() && (await page.text()).includes('/src/spike3d/main.ts');
  test.skip(!served, 'the spike page is served only by the dev server');
});

async function openSpike(page: Page, angle: string): Promise<void> {
  await page.goto(`/spike3d.html?angle=${angle}`);
  await page.waitForFunction(
    (key) => window.__spike3d?.ready === true && window.__spike3d.angle === key,
    angle,
  );
  await page.waitForFunction(() => (window.__spike3d?.frames ?? 0) > 5);
}

/** The south band's top edge in the front garden's room px (frontGardenRoom.ts's FACE_Y): the house's collision. */
const FACE_Y = 208;

for (const angle of ['south', 'cutaway', 'north']) {
  test(`the 3D front garden from the ${angle}`, async ({ page }) => {
    await openSpike(page, angle);
    // Software GL draws a frame in a few hundred ms here, so two matching captures take longer than the default 5 s.
    await expect(page).toHaveScreenshot(`front-garden-3d-${angle}.png`);
  });
}

// Down the screen is toward the house from the south, up the screen from the road.
for (const [angle, key] of [
  ['south', 'ArrowDown'],
  ['north', 'ArrowUp'],
] as const) {
  test(`from the ${angle}, ${key} walks from the path to the front door without crossing the wall`, async ({
    page,
  }) => {
    await openSpike(page, angle);
    const start = await page.evaluate(() => window.__spike3d?.player);
    expect(start).toEqual({ x: 336, y: 190, facing: 'up' });
    await page.keyboard.down(key);
    await page.waitForFunction(() => window.__spike3d?.near === 'door_house');
    await page.keyboard.up(key);
    const at = await page.evaluate(() => window.__spike3d?.player);
    expect(at?.x).toBe(336);
    expect(at?.y).toBeLessThan(FACE_Y);
    expect(at?.facing).toBe('down');
  });
}

// The mean frame time, draw calls and triangles, as an annotation (`--reporter=json` shows it).
test('records its frame time over 120 frames on this machine', async ({ page }) => {
  // 120 frames of software GL at a phone's device pixel ratio take most of a minute.
  await openSpike(page, 'south');
  await page.waitForFunction(() => (window.__spike3d?.frameMs ?? 0) > 0);
  const hook = await page.evaluate(() => window.__spike3d);
  test.info().annotations.push({
    type: 'spike3d',
    description: JSON.stringify({
      frameMs: hook?.frameMs,
      drawCalls: hook?.drawCalls,
      triangles: hook?.triangles,
    }),
  });
});
