import { defineConfig } from '@playwright/test';

// Routine browser runs use Chromium only (decision 19); RC adds Firefox and WebKit.
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  reporter: 'list',
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
