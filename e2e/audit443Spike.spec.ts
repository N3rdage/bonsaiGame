import { test } from './drive';

// Throwaway capture for backlog #445: the engine spike (dev server only) at S22 landscape.
for (const angle of ['south', 'cutaway', 'north']) {
  test(`audit spike ${angle}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/spike3d.html?angle=${angle}`);
    await page.waitForFunction(
      (key) => window.__spike3d?.ready === true && window.__spike3d.angle === key,
      angle,
    );
    await page.waitForFunction(() => (window.__spike3d?.frames ?? 0) > 10);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `docs/audit-443/spike-${angle}.png` });
  });
}
