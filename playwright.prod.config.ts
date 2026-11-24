import { defineConfig } from '@playwright/test'

// Production-build browser evidence: serves dist/ and exercises the generated
// service worker / Offline Release Inventory. Local loopback only (DEV-001).
export default defineConfig({
  testDir: './e2e-prod',
  timeout: 45_000,
  use: {
    baseURL: 'http://localhost:5182',
    channel: 'chrome',
    headless: true,
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:5182',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
