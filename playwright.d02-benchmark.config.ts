import { defineConfig } from '@playwright/test';
import config from './playwright.config';
export default defineConfig({ ...config, testDir: './tests/benchmark', testMatch: 'd02-scale.spec.ts', projects: [{ name: 'chromium', use: { browserName: 'chromium' } }], workers: 1 });
