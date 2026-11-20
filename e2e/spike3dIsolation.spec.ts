import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from './drive';

// The front garden 3D spike (backlog #359) is dev-only: `vite build` builds
// index.html alone, so the production build, which this suite runs against,
// must hold no trace of spike3d.html or src/spike3d/ (no player-flippable
// switch in production). The build is checked on disk, then as served: the
// preview server, as Static Web Apps' navigation fallback
// (public/staticwebapp.config.json), answers /spike3d.html with the game.

const DIST = path.join(import.meta.dirname, '..', 'dist');

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

test.describe('the 3D spike is not in the production build', () => {
  test('no built file is the spike or mentions it', () => {
    const files = filesUnder(DIST);
    expect(files.some((f) => f.endsWith('index.html'))).toBe(true);
    expect(files.filter((f) => path.basename(f).toLowerCase().includes('spike'))).toEqual([]);
    const text = files.filter((f) => /\.(html|js|map|json|webmanifest)$/.test(f));
    expect(text.filter((f) => readFileSync(f, 'utf8').includes('spike3d'))).toEqual([]);
  });

  test('/spike3d.html serves the game, not the spike', async ({ page, request }) => {
    const spike = await request.get('/spike3d.html');
    const game = await request.get('/');
    expect(await spike.text()).toBe(await game.text());

    await page.goto('/spike3d.html');
    await page.waitForFunction(() => window.__bonsai?.scene === 'title');
    expect(await page.evaluate(() => window.__spike3d)).toBeUndefined();
  });
});
