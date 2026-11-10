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

// Runs against the production build so what is tested is what gets deployed.
// `npm run build` must have run first (CI does; locally `npm run build && npm run test:e2e`).
export default defineConfig<RouteOptions>({
  testDir: './e2e',
  fullyParallel: true,
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
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    // tapRoute: every action by touch through its control (e2e/drive.ts).
    { name: 's22-portrait', use: { ...s22Ultra(384, 824), tapRoute: true } },
    { name: 's22-landscape', use: { ...s22Ultra(824, 384), tapRoute: true } },
  ],
});
