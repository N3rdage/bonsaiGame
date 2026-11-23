import { defineConfig } from '@playwright/test';
import spike from './playwright.spike.config';

export default defineConfig({
  ...spike,
  testMatch: /audit443Spike\.spec\.ts$/,
  projects: (spike.projects ?? []).filter((p) => p.name === 's22-landscape'),
});
