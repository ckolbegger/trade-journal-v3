import { defineConfig } from '@playwright/test';
import config from './playwright.config';
export default defineConfig({ ...config, testDir: './tests/benchmark', projects: [{ name: 'webkit', use: { browserName: 'webkit' } }], workers: 1 });
