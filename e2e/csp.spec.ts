import {
  bootWorld,
  closeViewer,
  expect,
  fillRename,
  inspectorAction,
  openInspector,
  openViewer,
  test,
  walkTo,
} from './drive';

// index.html carries the Content-Security-Policy as a meta tag (the SWA header
// is the same plus frame-ancestors, pinned by src/platform/csp.test.ts), so the
// whole suite runs under it. This walks the paths that load the most kinds of
// resource (sheets, fonts, audio, the foliage texture, WebGL, the rename DOM
// input) and fails on any violation Chromium reports.

test('runs the title, world, 3D viewer and rename under the CSP with no violation', async ({
  page,
}) => {
  const messages: string[] = [];
  page.on('console', (msg) => messages.push(msg.text()));
  page.on('pageerror', (err) => messages.push(err.message));

  await bootWorld(page);
  const policy = await page.evaluate(
    () =>
      document.querySelector<HTMLMetaElement>('meta[http-equiv="Content-Security-Policy"]')
        ?.content,
  );
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("object-src 'none'");

  await openViewer(page);
  await page.waitForFunction(
    () =>
      window.__bonsai?.viewer?.open === true &&
      window.__bonsai.viewer.renders >= 1 &&
      window.__bonsai.viewer.foliageReady,
  );
  await closeViewer(page);
  await page.waitForFunction(() => window.__bonsai?.viewer?.open === false);

  await walkTo(page, 160, 'left', 'tree:0');
  await openInspector(page);
  await inspectorAction(page, 'rename');
  await page.waitForFunction(() => window.__bonsai?.panel === 'rename:0');
  await fillRename(page, 'Kaede');
  await page.waitForFunction(() => window.__bonsai?.panel === '');

  const violations = messages.filter(
    (m) => m.includes('Content Security Policy') || m.includes('Refused to'),
  );
  expect(violations).toEqual([]);
});
