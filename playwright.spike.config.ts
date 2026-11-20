import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// The front garden 3D spike (backlog #359): e2e/spike3d.spec.ts against the
// Vite dev server, the only server that has spike3d.html (`vite build`
// builds index.html alone). `npm run test:spike` uses it; CI does not. It
// takes the main config's screenshot settings and its chromium and
// s22-landscape projects, so the spike's shots sit beside the 2D baselines
// under the same names, and moves only the server.
const PORT = 5179;
const url = `http://localhost:${String(PORT)}`;
const PROJECTS = new Set(['chromium', 's22-landscape']);

export default defineConfig({
  ...base,
  testMatch: /spike3d\.spec\.ts$/,
  use: { ...base.use, baseURL: url },
  webServer: {
    command: `npx vite --port ${String(PORT)} --strictPort`,
    url,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: (base.projects ?? []).filter((p) => PROJECTS.has(p.name ?? '')),
});
