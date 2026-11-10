import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import type { RouteOptions } from './e2e/drive';

// Samsung Galaxy S22 Ultra (SM-S908B) in Chrome at its default FHD+ display
// mode: 1080 x 2316 device px at a scale factor of 2.8125, about 384 x 824 CSS
// px. WQHD+ (about 480 x 1029 at 3.0) is not modelled. Built on Pixel 7 so the
// other mobile emulation flags (isMobile, hasTouch) stay consistent; the user
// agent is Pixel 7's Chrome Mobile string with the S22 Ultra's model number.
function s22Ultra(width: number, height: number) {
  const pixel7 = devices['Pixel 7'];
  return {
    ...pixel7,
    viewport: { width, height },
    deviceScaleFactor: 2.8125,
    userAgent: pixel7.userAgent.replace('Pixel 7', 'SM-S908B'),
  };
}

// E2E_PORT moves the preview server off 4173 when that port is held; CI uses the default.
const port = Number(process.env.E2E_PORT ?? 4173);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`E2E_PORT must be a positive integer, got "${process.env.E2E_PORT ?? ''}"`);
}

// Epic #8's acceptance loop, in its own project (see `projects`).
const PARITY = /parity\.spec\.ts$/;

// Runs against the production build so what is tested is what gets deployed.
// `npm run build` must have run first (CI does; locally `npm run build && npm run test:e2e`).
export default defineConfig<RouteOptions>({
  testDir: './e2e',
  fullyParallel: true,
  // Walks are frame-paced (src/world/player.ts), so a starved runner stretches
  // a long walk past Playwright's 30 s default (two CI runs in three today on
  // s22-landscape); N3rdage/agentic-gaming#81 is the fix, this is the budget
  // until it lands.
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // Baselines are generated on Linux (as CI runs); no OS suffix keeps the path stable.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}-{projectName}{ext}',
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.005,
      animations: 'disabled',
      stylePath: path.join(import.meta.dirname, 'e2e/screenshot.css'),
    },
  },
  use: {
    baseURL: `http://localhost:${String(port)}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // Vite takes the last --port, so this overrides the script's 4173 and keeps --strictPort.
    command: `npm run preview -- --port ${String(port)}`,
    url: `http://localhost:${String(port)}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: PARITY },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: PARITY },
    // tapRoute: every action by touch through its control (e2e/drive.ts).
    { name: 's22-portrait', use: { ...s22Ultra(384, 824), tapRoute: true }, testIgnore: PARITY },
    { name: 's22-landscape', use: { ...s22Ultra(824, 384), tapRoute: true }, testIgnore: PARITY },
    // The whole loop in one long test, by touch in landscape, after the four
    // projects above have finished: run beside them its 3D viewer render on
    // CI's software GL starves the other worker's walks past their timeouts.
    {
      name: 's22-landscape-parity',
      use: { ...s22Ultra(824, 384), tapRoute: true },
      testMatch: PARITY,
      dependencies: ['chromium', 'mobile', 's22-portrait', 's22-landscape'],
    },
  ],
});
