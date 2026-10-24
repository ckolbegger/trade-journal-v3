import { defineConfig } from '@playwright/test';
import config from './playwright.config';
export default defineConfig({ ...config, testDir: './tests/benchmark', testMatch: 'd01-scale.spec.ts', projects: [{ name: 'webkit', use: { browserName: 'webkit' } }], workers: 1 });
