import { defineConfig } from '@playwright/test';
import config from './playwright.config';
export default defineConfig({ ...config, testDir: './tests/visual', projects: [{ name: 'chromium', use: { browserName: 'chromium' } }], timeout: 120000, use: { ...config.use, actionTimeout: 10000 }, maxFailures: 1, outputDir: 'test-results/bug001-visual' });
