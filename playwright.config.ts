import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

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

// Runs against the production build so what is tested is what gets deployed.
// `npm run build` must have run first (CI does; locally `npm run build && npm run test:e2e`).
export default defineConfig({
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
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 's22-portrait', use: s22Ultra(384, 824) },
    { name: 's22-landscape', use: s22Ultra(824, 384) },
  ],
});
