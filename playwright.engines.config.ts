import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// The engine comparison spike (backlog #378): e2e/spikeEngines.spec.ts
// against the production build (`npm run build` first), which on the
// spike's branch carries engine-three.html and engine-babylon.html. Run it
// with `npx playwright test --config playwright.engines.config.ts`. One
// worker, so the benchmark it logs has the machine to itself. Its projects
// are named engines-*, the only projects the spec does not skip in, so the
// main suite passes over it.
const PORT = 4176;
const url = `http://localhost:${String(PORT)}`;
const PROJECTS: Record<string, string> = {
  chromium: 'engines-chromium',
  's22-landscape': 'engines-s22-landscape',
};

export default defineConfig({
  ...base,
  testMatch: /spikeEngines\.spec\.ts$/,
  workers: 1,
  use: { ...base.use, baseURL: url },
  webServer: {
    command: `npm run preview -- --port ${String(PORT)}`,
    url,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: (base.projects ?? []).flatMap((p) => {
    const name = PROJECTS[p.name ?? ''];
    return name ? [{ ...p, name }] : [];
  }),
});
