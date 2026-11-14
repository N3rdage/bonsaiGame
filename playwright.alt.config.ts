import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// The same suite on a second preview server, port 4174, for a second run
// beside one holding 4173 (two implementers side by side, or a stale server
// a cut-off run left behind). `npm run test:e2e:alt` uses it. It imports the
// main config and overrides only the port, so the two cannot drift; humans
// can still move the main config with E2E_PORT, but the orchestrator's
// sandbox refuses every command that starts with a variable assignment
// (agentic-gaming#149, #154), which is why this file exists.
const ALT_PORT = 4174;
const url = `http://localhost:${String(ALT_PORT)}`;

if (base.webServer === undefined || Array.isArray(base.webServer)) {
  throw new Error('playwright.config.ts must define one webServer');
}

export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: url },
  webServer: { ...base.webServer, command: `npm run preview -- --port ${String(ALT_PORT)}`, url },
});
