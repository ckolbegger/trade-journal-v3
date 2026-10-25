import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';
const port = Number(loadEnv('production', process.cwd(), 'DEV_').DEV_PORT);
if (port !== 5174) throw new Error('This worktree requires DEV_PORT=5174');
export default defineConfig({ testDir: './tests/browser', workers: 1, use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' }, projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
], webServer: { command: 'npm run preview', url: `http://localhost:${port}`, reuseExistingServer: process.env.BUG001_EXTERNAL_PREVIEW === '1' } });
