import { defineConfig } from '@playwright/test';

// Walkthroughs A–D from the readiness checklist. Screenshots → screenshots/<walkthrough>/<step>.png
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 8_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5180',
    viewport: { width: 1280, height: 900 },
    actionTimeout: 8_000,
  },
  webServer: {
    command: 'npm run dev -- --port 5180 --strictPort',
    url: 'http://localhost:5180',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
